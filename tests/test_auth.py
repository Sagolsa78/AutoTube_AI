import pytest
from backend.auth.provider import AuthProvider
from fastapi import Request
from unittest.mock import MagicMock

@pytest.mark.asyncio
async def test_auth_disabled_returns_default():
    provider = AuthProvider(disabled=True, api_key="test-key")
    req = MagicMock(spec=Request)
    
    user_id = await provider.verify_request(req)
    assert user_id == "default-user"

@pytest.mark.asyncio
async def test_auth_enabled_requires_header():
    provider = AuthProvider(disabled=False, api_key="test-key")
    req = MagicMock(spec=Request)
    req.headers = {}
    
    with pytest.raises(Exception) as exc:
        await provider.verify_request(req)
    assert exc.value.status_code == 401
    assert "Authorization header missing" in str(exc.value.detail)

@pytest.mark.asyncio
async def test_auth_enabled_valid_api_key():
    provider = AuthProvider(disabled=False, api_key="test-key")
    req = MagicMock(spec=Request)
    req.headers = {"Authorization": "Bearer test-key"}
    
    user_id = await provider.verify_request(req)
    assert user_id == "api-user"

@pytest.mark.asyncio
async def test_auth_enabled_invalid_api_key():
    provider = AuthProvider(disabled=False, api_key="test-key")
    req = MagicMock(spec=Request)
    req.headers = {"Authorization": "Bearer wrong-key"}
    
    with pytest.raises(Exception) as exc:
        await provider.verify_request(req)
    assert exc.value.status_code == 401
    assert "Invalid credentials" in str(exc.value.detail)
