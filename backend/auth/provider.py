import logging
import os
from typing import Optional

import jwt
from fastapi import HTTPException, Request

log = logging.getLogger(__name__)


class AuthProvider:
    """
    Authentication provider that verifies standard JWT tokens (e.g. Supabase, Firebase)
    and static API keys.
    """

    def __init__(self, disabled: bool = False, api_key: str = None):
        self.disabled = disabled
        self.api_key = api_key
        # Supabase and standard providers use HS256 or RS256.
        # Configure this via env variables.
        from backend.core.config import settings

        self.jwt_secret = getattr(settings, "JWT_SECRET", None)
        self.jwt_algorithm = getattr(settings, "JWT_ALGORITHM", "HS256")

    async def verify_request(self, request: Request) -> dict:
        """
        Extracts authentication from request and returns the payload dict (or a mock payload).
        Raises HTTPException if unauthorized.
        """
        payload = await self.try_verify_request(request)
        if payload is not None:
            return payload

        # Check for invalid token error logging
        auth_header = request.headers.get("Authorization")
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        elif request.query_params.get("token"):
            token = request.query_params.get("token")

        if token:
            raise HTTPException(status_code=401, detail="Invalid token")

        raise HTTPException(status_code=401, detail="Unauthorized")

    async def try_verify_request(self, request: Request) -> Optional[dict]:
        """
        Tries to extract and verify authentication without raising exceptions.
        Returns payload dict if authenticated, otherwise None.
        """
        # 1. If auth is disabled, allow requests with default-user
        if self.disabled:
            token = None
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
            elif request.query_params.get("token"):
                token = request.query_params.get("token")
            sub = token if token else "default-user"
            return {"sub": sub, "email": f"{sub}@local.dev"}

        # 2. Check Bearer Token (header or query param)
        auth_header = request.headers.get("Authorization")
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        elif request.query_params.get("token"):
            token = request.query_params.get("token")

        # 3. Check X-API-Key if configured
        if self.api_key:
            api_key_header = request.headers.get("X-API-Key")
            if api_key_header and api_key_header == self.api_key:
                return {"sub": "api-key-user", "email": "api@local.dev"}

        if token:
            try:
                if self.jwt_secret:
                    payload = jwt.decode(
                        token,
                        self.jwt_secret,
                        algorithms=[self.jwt_algorithm],
                        options={"verify_aud": False},
                    )
                else:
                    # No jwt_secret configured: cannot verify signature.
                    # Reject the token rather than accepting it unverified.
                    log.warning(
                        "JWT_SECRET is not configured. Cannot verify token signature. "
                        "Set JWT_SECRET to enable JWT authentication. "
                        "Rejecting token."
                    )
                    return None

                user_id = payload.get("sub")
                if user_id:
                    return payload
            except Exception as jwt_err:
                log.debug(f"Optional token verification failed: {jwt_err}")
                return None

        return None
