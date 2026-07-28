from __future__ import annotations

import base64
import os
import time
from collections.abc import Callable
from dataclasses import dataclass
from io import BytesIO

import fal_client
import httpx
from PIL import Image, ImageOps

from .config import settings
from .hair_mask import create_edit_masks


@dataclass(frozen=True)
class ProviderResult:
    output_url: str
    request_id: str
    duration_ms: int
    estimated_cost_cents: float


ProgressCallback = Callable[[int], None]


def _report_progress(callback: ProgressCallback | None, progress: int) -> None:
    if callback is not None:
        callback(progress)


def _data_url(image: Image.Image, image_format: str = "PNG") -> str:
    output = BytesIO()
    image.save(output, format=image_format, optimize=True)
    mime = "image/png" if image_format == "PNG" else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(output.getvalue()).decode()


def _estimated_cost_cents(model: str, quality: str) -> float:
    if model == "openai/gpt-image-2/edit":
        return {"low": 1.8, "medium": 5.4, "high": 17.8}[quality]
    if "nano-banana-pro" in model:
        return 15.0
    return 4.0


def _fal_generate(
    input_url: str,
    prompt: str,
    edit_region: str,
    progress_callback: ProgressCallback | None,
) -> ProviderResult:
    started = time.monotonic()
    os.environ["FAL_KEY"] = settings.fal_key
    with httpx.Client(timeout=settings.request_timeout_seconds) as client:
        source = client.get(input_url, follow_redirects=True)
        source.raise_for_status()
        if len(source.content) > 4_000_000:
            raise RuntimeError("Source portrait exceeds the provider input limit")
    _report_progress(progress_callback, 25)
    image = ImageOps.exif_transpose(Image.open(BytesIO(source.content))).convert("RGB")
    image.thumbnail((1536, 1536), Image.Resampling.LANCZOS)
    source_data_url = _data_url(image)

    if settings.model == "openai/gpt-image-2/edit":
        strict_mask, _blend_mask = create_edit_masks(image, edit_region)
        arguments: dict[str, object] = {
            "image_urls": [source_data_url],
            "prompt": prompt,
            "image_size": "auto",
            "quality": settings.generation_quality,
            "num_images": 1,
            "output_format": "png",
        }
        if settings.use_hair_mask:
            arguments["mask_image_url"] = _data_url(strict_mask)
    elif "nano-banana" in settings.model:
        arguments = {
            "image_urls": [source_data_url],
            "prompt": prompt,
            "aspect_ratio": "auto",
            "resolution": "2K",
            "num_images": 1,
            "output_format": "png",
        }
    else:
        arguments = {
            "image_url": source_data_url,
            "prompt": prompt,
            "guidance_scale": 3.5 if "/flux-pro/" in settings.model else 2.5,
            "num_images": 1,
            "output_format": "jpeg",
            "safety_tolerance": "2",
            "enhance_prompt": False,
        }

    _report_progress(progress_callback, 35)
    handler = fal_client.submit(
        settings.model,
        arguments=arguments,
    )
    _report_progress(progress_callback, 45)
    result = handler.get()
    _report_progress(progress_callback, 80)
    request_id = str(handler.request_id)
    images = result.get("images") or []
    if len(images) != 1 or not images[0].get("url"):
        raise RuntimeError("fal must return exactly one generated image")
    output_url = str(images[0]["url"])

    return ProviderResult(
        output_url=output_url,
        request_id=request_id,
        duration_ms=int((time.monotonic() - started) * 1000),
        estimated_cost_cents=_estimated_cost_cents(settings.model, settings.generation_quality),
    )


def generate(
    input_url: str,
    prompt: str,
    generation_id: str,
    edit_region: str = "scalp",
    progress_callback: ProgressCallback | None = None,
) -> ProviderResult:
    if settings.provider == "mock":
        _report_progress(progress_callback, 80)
        return ProviderResult(
            output_url=input_url,
            request_id=f"mock-{generation_id}",
            duration_ms=25,
            estimated_cost_cents=0,
        )
    return _fal_generate(input_url, prompt, edit_region, progress_callback)
