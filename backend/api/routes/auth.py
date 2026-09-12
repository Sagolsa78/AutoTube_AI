"""
Authentication & Multi-User Management Router.
Provides native registration, login, profile retrieval, and AI model preferences.
"""
from __future__ import annotations
import os
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.db.database import get_db
from backend.models.models import User, Channel
from backend.auth.dependencies import get_current_user
from integrations.providers.ai_providers import get_available_models

log = logging.getLogger(__name__)
router = APIRouter()

# ── Password Utilities ─────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}:{dk.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password or ":" not in hashed_password:
        return False
    salt, stored_hash = hashed_password.split(":", 1)
    dk = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return dk.hex() == stored_hash

def create_access_token(user_id: str, email: str, expires_days: int = 30) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=expires_days)).timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = "Creator"
    channel_name: Optional[str] = "My Shorts Channel"
    niche: Optional[str] = "science_wow"

class LoginIn(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: str
    email: Optional[str] = None
    display_name: str
    channel_name: Optional[str] = None
    preferred_ai_provider: Optional[str] = "ollama"
    preferred_ai_model: Optional[str] = "qwen2.5-coder:7b"

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class AiSettingsIn(BaseModel):
    provider: str
    model: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterIn, db: AsyncSession = Depends(get_db)):
    """Register a new user account with default channel."""
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")

    # Check if email is taken
    q = select(User).where(User.email == body.email.lower().strip())
    existing = (await db.execute(q)).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    # Create User
    pwd_hash = hash_password(body.password)
    new_user = User(
        email=body.email.lower().strip(),
        display_name=body.display_name or body.email.split("@")[0],
        channel_name=body.channel_name or "My Shorts Channel",
        password_hash=pwd_hash,
        preferred_ai_provider=settings.DEFAULT_AI_PROVIDER,
        preferred_ai_model=settings.DEFAULT_AI_MODEL,
    )
    db.add(new_user)
    await db.flush()

    # Create Initial Default Channel
    channel = Channel(
        user_id=new_user.id,
        name=body.channel_name or f"{new_user.display_name}'s Channel",
        niche=body.niche or "science_wow",
        niche_keywords=["science", "facts", "mystery"],
        content_tone="engaging",
        watermark_enabled=False,
    )
    db.add(channel)
    await db.commit()
    await db.refresh(new_user)

    token = create_access_token(new_user.id, new_user.email)
    return AuthResponse(
        access_token=token,
        user=UserOut(
            id=new_user.id,
            email=new_user.email,
            display_name=new_user.display_name,
            channel_name=new_user.channel_name,
            preferred_ai_provider=new_user.preferred_ai_provider or "ollama",
            preferred_ai_model=new_user.preferred_ai_model or "qwen2.5-coder:7b",
        )
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    """Authenticate with email and password."""
    email_clean = body.email.lower().strip()
    q = select(User).where(User.email == email_clean)
    user = (await db.execute(q)).scalars().first()

    # If no account exists and running in dev mode with default user requested
    if not user:
        if email_clean in ("default@local.dev", "admin@autotube.ai", "user@local.dev") and settings.AUTH_DISABLED:
            # Auto-provision local dev user
            user = User(
                email=email_clean,
                display_name=email_clean.split("@")[0].capitalize(),
                channel_name="Dev Studio Channel",
                password_hash=hash_password("password123"),
            )
            db.add(user)
            await db.flush()
            # Default channel
            ch = Channel(user_id=user.id, name="Dev Studio Channel", niche="science_wow")
            db.add(ch)
            await db.commit()
            await db.refresh(user)
        else:
            raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.password_hash and not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id, user.email or email_clean)
    return AuthResponse(
        access_token=token,
        user=UserOut(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            channel_name=user.channel_name,
            preferred_ai_provider=user.preferred_ai_provider or "ollama",
            preferred_ai_model=user.preferred_ai_model or "qwen2.5-coder:7b",
        )
    )


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    """Return the profile of the current authenticated user."""
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        channel_name=user.channel_name,
        preferred_ai_provider=user.preferred_ai_provider or "ollama",
        preferred_ai_model=user.preferred_ai_model or "qwen2.5-coder:7b",
    )


@router.get("/models")
async def list_available_models(user: User = Depends(get_current_user)):
    """List available AI models and report current active user model preference."""
    providers = get_available_models()
    return {
        "providers": providers,
        "user_preference": {
            "preferred_ai_provider": user.preferred_ai_provider or settings.DEFAULT_AI_PROVIDER,
            "preferred_ai_model": user.preferred_ai_model or settings.DEFAULT_AI_MODEL,
        },
        "default_provider": settings.DEFAULT_AI_PROVIDER,
        "default_model": settings.DEFAULT_AI_MODEL,
    }


@router.patch("/ai-settings")
async def update_ai_settings(
    body: AiSettingsIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Save user's preferred AI provider and model."""
    user.preferred_ai_provider = body.provider
    if body.model:
        user.preferred_ai_model = body.model
    await db.commit()
    await db.refresh(user)
    return {
        "status": "success",
        "preferred_ai_provider": user.preferred_ai_provider,
        "preferred_ai_model": user.preferred_ai_model,
    }
