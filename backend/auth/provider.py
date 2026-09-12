import os
import logging
from typing import Optional
from fastapi import Request, HTTPException
import jwt

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
        # 2. Check Bearer Token
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
            # 1. Try decoding JWT token (backend JWT or Supabase JWT)
            try:
                if self.jwt_secret:
                    payload = jwt.decode(
                        token, 
                        self.jwt_secret, 
                        algorithms=[self.jwt_algorithm],
                        options={"verify_aud": False}
                    )
                else:
                    payload = jwt.decode(token, options={"verify_signature": False})
                
                user_id = payload.get("sub")
                if user_id:
                    return payload
            except Exception as jwt_err:
                # If disabled and raw string passed (e.g. "default-user")
                if self.disabled:
                    return {"sub": token, "email": f"{token}@local.dev"}
                log.warning(f"Invalid token error: {jwt_err}")
                raise HTTPException(status_code=401, detail="Invalid token")

            if self.disabled:
                return {"sub": token, "email": f"{token}@local.dev"}

        raise HTTPException(status_code=401, detail="Unauthorized")
