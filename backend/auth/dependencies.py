import logging
from fastapi import Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.auth.provider import AuthProvider
from backend.core.config import settings
from backend.db.database import get_db
from backend.models.models import User

log = logging.getLogger(__name__)

# Initialize the configured auth provider
auth_provider = AuthProvider(
    disabled=settings.AUTH_DISABLED,
    api_key=settings.AUTOTUBE_API_KEY
)

async def get_current_user_id(request: Request) -> str:
    """FastAPI dependency to extract and verify the user ID from the request."""
    return await auth_provider.verify_request(request)

async def get_current_user(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> User:
    """FastAPI dependency that returns the authenticated User object."""
    user = await db.get(User, user_id)
    if not user:
        # Auto-provision user on first access if auth is disabled (local dev)
        if settings.AUTH_DISABLED and user_id == "default-user":
            user = User(id="default-user", display_name="Local Creator")
            db.add(user)
            await db.commit()
            return user
            
        raise HTTPException(status_code=401, detail="User profile not found")
    return user
