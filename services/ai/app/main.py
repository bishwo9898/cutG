from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException
from redis import Redis
from rq import Queue
from rq.job import Job

from .auth import require_internal_auth
from .catalog import suggest_styles
from .config import settings
from .image_validation import inspect_frame
from .models import (
    GenerateRequest,
    GenerateResponse,
    JobResponse,
    ValidateFramesRequest,
    ValidateFramesResponse,
)

app = FastAPI(title="cutG AI Hair Service", version="1.0.0")


def queue() -> Queue:
    return Queue("cutg-ai-hair", connection=Redis.from_url(settings.redis_url))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "provider": settings.provider, "model": settings.model}


@app.post("/ai/validate-frames", response_model=ValidateFramesResponse)
def validate_frames(
    request: ValidateFramesRequest, _: None = Depends(require_internal_auth)
) -> ValidateFramesResponse:
    try:
        metrics = [inspect_frame(frame) for frame in request.frames]
    except (ValueError, RuntimeError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    rejected = [metric for metric in metrics if not metric.accepted]
    if rejected:
        first = rejected[0]
        raise HTTPException(
            status_code=422,
            detail={
                "message": f"Retake the {first.angle.lower()} photo: "
                f"{first.rejection_reason or 'the image did not pass the quality check'}",
                "rejected_frames": [
                    {
                        "capture_id": metric.capture_id,
                        "angle": metric.angle,
                        "reason": metric.rejection_reason or "Image quality is too low.",
                    }
                    for metric in rejected
                ],
            },
        )
    selected = metrics[0]
    return ValidateFramesResponse(
        selected_capture_id=selected.capture_id,
        metrics=metrics,
        suggestions=suggest_styles(request.preferences),
    )


@app.post("/ai/generations", response_model=GenerateResponse, status_code=202)
def create_generation(
    request: GenerateRequest, _: None = Depends(require_internal_auth)
) -> GenerateResponse:
    job = queue().enqueue(
        "app.tasks.generate_design",
        {
            "generation_id": request.generation_id,
            "input_url": str(request.input_url),
            "prompt": request.prompt,
        },
        job_id=f"generation-{request.generation_id}",
        result_ttl=86_400,
        failure_ttl=604_800,
    )
    return GenerateResponse(job_id=job.id, status=job.get_status())


@app.get("/ai/generations/{job_id}", response_model=JobResponse)
def generation_status(job_id: str, _: None = Depends(require_internal_auth)) -> JobResponse:
    try:
        job = Job.fetch(job_id, connection=Redis.from_url(settings.redis_url))
    except Exception as error:
        raise HTTPException(status_code=404, detail="AI job not found") from error
    return JobResponse(job_id=job.id, status=job.get_status())
