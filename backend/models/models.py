"""
SQLAlchemy async models for AutoShorts Studio.
Covers: users, channels, ideas, scripts, scenes, assets, videos, publications, analytics, jobs.
"""
from __future__ import annotations
import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean,
    DateTime, ForeignKey, Text, Enum as SAEnum, JSON
)
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.ext.asyncio import AsyncAttrs


def _uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(AsyncAttrs, DeclarativeBase):
    pass


# ── Enums ─────────────────────────────────────────────────────────────────────

class IdeaStatus(str, enum.Enum):
    pending   = "pending"
    discarded = "discarded"
    promoted  = "promoted"

class ScriptStatus(str, enum.Enum):
    draft          = "draft"
    discarded      = "discarded"
    used_in_render = "used_in_render"

class VideoStatus(str, enum.Enum):
    pending    = "pending"
    rendering  = "rendering"
    paused     = "paused"
    ready      = "ready"
    approved   = "approved"
    rejected   = "rejected"
    uploaded   = "uploaded"
    failed     = "failed"
    cancelled  = "cancelled"
    publish_failed = "publish_failed"

class PrivacyStatus(str, enum.Enum):
    private   = "private"
    unlisted  = "unlisted"
    public    = "public"


# ── Auth & Users ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id              = Column(String, primary_key=True, default=_uuid)
    email           = Column(String, unique=True, index=True, nullable=True) # Mapped from auth provider
    display_name    = Column(String, nullable=False, default="Creator")
    channel_name    = Column(String, default="")
    logo_path       = Column(String)
    password_hash   = Column(String, nullable=True)
    preferred_ai_provider = Column(String, default="ollama")
    preferred_ai_model    = Column(String, default="qwen2.5-coder:7b")
    
    created_at      = Column(DateTime(timezone=True), default=utc_now)
    updated_at      = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    channels = relationship("Channel", back_populates="user", cascade="all, delete-orphan")
    youtube_connections = relationship("YouTubeConnection", back_populates="user", cascade="all, delete-orphan")

UserProfile = User  # Legacy alias for backward compatibility


class YouTubeConnection(Base):
    """Stores encrypted OAuth credentials for YouTube publishing."""
    __tablename__ = "youtube_connections"
    
    id            = Column(String, primary_key=True, default=_uuid)
    user_id       = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_id    = Column(String, nullable=True) # YT Channel ID
    channel_title = Column(String, nullable=True)
    access_token  = Column(Text, nullable=False)  # Consider encrypting in production
    refresh_token = Column(Text, nullable=True)
    expires_at    = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), default=utc_now)
    updated_at    = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="youtube_connections")


# ── Tables ────────────────────────────────────────────────────────────────────

class Channel(Base):
    __tablename__ = "channels"

    id         = Column(String, primary_key=True, default=_uuid)
    user_id    = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name       = Column(String, nullable=False)
    niche      = Column(String, nullable=False)
    language   = Column(String, default="en")
    
    default_cta     = Column(Text, default="Follow for more!")
    caption_style   = Column(String, default="bold_centered")
    watermark_enabled = Column(Boolean, default=True)
    watermark_opacity = Column(Float, default=0.4)
    watermark_position = Column(String, default="bottom_right")
    watermark_scale  = Column(Float, default=0.12)
    
    # Settings
    default_voice_id = Column(String, default="en-US-ChristopherNeural")
    content_tone     = Column(String, default="casual")
    niche_keywords   = Column(JSON, default=list)
    title_style_preference = Column(String, default="curiosity")
    hashtag_set      = Column(JSON, default=lambda: ["shorts", "viral"])
    auto_approve     = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user  = relationship("User", back_populates="channels")
    ideas = relationship("Idea", back_populates="channel", cascade="all, delete-orphan")


class Idea(Base):
    __tablename__ = "ideas"

    id         = Column(String, primary_key=True, default=_uuid)
    user_id    = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_id = Column(String, ForeignKey("channels.id"), nullable=False)
    title      = Column(String, nullable=False)
    topic      = Column(String, nullable=False)
    angle      = Column(Text)
    status     = Column(SAEnum(IdeaStatus), default=IdeaStatus.pending)
    score      = Column(Float, default=0.0)
    notes      = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    channel = relationship("Channel", back_populates="ideas")
    scripts = relationship("Script", back_populates="idea", cascade="all, delete-orphan")


class Script(Base):
    __tablename__ = "scripts"

    id               = Column(String, primary_key=True, default=_uuid)
    user_id          = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    idea_id          = Column(String, ForeignKey("ideas.id"), nullable=False)
    status           = Column(SAEnum(ScriptStatus), default=ScriptStatus.draft)
    hook             = Column(Text)
    body             = Column(JSON)          # list of sentences or scene specs
    payoff           = Column(Text)
    cta              = Column(Text)
    full_text        = Column(Text)
    visual_prompts   = Column(JSON)
    duration_est     = Column(Float)
    quality_score    = Column(Float, default=0.0)
    fact_check_ok    = Column(Boolean, default=False)
    provider_used    = Column(String)
    created_at       = Column(DateTime(timezone=True), default=utc_now)

    idea   = relationship("Idea", back_populates="scripts")
    assets = relationship("Asset", back_populates="script", cascade="all, delete-orphan")
    videos = relationship("Video", back_populates="script", cascade="all, delete-orphan")
    scenes = relationship("Scene", back_populates="script", cascade="all, delete-orphan", order_by="Scene.scene_number")


