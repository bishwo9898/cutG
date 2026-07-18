from __future__ import annotations

import base64
import os
import time
from dataclasses import dataclass
from io import BytesIO

import fal_client
import httpx
from PIL import Image, ImageOps

from .config import settings


@dataclass(frozen=True)
class ProviderResult:
    output_url: str
    request_id: str
    duration_ms: int
    estimated_cost_cents: float


def _fal_generate(input_url: str, prompt: str) -> ProviderResult:
    started = time.monotonic()
    os.environ["FAL_KEY"] = settings.fal_key
    with httpx.Client(timeout=settings.request_timeout_seconds) as client:
        source = client.get(input_url, follow_redirects=True)
        source.raise_for_status()
        if len(source.content) > 4_000_000:
            raise RuntimeError("Source portrait exceeds the provider input limit")
    image = ImageOps.exif_transpose(Image.open(BytesIO(source.content))).convert("RGB")
    image.thumbnail((1536, 1536), Image.Resampling.LANCZOS)
    normalized = BytesIO()
    image.save(normalized, format="JPEG", quality=92, optimize=True)
    data_url = "data:image/jpeg;base64," + base64.b64encode(normalized.getvalue()).decode()

    handler = fal_client.submit(
        settings.model,
        arguments={
            "image_url": data_url,
            "prompt": prompt,
            "guidance_scale": 2.5,
            "num_images": 1,
            "output_format": "jpeg",
            "safety_tolerance": "2",
            "enhance_prompt": False,
        },
    )
    result = handler.get()
    request_id = str(handler.request_id)
    images = result.get("images") or []
    if len(images) != 1 or not images[0].get("url"):
        raise RuntimeError("fal must return exactly one generated image")
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
