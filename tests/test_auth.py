from unittest.mock import MagicMock

import pytest
from fastapi import Request

from backend.auth.provider import AuthProvider


@pytest.mark.asyncio
async def test_auth_disabled_returns_default():
    provider = AuthProvider(disabled=True, api_key="test-key")
    req = MagicMock(spec=Request)
    req.headers = {}
    req.query_params = {}

    payload = await provider.verify_request(req)
    assert payload["sub"] == "default-user"


@pytest.mark.asyncio
async def test_auth_enabled_requires_header():
    provider = AuthProvider(disabled=False, api_key="test-key")
    req = MagicMock(spec=Request)
    req.headers = {}
    req.query_params = {}

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        await provider.verify_request(req)
    assert exc.value.status_code == 401
    assert "Unauthorized" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_auth_enabled_valid_api_key():
    provider = AuthProvider(disabled=False, api_key="test-key")
    req = MagicMock(spec=Request)
    req.headers = {"X-API-Key": "test-key"}
    req.query_params = {}

    payload = await provider.verify_request(req)
    assert payload["sub"] == "api-key-user"


@pytest.mark.asyncio
async def test_auth_enabled_invalid_api_key():
    provider = AuthProvider(disabled=False, api_key="test-key")
    req = MagicMock(spec=Request)
    req.headers = {"X-API-Key": "wrong-key"}
    req.query_params = {}

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        await provider.verify_request(req)
    assert exc.value.status_code == 401
    assert "Unauthorized" in str(exc.value.detail)
