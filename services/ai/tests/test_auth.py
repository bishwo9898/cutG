import pytest
from fastapi import HTTPException

from app.auth import require_internal_auth
from app.config import settings


def test_internal_auth_accepts_service_header_and_bearer_fallback() -> None:
    require_internal_auth("", settings.internal_secret)
    require_internal_auth(f"Bearer {settings.internal_secret}", "")


def test_internal_auth_rejects_invalid_credentials() -> None:
    with pytest.raises(HTTPException) as error:
        require_internal_auth("", "wrong")
    assert error.value.status_code == 401
