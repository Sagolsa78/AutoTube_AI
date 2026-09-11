import logging
from typing import Optional
from fastapi import Request

log = logging.getLogger(__name__)

class AuthProvider:
    """
    Base authentication provider.
    Currently a mock/stub that returns a default user ID if auth is disabled,
    or verifies a static API key / JWT token depending on configuration.
    """
    
    def __init__(self, disabled: bool = False, api_key: str = None):
        self.disabled = disabled
        self.api_key = api_key

    async def verify_request(self, request: Request) -> str:
        """
        Extracts authentication from request and returns a valid user ID.
        Raises HTTPException if unauthorized.
        """
        if self.disabled:
            # Return a default user ID for local development
            return "default-user"

        auth_header = request.headers.get("Authorization")
        
        # 1. Check Bearer Token (e.g., Supabase JWT)
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            # In a real implementation, verify JWT signature here
            # For now, we trust the subject of the token (if we implement JWT decoding)
            # return decode_jwt(token)["sub"]
            pass
            
        # 2. Check Static API Key
        api_key_header = request.headers.get("X-API-Key")
        if self.api_key and api_key_header == self.api_key:
            return "api-user"
            
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Unauthorized")
