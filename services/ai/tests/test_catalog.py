from app.catalog import suggest_styles
from app.models import Preferences


def test_suggestions_are_controlled_and_non_sensitive() -> None:
    suggestions = suggest_styles(Preferences(maintenance="low"))
    assert len(suggestions) == 3
    assert suggestions[0].id == "textured-crop"
    assert all(item.category == "haircut" for item in suggestions)
