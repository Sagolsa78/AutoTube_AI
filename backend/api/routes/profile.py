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
    default_cta: str
    default_niche: str
    caption_style: str
    watermark_enabled: bool
    watermark_opacity: float
    watermark_position: str
    watermark_scale: float
    default_voice_id: str
    content_tone: str
    niche_keywords: list[str]
    title_style_preference: str
    hashtag_set: list[str]
    auto_approve: bool


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    channel_name: str | None = None
    default_cta: str | None = None
    default_niche: str | None = None
    caption_style: str | None = None
    watermark_enabled: bool | None = None
    watermark_opacity: float | None = None
    watermark_position: str | None = None
    watermark_scale: float | None = None
    default_voice_id: str | None = None
    content_tone: str | None = None
    niche_keywords: list[str] | None = None
    title_style_preference: str | None = None
    hashtag_set: list[str] | None = None
    auto_approve: bool | None = None


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
        "default_cta":       p.default_cta or "Follow for more!",
        "default_niche":     p.default_niche or "science_wow",
        "caption_style":     p.caption_style or "bold_centered",
        "watermark_enabled": p.watermark_enabled if p.watermark_enabled is not None else True,
        "watermark_opacity": p.watermark_opacity or 0.4,
        "watermark_position": p.watermark_position or "bottom_right",
        "watermark_scale":   p.watermark_scale or 0.12,
        "default_voice_id":  p.default_voice_id or "en-US-ChristopherNeural",
        "content_tone":      p.content_tone or "casual",
        "niche_keywords":    p.niche_keywords or [],
        "title_style_preference": p.title_style_preference or "curiosity",
        "hashtag_set":       p.hashtag_set or ["shorts", "viral"],
        "auto_approve":      p.auto_approve if p.auto_approve is not None else False,
    }
