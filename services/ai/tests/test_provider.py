from app.providers import generate


def test_mock_provider_is_deterministic() -> None:
    result = generate("https://example.test/source.jpg", "change only the hair", "abc")
    assert result.output_url == "https://example.test/source.jpg"
    assert result.request_id == "mock-abc"
    assert result.estimated_cost_cents == 0
