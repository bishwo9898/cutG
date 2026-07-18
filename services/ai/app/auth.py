from __future__ import annotations

import hmac

from fastapi import Header, HTTPException

from .config import settings


def require_internal_auth(
    authorization: str = Header(default=""),
    x_cutg_ai_secret: str = Header(default="", alias="X-CutG-AI-Secret"),
) -> None:
    bearer_matches = hmac.compare_digest(authorization, f"Bearer {settings.internal_secret}")
    service_header_matches = hmac.compare_digest(x_cutg_ai_secret, settings.internal_secret)
    if not bearer_matches and not service_header_matches:
        raise HTTPException(status_code=401, detail="Invalid internal AI credential")
