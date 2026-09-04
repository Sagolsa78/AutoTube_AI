"""
User profile router — manage display name, default CTA, logo/watermark, caption style.
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
from backend.models.models import UserProfile
from backend.settings import STORAGE
from engine.captions.styles import list_caption_styles

router = APIRouter()

LOGO_DIR = STORAGE / "logos"
LOGO_DIR.mkdir(parents=True, exist_ok=True)

# For the MVP we use a single-user profile.  The first row created becomes
# "the" profile.  Multi-user can be layered on later with auth middleware.
DEFAULT_PROFILE_ID = "default-user"


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


async def _ensure_profile(db: AsyncSession) -> UserProfile:
    """Return the singleton user profile, creating it if needed."""
    profile = await db.get(UserProfile, DEFAULT_PROFILE_ID)
    if not profile:
        profile = UserProfile(id=DEFAULT_PROFILE_ID)
        db.add(profile)
        await db.flush()
    return profile


@router.get("/", response_model=ProfileOut)
async def get_profile(db: AsyncSession = Depends(get_db)):
    profile = await _ensure_profile(db)
    return _fmt(profile)


@router.patch("/", response_model=ProfileOut)
async def update_profile(body: ProfileUpdate, db: AsyncSession = Depends(get_db)):
    profile = await _ensure_profile(db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.flush()
    return _fmt(profile)


@router.post("/logo", response_model=ProfileOut)
async def upload_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PNG/JPEG logo to use as watermark in rendered videos."""
    profile = await _ensure_profile(db)

    ext = Path(file.filename or "logo.png").suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(400, "Logo must be PNG, JPEG, or WebP")

    filename = f"logo_{uuid.uuid4().hex[:8]}{ext}"
    dest = LOGO_DIR / filename

    # Delete old logo file
    if profile.logo_path and Path(profile.logo_path).exists():
        try:
            os.remove(profile.logo_path)
        except OSError:
            pass

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    profile.logo_path = str(dest)
    await db.flush()
    return _fmt(profile)


@router.delete("/logo", response_model=ProfileOut)
async def delete_logo(db: AsyncSession = Depends(get_db)):
    profile = await _ensure_profile(db)
    if profile.logo_path and Path(profile.logo_path).exists():
        try:
            os.remove(profile.logo_path)
        except OSError:
            pass
    profile.logo_path = None
    await db.flush()
    return _fmt(profile)


@router.get("/caption-styles")
async def get_caption_styles():
    """Return all available caption style presets for the frontend selector."""
    return list_caption_styles()


def _fmt(p: UserProfile) -> dict:
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
