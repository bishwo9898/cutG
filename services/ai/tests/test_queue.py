from fastapi.testclient import TestClient

from app.config import settings
from app.main import active_model, app


def test_generation_is_rejected_when_no_worker_is_running(monkeypatch) -> None:
    monkeypatch.setattr("app.main.Worker.count", lambda **_kwargs: 0)
    client = TestClient(app)
    response = client.post(
        "/ai/generations",
        headers={"Authorization": f"Bearer {settings.internal_secret}"},
        json={
            "generation_id": "generation-id",
            "input_url": "https://example.test/source.jpg",
            "prompt": "Preserve identity and change only the requested hairstyle.",
        },
    )
    assert response.status_code == 503
    assert "worker is not running" in response.json()["detail"]


def test_health_exposes_queue_readiness(monkeypatch) -> None:
    monkeypatch.setattr("app.main.Worker.count", lambda **_kwargs: 0)
    monkeypatch.setattr("app.main.Queue.count", 2)
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "degraded",
        "provider": settings.provider,
        "model": active_model(),
        "worker_ready": False,
        "worker_count": 0,
        "queue_depth": 2,
    }
