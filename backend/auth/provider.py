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
        self.jwt_secret = os.getenv("JWT_SECRET")
        self.jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")

    async def verify_request(self, request: Request) -> str:
        """
        Extracts authentication from request and returns a valid user ID.
        Raises HTTPException if unauthorized.
        """
        if self.disabled:
            # In development/local mode with auth disabled
            return "default-user"

        # 1. Check Static API Key
        api_key_header = request.headers.get("X-API-Key")
        if self.api_key and api_key_header == self.api_key:
            return "api-user"

        # 2. Check Bearer Token (e.g., Supabase JWT)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
            try:
                if self.jwt_secret:
                    # Validate signature, expiration, etc.
                    payload = jwt.decode(
                        token, 
                        self.jwt_secret, 
                        algorithms=[self.jwt_algorithm],
                        options={"verify_aud": False} # Change to True if audience is strictly enforced
                    )
                else:
                    # If no secret is configured, decoding without verification is dangerous.
                    # We should reject unless we explicitly want to support it for local test mode.
                    if os.getenv("APP_ENV") == "development":
                        payload = jwt.decode(token, options={"verify_signature": False})
                    else:
                        log.error("JWT_SECRET is not configured for production.")
                        raise HTTPException(status_code=500, detail="Server Configuration Error")
                
                user_id = payload.get("sub")
                if not user_id:
                    raise HTTPException(status_code=401, detail="Invalid token payload: missing sub")
                
                return user_id
                
            except jwt.ExpiredSignatureError:
                raise HTTPException(status_code=401, detail="Token has expired")
            except jwt.InvalidTokenError as e:
                log.warning(f"Invalid token error: {e}")
                raise HTTPException(status_code=401, detail="Invalid token")

        raise HTTPException(status_code=401, detail="Unauthorized")
