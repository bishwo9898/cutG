from __future__ import annotations

import os

# Tests must be deterministic even when a developer's untracked service .env selects the live
# provider. Individual tests can still monkeypatch these values when exercising other modes.
os.environ["AI_PROVIDER"] = "mock"
os.environ["AI_STRICT_CAPTURE_VALIDATION"] = "true"
os.environ.setdefault(
    "AI_INTERNAL_SECRET", "cutg-test-ai-secret-that-is-at-least-32-characters"
)
