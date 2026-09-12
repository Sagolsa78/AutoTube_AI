"""
User profile router — manage display name, default CTA, logo/watermark, caption style.
Now fully supports multi-tenant users.
"""
from __future__ import annotations
import os
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.models.models import User
from backend.core.config import settings
from engine.captions.styles import list_caption_styles
from backend.auth.dependencies import get_current_user

router = APIRouter()

LOGO_DIR = Path(settings.STORAGE_ROOT) / "logos"
LOGO_DIR.mkdir(parents=True, exist_ok=True)


class ProfileOut(BaseModel):
    id: str
    display_name: str
    channel_name: str
    logo_path: str | None

class ProfileUpdate(BaseModel):
    display_name: str | None = None
    channel_name: str | None = None


@router.get("/", response_model=ProfileOut)
async def get_profile(user: User = Depends(get_current_user)):
    return _fmt(user)


@router.patch("/", response_model=ProfileOut)
async def update_profile(
    body: ProfileUpdate, 
    user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.flush()
    return _fmt(user)


@router.post("/logo", response_model=ProfileOut)
async def upload_logo(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PNG/JPEG logo to use as watermark in rendered videos."""
    ext = Path(file.filename or "logo.png").suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(400, "Logo must be PNG, JPEG, or WebP")

    filename = f"logo_{user.id}_{uuid.uuid4().hex[:8]}{ext}"
    dest = LOGO_DIR / filename

    # Delete old logo file
    if user.logo_path and Path(user.logo_path).exists():
        try:
            os.remove(user.logo_path)
        except OSError:
            pass

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    user.logo_path = str(dest)
    await db.flush()
    return _fmt(user)


@router.delete("/logo", response_model=ProfileOut)
async def delete_logo(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if user.logo_path and Path(user.logo_path).exists():
        try:
            os.remove(user.logo_path)
        except OSError:
            pass
    user.logo_path = None
    await db.flush()
    return _fmt(user)


@router.get("/caption-styles")
async def get_caption_styles():
    """Return all available caption style presets for the frontend selector."""
    return list_caption_styles()


def _fmt(p: User) -> dict:
    return {
        "id":                 p.id,
        "display_name":      p.display_name or "Creator",
        "channel_name":      p.channel_name or "",
        "logo_path":         p.logo_path,
    }
