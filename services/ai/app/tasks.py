from __future__ import annotations

import httpx

from .config import settings
from .providers import generate


def _callback(path: str, payload: dict[str, object]) -> None:
    headers = {"Authorization": f"Bearer {settings.internal_secret}"}
    with httpx.Client(timeout=settings.request_timeout_seconds) as client:
        response = client.post(f"{settings.callback_url}{path}", headers=headers, json=payload)
        response.raise_for_status()


def generate_design(payload: dict[str, str]) -> None:
    generation_id = payload["generation_id"]
    try:
        result = generate(payload["input_url"], payload["prompt"], generation_id)
        _callback(
            f"/generations/{generation_id}/complete",
            {
                "outputUrl": result.output_url,
                "providerRequestId": result.request_id,
                "durationMs": result.duration_ms,
                "estimatedCostCents": result.estimated_cost_cents,
            },
        )
    except Exception as error:
        _callback(
            f"/generations/{generation_id}/fail",
            {"errorCode": "AI_GENERATION_FAILED", "errorMessage": str(error)[:1000]},
        )
        raise
