from __future__ import annotations

import hmac

from fastapi import Header, HTTPException

from .config import settings


def require_internal_auth(authorization: str = Header(default="")) -> None:
    expected = f"Bearer {settings.internal_secret}"
    if not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Invalid internal AI credential")
