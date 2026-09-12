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

async def get_current_user_payload(request: Request) -> dict:
    """FastAPI dependency to extract and verify the user payload from the request."""
    return await auth_provider.verify_request(request)

async def get_current_user(
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
) -> User:
    """FastAPI dependency that returns the authenticated User object."""
    user_id = payload.get("sub")
    user = await db.get(User, user_id)
    if not user:
        # Auto-provision user on first access
        email = payload.get("email")
        display_name = email.split('@')[0] if email else f"User {user_id[:6]}"
        user = User(id=user_id, email=email, display_name=display_name)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user
