"""
SQLAlchemy async models for AutoShorts Studio.
Covers: user_profiles, channels, ideas, scripts, assets, videos, publications, analytics.
"""
from __future__ import annotations
import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean,
    DateTime, ForeignKey, Text, Enum as SAEnum, JSON
)
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.ext.asyncio import AsyncAttrs


def _uuid() -> str:
    return str(uuid.uuid4())

DEFAULT_PROFILE_ID = "default-user"

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
    ready      = "ready"
    approved   = "approved"
    rejected   = "rejected"
    uploaded   = "uploaded"
    failed     = "failed"
    publish_failed = "publish_failed"


class PrivacyStatus(str, enum.Enum):
    private   = "private"
    unlisted  = "unlisted"
    public    = "public"


# ── User Profile ──────────────────────────────────────────────────────────────

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id              = Column(String, primary_key=True, default=_uuid)
    display_name    = Column(String, nullable=False, default="Creator")
    channel_name    = Column(String, default="")
    logo_path       = Column(String)            # path to uploaded logo for watermark
    default_cta     = Column(Text, default="Follow for more!")
    default_niche   = Column(String, default="science_wow")
    caption_style   = Column(String, default="bold_centered")  # chosen style key
    watermark_enabled = Column(Boolean, default=True)
    watermark_opacity = Column(Float, default=0.4)
    watermark_position = Column(String, default="bottom_right")  # bottom_right, bottom_left, top_right, top_left
    watermark_scale  = Column(Float, default=0.12)   # fraction of video width
    
    # New Settings
    default_voice_id = Column(String, default="en-US-ChristopherNeural")
    content_tone     = Column(String, default="casual")
    niche_keywords   = Column(JSON, default=list) # e.g. ["science", "space", "facts"]
    title_style_preference = Column(String, default="curiosity")
    hashtag_set      = Column(JSON, default=lambda: ["shorts", "viral"])
    auto_approve     = Column(Boolean, default=False)
    
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Tables ────────────────────────────────────────────────────────────────────

class Channel(Base):
    __tablename__ = "channels"

    id         = Column(String, primary_key=True, default=_uuid)
    name       = Column(String, nullable=False)
    niche      = Column(String, nullable=False)
    language   = Column(String, default="en")
    created_at = Column(DateTime, default=datetime.utcnow)
    tenant_id  = Column(String, index=True, default=DEFAULT_PROFILE_ID)

    ideas = relationship("Idea", back_populates="channel", cascade="all, delete-orphan")


class Idea(Base):
    __tablename__ = "ideas"

    id         = Column(String, primary_key=True, default=_uuid)
    channel_id = Column(String, ForeignKey("channels.id"), nullable=False)
    title      = Column(String, nullable=False)
    topic      = Column(String, nullable=False)
    angle      = Column(Text)
    status     = Column(SAEnum(IdeaStatus), default=IdeaStatus.pending)
    score      = Column(Float, default=0.0)
    notes      = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    tenant_id  = Column(String, index=True, default=DEFAULT_PROFILE_ID)

    channel = relationship("Channel", back_populates="ideas")
    scripts = relationship("Script", back_populates="idea", cascade="all, delete-orphan")


class Script(Base):
    __tablename__ = "scripts"

    id               = Column(String, primary_key=True, default=_uuid)
    idea_id          = Column(String, ForeignKey("ideas.id"), nullable=False)
    status           = Column(SAEnum(ScriptStatus), default=ScriptStatus.draft)
    hook             = Column(Text)
    body             = Column(JSON)          # list of sentences
    payoff           = Column(Text)
    cta              = Column(Text)
    full_text        = Column(Text)
    visual_prompts   = Column(JSON)          # list of search keywords per beat
    duration_est     = Column(Float)         # estimated seconds
    quality_score    = Column(Float, default=0.0)
    fact_check_ok    = Column(Boolean, default=False)
    provider_used    = Column(String)        # which AI provider generated it
    created_at       = Column(DateTime, default=datetime.utcnow)
    tenant_id        = Column(String, index=True, default=DEFAULT_PROFILE_ID)

    idea   = relationship("Idea", back_populates="scripts")
    assets = relationship("Asset", back_populates="script", cascade="all, delete-orphan")
    videos = relationship("Video", back_populates="script", cascade="all, delete-orphan")
    scenes = relationship("Scene", back_populates="script", cascade="all, delete-orphan", order_by="Scene.scene_number")