class Scene(Base):
    __tablename__ = "scenes"

    id                 = Column(String, primary_key=True, default=_uuid)
    user_id            = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    script_id          = Column(String, ForeignKey("scripts.id", ondelete="CASCADE"), nullable=False)
    scene_number       = Column(Integer, nullable=False)
    narration          = Column(Text)
    visual_description = Column(Text)
    asset_id           = Column(String, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    duration_est       = Column(Float, nullable=True)
    created_at         = Column(DateTime(timezone=True), default=utc_now)

    script = relationship("Script", back_populates="scenes")
    asset  = relationship("Asset")


class Asset(Base):
    __tablename__ = "assets"

    id                 = Column(String, primary_key=True, default=_uuid)
    user_id            = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    script_id          = Column(String, ForeignKey("scripts.id"), nullable=True)
    source_asset_id    = Column(String, index=True)
    asset_type         = Column(String)
    source             = Column(String)
    path               = Column(String)
    url                = Column(String)
    thumbnail_url      = Column(String)
    license            = Column(String)
    commercial_ok      = Column(Boolean, default=True)
    attribution_req    = Column(Boolean, default=False)
    creator            = Column(String)
    asset_metadata     = Column(JSON)
    created_at         = Column(DateTime(timezone=True), default=utc_now)

    script = relationship("Script", back_populates="assets")


class Video(Base):
    __tablename__ = "videos"

    id             = Column(String, primary_key=True, default=_uuid)
    user_id        = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    script_id      = Column(String, ForeignKey("scripts.id"), nullable=False)
    path           = Column(String)
    duration       = Column(Float)
    style          = Column(String)
    caption_style  = Column(String, default="bold_centered")
    status         = Column(SAEnum(VideoStatus), default=VideoStatus.pending)
    ai_used        = Column(Boolean, default=True)
    notes          = Column(Text)

    render_stage   = Column(String, default="queued")
    render_progress = Column(Float, default=0.0)
    
    title_candidates = Column(JSON, default=list)
    selected_title   = Column(String)
    description      = Column(Text)
    hashtags         = Column(JSON, default=list)
    voice_override   = Column(String)
    
    created_at     = Column(DateTime(timezone=True), default=utc_now)

    script      = relationship("Script", back_populates="videos")
    publication = relationship("Publication", back_populates="video", uselist=False)
    analytics   = relationship("Analytics", back_populates="video", cascade="all, delete-orphan")


class Publication(Base):
    __tablename__ = "publications"

    id             = Column(String, primary_key=True, default=_uuid)
    user_id        = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    video_id       = Column(String, ForeignKey("videos.id"), nullable=False, unique=True)
    youtube_id     = Column(String)
    url            = Column(String)
    title          = Column(String)
    description    = Column(Text)
    tags           = Column(JSON)
    privacy_status = Column(SAEnum(PrivacyStatus), default=PrivacyStatus.private)
    published_at   = Column(DateTime(timezone=True))
    status         = Column(String, default="pending")
    
    video = relationship("Video", back_populates="publication")


class Analytics(Base):
    __tablename__ = "analytics"

    id          = Column(String, primary_key=True, default=_uuid)
    user_id     = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    video_id    = Column(String, ForeignKey("videos.id"), nullable=False)
    views       = Column(Integer, default=0)
    likes       = Column(Integer, default=0)
    comments    = Column(Integer, default=0)
    shares      = Column(Integer, default=0)
    subscribers = Column(Integer, default=0)
    retention   = Column(Float)
    recorded_at = Column(DateTime(timezone=True), default=utc_now)

    video = relationship("Video", back_populates="analytics")


class AnalyticsSnapshot(Base):
    __tablename__ = "analytics_snapshots"

    id          = Column(String, primary_key=True, default=_uuid)
    user_id     = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    video_id    = Column(String, ForeignKey("videos.id"), nullable=False)
    date        = Column(DateTime(timezone=True), default=utc_now)
    views       = Column(Integer, default=0)
    likes       = Column(Integer, default=0)
    subscribers = Column(Integer, default=0)

    video = relationship("Video")


# ── Compute Plane / Job Models ────────────────────────────────────────────────

class JobStatus(str, enum.Enum):
    queued                   = "queued"
    dispatched               = "dispatched"
    running                  = "running"
    completed                = "completed"
    failed                   = "failed"
    cancelled                = "cancelled"
    waiting_for_local_worker = "waiting_for_local_worker"


class Job(Base):
    __tablename__ = "jobs"

    id            = Column(String, primary_key=True, default=_uuid)
    user_id       = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    capability    = Column(String, nullable=False, index=True)
    status        = Column(String, default="queued", index=True)
    payload       = Column(JSON, default=dict)
    result        = Column(JSON, default=dict)
    worker_id     = Column(String, nullable=True)
    worker_type   = Column(String, default="local")
    cost_usd      = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)
    created_at    = Column(DateTime(timezone=True), default=utc_now)
    started_at    = Column(DateTime(timezone=True), nullable=True)
    completed_at  = Column(DateTime(timezone=True), nullable=True)


class DailyComputeSpend(Base):
    __tablename__ = "daily_compute_spend"

    id               = Column(String, primary_key=True, default=_uuid)
    date             = Column(String, index=True, unique=True)
    amount_spent_usd = Column(Float, default=0.0)
    budget_cap_usd   = Column(Float, default=2.0)
    jobs_count       = Column(Integer, default=0)
    created_at       = Column(DateTime(timezone=True), default=utc_now)
    updated_at       = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
