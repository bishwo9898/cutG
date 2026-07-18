from __future__ import annotations

from .models import Preferences, StyleSuggestion

CATALOG = [
    ("textured-crop", "Textured Crop", "haircut", "Short texture with a clean taper."),
    ("low-taper", "Low Taper", "haircut", "A subtle taper that keeps natural weight."),
    ("mid-fade", "Mid Fade", "haircut", "Balanced fade placement and a crisp transition."),
    ("curly-shape-up", "Curly Shape Up", "haircut", "Natural texture with a precise outline."),
    ("classic-pompadour", "Classic Pompadour", "haircut", "Structured volume and tidy sides."),
]


def suggest_styles(preferences: Preferences | None) -> list[StyleSuggestion]:
    maintenance = preferences.maintenance if preferences else "low"
    choices = CATALOG[:3] if maintenance == "low" else CATALOG[1:4]
    return [
        StyleSuggestion(
            id=item[0],
            name=item[1],
            category=item[2],
            description=item[3],
            reason=f"Selected for a {maintenance}-maintenance routine.",
        )
        for item in choices
    ]
