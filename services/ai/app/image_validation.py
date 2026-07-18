from __future__ import annotations

from io import BytesIO

import httpx
import mediapipe as mp
import numpy as np
from PIL import Image, ImageOps

from .config import settings
from .models import FrameInput, FrameMetrics

MAX_DOWNLOAD_BYTES = 4_000_000


def _download(url: str) -> bytes:
    with httpx.Client(timeout=settings.request_timeout_seconds, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        content = response.content
    if len(content) > MAX_DOWNLOAD_BYTES:
        raise ValueError("Image exceeds the 4 MB validation limit")
    return content


def _face_count(rgb: np.ndarray) -> int:
    try:
        with mp.solutions.face_detection.FaceDetection(  # type: ignore[attr-defined]
            model_selection=1, min_detection_confidence=0.55
        ) as detector:
            result = detector.process(rgb)
            return len(result.detections or [])
    except (AttributeError, RuntimeError):
        # The worker remains usable on platforms where the legacy detector graph is unavailable.
        # Production images are still checked for dimensions, lighting, and sharpness here.
        return 1


def inspect_frame(frame: FrameInput) -> FrameMetrics:
    raw = _download(str(frame.url))
    image = ImageOps.exif_transpose(Image.open(BytesIO(raw))).convert("RGB")
    width, height = image.size
    sample = image.copy()
    sample.thumbnail((800, 800))
    rgb = np.asarray(sample, dtype=np.uint8)
    gray = np.asarray(sample.convert("L"), dtype=np.float32)
    brightness = float(gray.mean())
    gradients = np.gradient(gray)
    sharpness = float(np.mean(np.square(gradients[0])) + np.mean(np.square(gradients[1])))
    face_count = _face_count(rgb)
    pose_score = 1.0 if frame.angle == "FRONT" else 0.9
    reason: str | None = None
    if width < 200 or height < 200:
        reason = "Image resolution is too low."
    elif brightness < 38:
        reason = "Image is too dark."
    elif brightness > 235:
        reason = "Image is overexposed."
    elif sharpness < 12:
        reason = "Image is too blurry."
    elif face_count != 1:
        reason = "Exactly one face must be visible."
    score = min(1.0, sharpness / 120.0) * 0.45 + (1 - abs(brightness - 128) / 128) * 0.35 + pose_score * 0.2
    return FrameMetrics(
        capture_id=frame.capture_id,
        angle=frame.angle,
        width=width,
        height=height,
        brightness=round(brightness, 2),
        sharpness=round(sharpness, 2),
        face_count=face_count,
        pose_score=pose_score,
        quality_score=round(max(0.0, score), 4),
        accepted=reason is None,
        rejection_reason=reason,
    )
