from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

SERVICE_ROOT = Path(__file__).resolve().parents[1]
MONOREPO_ROOT = SERVICE_ROOT.parent.parent
REPOSITORY_ROOT = (
    MONOREPO_ROOT if (MONOREPO_ROOT / "pnpm-workspace.yaml").exists() else SERVICE_ROOT
)
load_dotenv(SERVICE_ROOT / ".env")
load_dotenv(REPOSITORY_ROOT / ".env.local")
load_dotenv(REPOSITORY_ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    provider: str = os.getenv("AI_PROVIDER", "mock")
    internal_secret: str = os.getenv(
        "AI_INTERNAL_SECRET", "cutg-local-ai-secret-change-before-production"
    )
    callback_url: str = os.getenv(
        "AI_CALLBACK_URL",
        (
            f"http://{os.environ['AI_CALLBACK_HOSTPORT']}/internal/ai"
            if os.getenv("AI_CALLBACK_HOSTPORT")
            else "http://localhost:4000/internal/ai"
        ),
    )
    model: str = os.getenv("AI_GENERATION_MODEL", "fal-ai/flux-pro/kontext")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6380")
    fal_key: str = os.getenv("FAL_KEY", "")
    request_timeout_seconds: float = float(os.getenv("AI_REQUEST_TIMEOUT_SECONDS", "90"))
    face_model_path: str = os.getenv(
        "AI_FACE_MODEL_PATH",
        str(SERVICE_ROOT / "models" / "blaze_face_short_range.tflite"),
    )

    def validate(self) -> None:
        if self.provider not in {"mock", "fal"}:
            raise RuntimeError("AI_PROVIDER must be mock or fal")
        if len(self.internal_secret) < 32:
            raise RuntimeError("AI_INTERNAL_SECRET must be at least 32 characters")
        if self.provider == "fal" and not self.fal_key:
            raise RuntimeError("FAL_KEY is required when AI_PROVIDER=fal")


settings = Settings()
settings.validate()
