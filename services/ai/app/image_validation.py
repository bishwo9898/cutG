from __future__ import annotations

from io import BytesIO

import httpx
import mediapipe as mp  # type: ignore[import-untyped]
import numpy as np
from mediapipe.tasks.python import (  # type: ignore[import-untyped]
    BaseOptions,
    vision,
)
from numpy.typing import NDArray
from PIL import Image, ImageOps

from .config import settings
from .models import FrameInput, FrameMetrics

MAX_DOWNLOAD_BYTES = 4_000_000


def _download(url: str) -> bytes:
    with httpx.Client(timeout=settings.request_timeout_seconds, follow_redirects=True) as client:
        with client.stream("GET", url) as response:
            response.raise_for_status()
            content_type = response.headers.get("content-type", "").split(";", 1)[0]
            if content_type not in {"image/jpeg", "image/png", "image/webp"}:
                raise ValueError("Capture must be a JPEG, PNG, or WebP image")
            chunks: list[bytes] = []
            size = 0
            for chunk in response.iter_bytes():
                size += len(chunk)
                if size > MAX_DOWNLOAD_BYTES:
                    raise ValueError("Image exceeds the 4 MB validation limit")
                chunks.append(chunk)
            content = b"".join(chunks)
    if len(content) > MAX_DOWNLOAD_BYTES:
        raise ValueError("Image exceeds the 4 MB validation limit")
    return content


def _face_analysis(rgb: NDArray[np.uint8]) -> tuple[int, float, float, float, bool]:
    options = vision.FaceDetectorOptions(
        base_options=BaseOptions(
            model_asset_path=settings.face_model_path,
            delegate=BaseOptions.Delegate.CPU,
        ),
        min_detection_confidence=0.55,
    )
    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
    try:
        with vision.FaceDetector.create_from_options(options) as detector:
            result = detector.detect(image)
    except FileNotFoundError as error:
        raise RuntimeError("MediaPipe face detector model is not installed") from error
    detections = result.detections
    if len(detections) != 1:
        return len(detections), 0.0, 0.0, 0.0, False
    detection = detections[0]
    bbox = detection.bounding_box
    image_height, image_width = rgb.shape[:2]
    face_size = max(0.0, float((bbox.width * bbox.height) / (image_width * image_height)))
    keypoints = detection.keypoints
    if len(keypoints) < 3:
        raise RuntimeError("MediaPipe returned incomplete facial keypoints")
    left_eye, right_eye, nose = keypoints[0], keypoints[1], keypoints[2]
    eye_distance = max(abs(float(left_eye.x - right_eye.x)), 0.01)
    yaw = float(nose.x - ((left_eye.x + right_eye.x) / 2)) / eye_distance
    pose_score = max(0.0, 1.0 - abs(yaw) / 0.65)
    hairline_visible = bbox.origin_y >= max(2, int(bbox.height * 0.08))
    return 1, face_size, pose_score, yaw, hairline_visible


def inspect_frame(frame: FrameInput) -> FrameMetrics:
    raw = _download(str(frame.url))
    try:
        image = ImageOps.exif_transpose(Image.open(BytesIO(raw))).convert("RGB")
    except Exception as error:
        raise ValueError("Capture is not a readable image") from error
    width, height = image.size
    sample = image.copy()
    sample.thumbnail((800, 800))
    rgb = np.asarray(sample, dtype=np.uint8)
    gray = np.asarray(sample.convert("L"), dtype=np.float32)
    brightness = float(gray.mean())
    gradients = np.gradient(gray)
    sharpness = float(np.mean(np.square(gradients[0])) + np.mean(np.square(gradients[1])))
    face_count, face_size, pose_score, yaw, hairline_visible = _face_analysis(rgb)
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
    elif not hairline_visible:
        reason = "Move down so your full hairline is visible."
    elif face_size < 0.05:
        reason = "Move closer so your face fills more of the frame."
    elif face_size > 0.65:
        reason = "Move slightly farther from the camera."
    elif pose_score < 0.35:
        reason = "Look straight at the camera."
    face_size_score = max(0.0, 1.0 - abs(face_size - 0.22) / 0.22)
    score = (
        min(1.0, sharpness / 120.0) * 0.30
        + (1 - abs(brightness - 128) / 128) * 0.25
        + pose_score * 0.25
        + face_size_score * 0.20
    )
    return FrameMetrics(
        capture_id=frame.capture_id,
        angle=frame.angle,
        width=width,
        height=height,
        brightness=round(brightness, 2),
        sharpness=round(sharpness, 2),
        face_count=face_count,
        face_size=round(face_size, 4),
        yaw=round(yaw, 4),
        hairline_visible=hairline_visible,
        pose_score=pose_score,
        quality_score=round(max(0.0, score), 4),
        accepted=reason is None,
        rejection_reason=reason,
    )
