from __future__ import annotations

import time
from dataclasses import dataclass

import httpx

from .config import settings


@dataclass(frozen=True)
class ProviderResult:
    output_url: str
    request_id: str
    duration_ms: int
    estimated_cost_cents: float


def _fal_generate(input_url: str, prompt: str) -> ProviderResult:
    started = time.monotonic()
    headers = {
        "Authorization": f"Key {settings.fal_key}",
        "Content-Type": "application/json",
        "X-Fal-Store-IO": "0",
    }
    with httpx.Client(timeout=settings.request_timeout_seconds) as client:
        submitted = client.post(
            f"https://queue.fal.run/{settings.model}",
            headers=headers,
            json={"image_url": input_url, "prompt": prompt, "output_format": "jpeg"},
        )
        submitted.raise_for_status()
        submission = submitted.json()
        request_id = str(submission["request_id"])
        status_url = str(submission.get("status_url") or f"https://queue.fal.run/{settings.model}/requests/{request_id}/status")
        response_url = str(submission.get("response_url") or f"https://queue.fal.run/{settings.model}/requests/{request_id}")
        while True:
            status_response = client.get(status_url, headers=headers)
            status_response.raise_for_status()
            status = status_response.json().get("status")
            if status == "COMPLETED":
                break
            if status in {"FAILED", "CANCELLED"}:
                raise RuntimeError(f"fal generation ended with status {status}")
            time.sleep(1.5)
        result_response = client.get(response_url, headers=headers)
        result_response.raise_for_status()
        result = result_response.json()
    images = result.get("images") or []
    if not images or not images[0].get("url"):
        raise RuntimeError("fal returned no generated image")
    return ProviderResult(
        output_url=str(images[0]["url"]),
        request_id=request_id,
        duration_ms=int((time.monotonic() - started) * 1000),
        estimated_cost_cents=4.0,
    )


def generate(input_url: str, prompt: str, generation_id: str) -> ProviderResult:
    if settings.provider == "mock":
        return ProviderResult(
            output_url=input_url,
            request_id=f"mock-{generation_id}",
            duration_ms=25,
            estimated_cost_cents=0,
        )
    return _fal_generate(input_url, prompt)
