from app import tasks
from app.providers import ProviderResult


def test_worker_reports_processing_then_completion(monkeypatch) -> None:
    callbacks: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(tasks, "_callback", lambda path, payload: callbacks.append((path, payload)))
    monkeypatch.setattr(
        tasks,
        "generate",
        lambda *_args: ProviderResult("https://example.test/out.jpg", "req-1", 42, 4),
    )
    tasks.generate_design(
        {"generation_id": "generation", "input_url": "https://example.test/in.jpg", "prompt": "p"}
    )
    assert callbacks[0][0].endswith("/processing")
    assert callbacks[1][0].endswith("/complete")


def test_worker_reports_failure(monkeypatch) -> None:
    callbacks: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(tasks, "_callback", lambda path, payload: callbacks.append((path, payload)))

    def fail(*_args) -> ProviderResult:
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(tasks, "generate", fail)
    try:
        tasks.generate_design(
            {
                "generation_id": "generation",
                "input_url": "https://example.test/in.jpg",
                "prompt": "p",
            }
        )
    except RuntimeError:
        pass
    assert callbacks[-1][0].endswith("/fail")
