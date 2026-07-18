from io import BytesIO

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from app import image_validation
from app.config import settings
from app.main import app
from app.models import FrameInput, FrameMetrics


def jpeg(value: int = 128, size: tuple[int, int] = (640, 640)) -> bytes:
    output = BytesIO()
    Image.fromarray(np.full((size[1], size[0], 3), value, dtype=np.uint8)).save(
        output, format="JPEG"
    )
    return output.getvalue()


def test_rejects_dark_capture(monkeypatch) -> None:
    monkeypatch.setattr(image_validation, "_download", lambda _url: jpeg(5))
    monkeypatch.setattr(image_validation, "_face_analysis", lambda _rgb: (1, 0.2, 1.0, 0.0, True))
    result = image_validation.inspect_frame(
        FrameInput(capture_id="front", angle="FRONT", url="https://example.test/front.jpg")
    )
    assert result.accepted is False
    assert result.rejection_reason == "Image is too dark."


def test_accepts_quality_capture_and_scores_pose(monkeypatch) -> None:
    rng = np.random.default_rng(7)
    output = BytesIO()
    Image.fromarray(rng.integers(70, 190, (700, 700, 3), dtype=np.uint8)).save(
        output, format="JPEG"
    )
    monkeypatch.setattr(image_validation, "_download", lambda _url: output.getvalue())
    monkeypatch.setattr(image_validation, "_face_analysis", lambda _rgb: (1, 0.22, 0.92, 0.0, True))
    result = image_validation.inspect_frame(
        FrameInput(capture_id="front", angle="FRONT", url="https://example.test/front.jpg")
    )
    assert result.accepted is True
    assert result.quality_score > 0.7


def test_rejects_cropped_hairline(monkeypatch) -> None:
    rng = np.random.default_rng(9)
    output = BytesIO()
    Image.fromarray(rng.integers(70, 190, (700, 700, 3), dtype=np.uint8)).save(
        output, format="JPEG"
    )
    monkeypatch.setattr(image_validation, "_download", lambda _url: output.getvalue())
    monkeypatch.setattr(
        image_validation, "_face_analysis", lambda _rgb: (1, 0.22, 0.95, 0.0, False)
    )
    result = image_validation.inspect_frame(
        FrameInput(capture_id="front", angle="FRONT", url="https://example.test/front.jpg")
    )
    assert result.accepted is False
    assert result.rejection_reason == "Move down so your full hairline is visible."


def test_rejects_wrong_head_direction(monkeypatch) -> None:
    rng = np.random.default_rng(11)
    output = BytesIO()
    Image.fromarray(rng.integers(70, 190, (700, 700, 3), dtype=np.uint8)).save(
        output, format="JPEG"
    )
    monkeypatch.setattr(image_validation, "_download", lambda _url: output.getvalue())
    monkeypatch.setattr(image_validation, "_face_analysis", lambda _rgb: (1, 0.22, 0.0, 0.3, True))
    result = image_validation.inspect_frame(
        FrameInput(capture_id="front", angle="FRONT", url="https://example.test/front.jpg")
    )
    assert result.accepted is False
    assert result.rejection_reason == "Look straight at the camera."


def frame_metric(angle: str = "FRONT", *, accepted: bool = True) -> FrameMetrics:
    return FrameMetrics(
        capture_id=angle.lower(),
        angle=angle,
        width=640,
        height=640,
        brightness=128,
        sharpness=80,
        face_count=1,
        face_size=0.22,
        yaw=0,
        hairline_visible=True,
        pose_score=1 if accepted else 0.1,
        quality_score=0.9 if accepted else 0.4,
        accepted=accepted,
        rejection_reason=None if accepted else "Look straight at the camera.",
    )


def test_internal_auth_and_headshot_selection(monkeypatch) -> None:
    metrics = [frame_metric()]
    monkeypatch.setattr(
        "app.main.inspect_frame",
        lambda frame: next(metric for metric in metrics if metric.angle == frame.angle),
    )
    client = TestClient(app)
    payload = {
        "frames": [
            {
                "capture_id": "front",
                "angle": "FRONT",
                "url": "https://example.test/front.jpg",
            }
        ]
    }
    assert client.post("/ai/validate-frames", json=payload).status_code == 401
    response = client.post(
        "/ai/validate-frames",
        headers={"Authorization": f"Bearer {settings.internal_secret}"},
        json=payload,
    )
    assert response.status_code == 200
    assert response.json()["selected_capture_id"] == "front"


def test_rejects_a_low_quality_headshot(monkeypatch) -> None:
    def inspect(frame: FrameInput) -> FrameMetrics:
        metric = frame_metric(frame.angle, accepted=False)
        return metric.model_copy(update={"capture_id": frame.capture_id})

    monkeypatch.setattr("app.main.inspect_frame", inspect)
    client = TestClient(app)
    response = client.post(
        "/ai/validate-frames",
        headers={"Authorization": f"Bearer {settings.internal_secret}"},
        json={
            "frames": [
                {
                    "capture_id": "front",
                    "angle": "FRONT",
                    "url": "https://example.test/front.jpg",
                }
            ]
        },
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["message"].startswith("Retake the front photo")
    assert detail["rejected_frames"] == [
        {
            "capture_id": "front",
            "angle": "FRONT",
            "reason": "Look straight at the camera.",
        }
    ]


def test_requires_exactly_one_front_headshot() -> None:
    client = TestClient(app)
    response = client.post(
        "/ai/validate-frames",
        headers={"Authorization": f"Bearer {settings.internal_secret}"},
        json={"frames": []},
    )
    assert response.status_code == 422
