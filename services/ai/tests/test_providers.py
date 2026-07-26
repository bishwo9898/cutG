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
        generation_quality="high",
        use_hair_mask=True,
        request_timeout_seconds=5,
        face_model_path="/missing/model.tflite",
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
    assert arguments["guidance_scale"] == 3.5
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


def test_gpt_image_uses_high_quality_hair_mask_and_returns_provider_asset(
    monkeypatch,
) -> None:
    captured: dict[str, object] = {}

    def submit(model: str, *, arguments: dict[str, object]) -> FakeHandler:
        captured.update({"model": model, "arguments": arguments})
        return FakeHandler([{"url": "https://provider.test/result.png"}])

    settings = fal_settings()
    settings.model = "openai/gpt-image-2/edit"
    monkeypatch.setattr(providers, "settings", settings)
    monkeypatch.setattr(providers.httpx, "Client", FakeClient)
    monkeypatch.setattr(providers.fal_client, "submit", submit)
    monkeypatch.setattr(
        providers,
        "create_edit_masks",
        lambda image, _region: (
            Image.new("L", image.size, 255),
            Image.new("L", image.size, 255),
        ),
    )

    result = providers.generate(
        "https://private.test/source.jpg",
        "strict prompt",
        "generation",
        "scalp",
    )

    arguments = captured["arguments"]
    assert isinstance(arguments, dict)
    assert captured["model"] == "openai/gpt-image-2/edit"
    assert arguments["image_urls"]
    assert arguments["mask_image_url"]
    assert arguments["quality"] == "high"
    assert arguments["image_size"] == "auto"
    assert arguments["output_format"] == "png"
    assert result.output_url == "https://provider.test/result.png"
    assert result.estimated_cost_cents == 17.8
