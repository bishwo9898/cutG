from io import BytesIO
from types import SimpleNamespace

import pytest
from PIL import Image

from app import providers


def source_jpeg() -> bytes:
    output = BytesIO()
    Image.new("RGB", (320, 320), color=(120, 90, 70)).save(output, format="JPEG")
    return output.getvalue()


class FakeResponse:
    content = source_jpeg()

    def raise_for_status(self) -> None:
        return None


class FakeClient:
    def __init__(self, **_kwargs) -> None:
        pass

    def __enter__(self) -> "FakeClient":
        return self

    def __exit__(self, *_args) -> None:
        return None

    def get(self, *_args, **_kwargs) -> FakeResponse:
        return FakeResponse()


class FakeHandler:
    request_id = "fal-request"

    def __init__(self, images: list[dict[str, str]]) -> None:
        self.images = images

    def get(self) -> dict[str, object]:
        return {"images": self.images}


def fal_settings() -> SimpleNamespace:
    return SimpleNamespace(
        provider="fal",
        fal_key="server-only-secret",
        model="fal-ai/flux-pro/kontext",
        request_timeout_seconds=5,
    )


def test_mock_returns_the_source_without_calling_a_paid_provider(monkeypatch) -> None:
    monkeypatch.setattr(providers, "settings", SimpleNamespace(provider="mock"))
    result = providers.generate("https://private.test/source.jpg", "prompt", "generation")
    assert result.output_url == "https://private.test/source.jpg"
    assert result.request_id == "mock-generation"
    assert result.estimated_cost_cents == 0


def test_fal_requests_one_image_with_prompt_enhancement_disabled(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def submit(model: str, *, arguments: dict[str, object]) -> FakeHandler:
        captured.update({"model": model, "arguments": arguments})
        return FakeHandler([{"url": "https://provider.test/result.jpg"}])

    monkeypatch.setattr(providers, "settings", fal_settings())
    monkeypatch.setattr(providers.httpx, "Client", FakeClient)
    monkeypatch.setattr(providers.fal_client, "submit", submit)
    result = providers.generate("https://private.test/source.jpg", "strict prompt", "generation")
    arguments = captured["arguments"]
    assert isinstance(arguments, dict)
    assert arguments["num_images"] == 1
    assert arguments["enhance_prompt"] is False
    assert arguments["prompt"] == "strict prompt"
    assert result.output_url == "https://provider.test/result.jpg"


def test_fal_rejects_alternate_versions(monkeypatch) -> None:
    monkeypatch.setattr(providers, "settings", fal_settings())
    monkeypatch.setattr(providers.httpx, "Client", FakeClient)
    monkeypatch.setattr(
        providers.fal_client,
        "submit",
        lambda *_args, **_kwargs: FakeHandler(
            [
                {"url": "https://provider.test/one.jpg"},
                {"url": "https://provider.test/two.jpg"},
            ]
        ),
    )
    with pytest.raises(RuntimeError, match="exactly one"):
        providers.generate("https://private.test/source.jpg", "strict prompt", "generation")