class Scene(Base):
    __tablename__ = "scenes"

    id                 = Column(String, primary_key=True, default=_uuid)
    script_id          = Column(String, ForeignKey("scripts.id", ondelete="CASCADE"), nullable=False)
    scene_number       = Column(Integer, nullable=False)
    narration          = Column(Text)
    visual_description = Column(Text)
    asset_id           = Column(String, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    duration_est       = Column(Float, nullable=True)
    created_at         = Column(DateTime, default=datetime.utcnow)
    tenant_id          = Column(String, index=True, default=DEFAULT_PROFILE_ID)

    script = relationship("Script", back_populates="scenes")
    asset  = relationship("Asset")


class Asset(Base):
    __tablename__ = "assets"

    id                 = Column(String, primary_key=True, default=_uuid)
    script_id          = Column(String, ForeignKey("scripts.id"), nullable=True) # Nullable for globally cached assets
    source_asset_id    = Column(String, index=True) # Provider's original ID (e.g., Pexels ID)
    asset_type         = Column(String)    # video_clip | image | audio | music
    source             = Column(String)    # pexels | pixabay | local | generated
    path               = Column(String)
    url                = Column(String)
    thumbnail_url      = Column(String)    # For UI previews
    license            = Column(String)
    commercial_ok      = Column(Boolean, default=True)
    attribution_req    = Column(Boolean, default=False)
    creator            = Column(String)
    asset_metadata     = Column(JSON)      # Store full provider JSON here
    created_at         = Column(DateTime, default=datetime.utcnow)
    tenant_id          = Column(String, index=True, default=DEFAULT_PROFILE_ID)

    script = relationship("Script", back_populates="assets")


class Video(Base):
    __tablename__ = "videos"

    id             = Column(String, primary_key=True, default=_uuid)
    script_id      = Column(String, ForeignKey("scripts.id"), nullable=False)
    path           = Column(String)
    duration       = Column(Float)
    style          = Column(String)            # documentary | fast_facts | cinematic | minimal
    caption_style  = Column(String, default="bold_centered")
    status         = Column(SAEnum(VideoStatus), default=VideoStatus.pending)
    ai_used        = Column(Boolean, default=True)
    notes          = Column(Text)

    # Render progress tracking
    render_stage   = Column(String, default="queued")    # queued|tts|visuals|assembly|metadata|done|failed
    render_progress = Column(Float, default=0.0)         # 0-100 within current stage
    
    # Metadata Generation
    title_candidates = Column(JSON, default=list)
    selected_title   = Column(String)
    description      = Column(Text)
    hashtags         = Column(JSON, default=list)
    voice_override   = Column(String)
    
    created_at     = Column(DateTime, default=datetime.utcnow)
    tenant_id      = Column(String, index=True, default=DEFAULT_PROFILE_ID) # Multi-tenant isolation

    script      = relationship("Script", back_populates="videos")
    publication = relationship("Publication", back_populates="video", uselist=False)
    analytics   = relationship("Analytics", back_populates="video", cascade="all, delete-orphan")


class Publication(Base):
    __tablename__ = "publications"

    id             = Column(String, primary_key=True, default=_uuid)
    video_id       = Column(String, ForeignKey("videos.id"), nullable=False, unique=True)
    youtube_id     = Column(String)
    url            = Column(String)
    title          = Column(String)
    description    = Column(Text)
    tags           = Column(JSON)
    privacy_status = Column(SAEnum(PrivacyStatus), default=PrivacyStatus.private)
    published_at   = Column(DateTime)
    status         = Column(String, default="pending")   # pending|live|removed
    tenant_id      = Column(String, index=True, default=DEFAULT_PROFILE_ID)

    video = relationship("Video", back_populates="publication")


class Analytics(Base):
    __tablename__ = "analytics"

    id          = Column(String, primary_key=True, default=_uuid)
    video_id    = Column(String, ForeignKey("videos.id"), nullable=False)
    views       = Column(Integer, default=0)
    likes       = Column(Integer, default=0)
    comments    = Column(Integer, default=0)
    shares      = Column(Integer, default=0)
    subscribers = Column(Integer, default=0)
    retention   = Column(Float)        # average percentage viewed
    recorded_at = Column(DateTime, default=datetime.utcnow)
    tenant_id   = Column(String, index=True, default=DEFAULT_PROFILE_ID)

    video = relationship("Video", back_populates="analytics")

class AnalyticsSnapshot(Base):
    """Stores historical time-series analytics for drawing graphs."""
    __tablename__ = "analytics_snapshots"

    id          = Column(String, primary_key=True, default=_uuid)
    video_id    = Column(String, ForeignKey("videos.id"), nullable=False)
    date        = Column(DateTime, default=datetime.utcnow)
    views       = Column(Integer, default=0)
    likes       = Column(Integer, default=0)
    subscribers = Column(Integer, default=0)
    tenant_id   = Column(String, index=True, default=DEFAULT_PROFILE_ID)

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
    """
    Asynchronous compute job dispatched to local RTX 3050 or Cloud RunPod GPU.
    PostgreSQL is the single source of truth for job lifecycle.
    """
    __tablename__ = "jobs"

    id            = Column(String, primary_key=True, default=_uuid)
    capability    = Column(String, nullable=False, index=True) # LLM, TTS, IMAGE, VIDEO, RENDER, ALIGNMENT
    status        = Column(String, default="queued", index=True)
    payload       = Column(JSON, default=dict)
    result        = Column(JSON, default=dict)
    worker_id     = Column(String, nullable=True) # e.g. "local_pc", "runpod_serverless"
    worker_type   = Column(String, default="local") # local | cloud_gpu | cpu
    cost_usd      = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    started_at    = Column(DateTime, nullable=True)
    completed_at  = Column(DateTime, nullable=True)
    tenant_id     = Column(String, index=True, default=DEFAULT_PROFILE_ID)


class DailyComputeSpend(Base):
    """
    Tracks daily cloud GPU burst spend against the daily budget cap.
    Guarantees $0-by-default operation without runaway cloud costs.
    """
    __tablename__ = "daily_compute_spend"

    id               = Column(String, primary_key=True, default=_uuid)
    date             = Column(String, index=True, unique=True) # YYYY-MM-DD
    amount_spent_usd = Column(Float, default=0.0)
    budget_cap_usd   = Column(Float, default=2.0)
    jobs_count       = Column(Integer, default=0)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
