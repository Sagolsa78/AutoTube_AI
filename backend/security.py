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

from backend.core.config import settings

API_KEY = settings.AUTOTUBE_API_KEY
AUTH_DISABLED = settings.AUTH_DISABLED
APP_ENV = settings.APP_ENV


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


# ── Encryption Helpers ────────────────────────────────────────────────────────

from cryptography.fernet import Fernet
import base64
import hashlib


def _derive_dev_key() -> str:
    """
    Derive a valid Fernet key from a fixed dev seed.
    This is ONLY used when ENCRYPTION_KEY is not configured (local dev).
    NEVER use this in production.
    """
    seed = b"autotube-local-dev-encryption-key-do-not-use-in-prod"
    raw = hashlib.sha256(seed).digest()  # 32 bytes
    return base64.urlsafe_b64encode(raw).decode('utf-8')


def _load_encryption_key() -> Optional[str]:
    """Load and validate the encryption key from settings."""
    key = getattr(settings, "ENCRYPTION_KEY", None)
    if key:
        # Validate the provided key is proper Fernet format
        try:
            Fernet(key.encode('utf-8'))
            return key
        except (ValueError, Exception):
            log.error(
                "ENCRYPTION_KEY is set but is NOT a valid Fernet key. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
            # In cloud/production mode, fail hard if key is invalid
            if APP_ENV == "production":
                raise RuntimeError("Invalid ENCRYPTION_KEY in production mode. Cannot proceed without proper token encryption.")
            return None

    # No key configured — use derived dev key with warning
    if APP_ENV == "production":
        log.error(
            "ENCRYPTION_KEY is not set in production mode! "
            "YouTube OAuth tokens will NOT be encrypted. "
            "Set ENCRYPTION_KEY to a valid Fernet key immediately."
        )
        return None
    else:
        log.warning(
            "ENCRYPTION_KEY not configured. Using derived dev key. "
            "This is ONLY acceptable in local development."
        )
        return _derive_dev_key()


_ENCRYPTION_KEY = _load_encryption_key()


def get_fernet() -> Optional[Fernet]:
    """Return a configured Fernet instance, or None if encryption is unavailable."""
    if not _ENCRYPTION_KEY:
        return None
    try:
        return Fernet(_ENCRYPTION_KEY.encode('utf-8'))
    except Exception as e:
        log.error(f"Failed to create Fernet instance: {e}")
        return None


def encrypt_value(value: str) -> str:
    """Encrypt a string value. Returns plaintext if encryption is not configured."""
    if not value:
        return value
    f = get_fernet()
    if not f:
        log.warning("encrypt_value called but Fernet is not available — returning plaintext (insecure!)")
        return value
    return f.encrypt(value.encode('utf-8')).decode('utf-8')


def decrypt_value(encrypted_value: str) -> str:
    """Decrypt a Fernet-encrypted value. Returns the input unchanged if decryption fails or is unavailable."""
    if not encrypted_value:
        return encrypted_value
    f = get_fernet()
    if not f:
        return encrypted_value
    try:
        return f.decrypt(encrypted_value.encode('utf-8')).decode('utf-8')
    except Exception as e:
        log.warning(f"Decryption failed (may be stored as plaintext): {e}")
        return encrypted_value
