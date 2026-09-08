"""
Control Plane Security & Authentication (§10 Phase 1).
Supports:
  - Header API Key ('X-API-Key')
  - Bearer Token ('Authorization: Bearer <TOKEN>')
  - Cloudflare Access Identity assertions ('Cf-Access-Jwt-Assertion')
  - Automatic zero-friction bypass in local dev (APP_ENV=development or AUTH_DISABLED=true)
"""
from __future__ import annotations
import os
import logging
from typing import Optional

from fastapi import Security, HTTPException, status, Request
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials

log = logging.getLogger(__name__)

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
http_bearer = HTTPBearer(auto_error=False)

API_KEY = os.getenv("AUTOTUBE_API_KEY") or os.getenv("API_KEY", "")
AUTH_DISABLED = os.getenv("AUTH_DISABLED", "false").lower() in ("true", "1", "yes")
APP_ENV = os.getenv("APP_ENV", "development")


async def verify_control_plane_auth(
    request: Request,
    api_key: Optional[str] = Security(api_key_header),
    bearer: Optional[HTTPAuthorizationCredentials] = Security(http_bearer)
) -> bool:
    """
    Dependency that enforces control plane authentication when exposed to the cloud.
    Allows zero-config bypass in development mode.
    """
    # 1. Bypass if explicitly disabled or development without key configured
    if AUTH_DISABLED or (APP_ENV == "development" and not API_KEY):
        return True

    # 2. Check Cloudflare Access Assertion (edge authenticated)
    cf_jwt = request.headers.get("Cf-Access-Jwt-Assertion")
    cf_email = request.headers.get("Cf-Access-Authenticated-User-Email")
    if cf_jwt or cf_email:
        # Edge verified by Cloudflare Access
        return True

    # 3. Check X-API-Key header
    if api_key and API_KEY and api_key == API_KEY:
        return True

    # 4. Check Bearer Token
    if bearer and API_KEY and bearer.credentials == API_KEY:
        return True

    # 5. Unauthorized
    log.warning(f"Unauthorized API request to {request.url.path} from {request.client.host if request.client else 'unknown'}")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication credentials for AutoTube Control Plane.",
        headers={"WWW-Authenticate": "Bearer"},
    )
