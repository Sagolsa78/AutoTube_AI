"""
SQLAlchemy async models for AutoShorts Studio.
Covers: users, channels, ideas, scripts, scenes, assets, videos, publications, analytics, jobs.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, Column, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(AsyncAttrs, DeclarativeBase):
    pass


# ── Enums ─────────────────────────────────────────────────────────────────────


class IdeaStatus(str, enum.Enum):
    pending = "pending"
    discarded = "discarded"
    promoted = "promoted"


class ScriptStatus(str, enum.Enum):
    draft = "draft"
    discarded = "discarded"
    used_in_render = "used_in_render"


class VideoStatus(str, enum.Enum):
    pending = "pending"
    rendering = "rendering"
    paused = "paused"
    ready = "ready"
    approved = "approved"
    rejected = "rejected"
    uploaded = "uploaded"
    failed = "failed"
    cancelled = "cancelled"
    publish_failed = "publish_failed"


class RenderErrorCode(str, enum.Enum):
    dispatch_failed = "dispatch_failed"
    tts_failed = "tts_failed"
    visual_failed = "visual_failed"
    assembly_failed = "assembly_failed"
    storage_failed = "storage_failed"
    metadata_failed = "metadata_failed"
    upload_failed = "upload_failed"
    quality_gate_failed = "quality_gate_failed"


class PrivacyStatus(str, enum.Enum):
    private = "private"
    unlisted = "unlisted"
    public = "public"


# ── Auth & Users ──────────────────────────────────────────────────────────────


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    email = Column(
        String, unique=True, index=True, nullable=True
    )  # Mapped from auth provider
    display_name = Column(String, nullable=False, default="Creator")
    channel_name = Column(String, default="")
    logo_path = Column(String)
    password_hash = Column(String, nullable=True)
    preferred_ai_provider = Column(String, default="gemini")
    preferred_ai_model = Column(String, default="gemini-3.5-flash-lite")

    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    channels = relationship(
        "Channel", back_populates="user", cascade="all, delete-orphan"
    )
    platform_connections = relationship(
        "PlatformConnection", back_populates="user", cascade="all, delete-orphan"
    )


UserProfile = User  # Legacy alias for backward compatibility


class PlatformConnection(Base):
    """Stores encrypted OAuth credentials for platform publishing."""

    __tablename__ = "platform_connections"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    platform = Column(String, nullable=False, index=True)
    account_id = Column(String, nullable=True)
    account_name = Column(String, nullable=True)
    access_token_encrypted = Column(Text, nullable=False)
    refresh_token_encrypted = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    scopes = Column(JSON, default=list)
    status = Column(String, default="active")
    platform_metadata = Column(JSON, default=dict)

    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="platform_connections")


# ── Tables ────────────────────────────────────────────────────────────────────


class Channel(Base):
    __tablename__ = "channels"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String, nullable=False)
    niche = Column(String, nullable=False)
    language = Column(String, default="en")

    default_cta = Column(Text, default="Follow for more!")
    caption_style = Column(String, default="bold_centered")
    watermark_enabled = Column(Boolean, default=True)
    watermark_opacity = Column(Float, default=0.4)
    watermark_position = Column(String, default="bottom_right")
    watermark_scale = Column(Float, default=0.12)

    # Settings
    default_voice_id = Column(String, default="en-US-ChristopherNeural")
    content_tone = Column(String, default="casual")
    niche_keywords = Column(JSON, default=list)
    title_style_preference = Column(String, default="curiosity")
    hashtag_set = Column(JSON, default=lambda: ["shorts", "viral"])
    auto_approve = Column(Boolean, default=False)

    # ── Channel Intelligence (Phase 1) ────────────────────────────────────────
    content_pillars = Column(JSON, default=list)  # e.g. ["aviation", "science"]
    target_audience = Column(String, default="")
    excluded_topics = Column(JSON, default=list)  # e.g. ["celebrity gossip"]
    excluded_keywords = Column(JSON, default=list)
    recent_topics = Column(JSON, default=list)  # rolling window of produced topics
    previously_used_topics = Column(JSON, default=list)
    preferred_content_formats = Column(JSON, default=lambda: ["short"])
    visual_preferences = Column(
        JSON, default=dict
    )  # e.g. {"default_strategy": "balanced"}
    topic_fingerprints = Column(JSON, default=list)  # normalized topic embeddings
    performance_metrics = Column(JSON, default=dict)  # aggregated channel-level metrics

    schedule_config = Column(
        JSON,
        default=lambda: {
            "timezone": "UTC",
            "buffer_days": 1,
            "min_hours_between": 8,
            "auto_schedule": True,
            "platforms": {
                "youtube": "18:30",
                "instagram": "19:00",
                "facebook": "19:15",
            },
        },
    )

    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="channels")
    ideas = relationship("Idea", back_populates="channel", cascade="all, delete-orphan")


class Idea(Base):
    __tablename__ = "ideas"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    channel_id = Column(String, ForeignKey("channels.id"), nullable=False)
    title = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    angle = Column(Text)
    status = Column(SAEnum(IdeaStatus), default=IdeaStatus.pending)
    score = Column(Float, default=0.0)
    notes = Column(Text)
    settings = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    channel = relationship("Channel", back_populates="ideas")
    scripts = relationship(
        "Script", back_populates="idea", cascade="all, delete-orphan"
    )


class Script(Base):
    __tablename__ = "scripts"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    idea_id = Column(String, ForeignKey("ideas.id"), nullable=False)
    status = Column(SAEnum(ScriptStatus), default=ScriptStatus.draft)
    hook = Column(Text)
    body = Column(JSON)  # list of sentences or scene specs
    payoff = Column(Text)
    cta = Column(Text)
    full_text = Column(Text)
    visual_prompts = Column(JSON)
    duration_est = Column(Float)
    quality_score = Column(Float, default=0.0)
    fact_check_ok = Column(Boolean, default=False)
    provider_used = Column(String)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    idea = relationship("Idea", back_populates="scripts")
    assets = relationship(
        "Asset", back_populates="script", cascade="all, delete-orphan"
    )
    videos = relationship(
        "Video", back_populates="script", cascade="all, delete-orphan"
    )
    scenes = relationship(
        "Scene",
        back_populates="script",
        cascade="all, delete-orphan",
        order_by="Scene.scene_number",
    )


class Scene(Base):
    __tablename__ = "scenes"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    script_id = Column(
        String, ForeignKey("scripts.id", ondelete="CASCADE"), nullable=False
    )
    scene_number = Column(Integer, nullable=False)
    narration = Column(Text)
    visual_description = Column(Text)
    asset_id = Column(
        String, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True
    )
    duration_est = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    script = relationship("Script", back_populates="scenes")
    asset = relationship("Asset")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    script_id = Column(String, ForeignKey("scripts.id"), nullable=True)
    source_asset_id = Column(String, index=True)
    asset_type = Column(String)
    source = Column(String)
    path = Column(String)
    url = Column(String)
    thumbnail_url = Column(String)
    license = Column(String)
    commercial_ok = Column(Boolean, default=True)
    attribution_req = Column(Boolean, default=False)
    creator = Column(String)
    asset_metadata = Column(JSON)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    script = relationship("Script", back_populates="assets")


class Video(Base):
    __tablename__ = "videos"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    script_id = Column(String, ForeignKey("scripts.id"), nullable=False)
    path = Column(String)
    duration = Column(Float)
    style = Column(String)
    caption_style = Column(String, default="bold_centered")
    status = Column(SAEnum(VideoStatus), default=VideoStatus.pending)
    ai_used = Column(Boolean, default=True)
    notes = Column(Text)

    render_stage = Column(String, default="queued")
    render_progress = Column(Float, default=0.0)
    error_code = Column(String, nullable=True)  # RenderErrorCode value

    title_candidates = Column(JSON, default=list)
    selected_title = Column(String)
    description = Column(Text)
    hashtags = Column(JSON, default=list)
    voice_override = Column(String)

    # ── Format settings (Phase 4) ─────────────────────────────────────────────
    content_type = Column(String, default="short")  # short | long_form
    target_duration_seconds = Column(Integer, nullable=True)  # user-requested target
    orientation = Column(String, default="9:16")  # 9:16 | 16:9
    visual_strategy = Column(
        String, default="auto"
    )  # auto | stock_first | balanced | ai_first | manual
    duration_mode = Column(String, default="auto")  # auto | target | exact

    # ── Render metadata (Phase 21) ────────────────────────────────────────────
    render_metadata = Column(JSON, default=dict)  # ffprobe output, quality gate results
    selected_voice = Column(String, nullable=True)  # actual voice used in render

    created_at = Column(DateTime(timezone=True), default=utc_now)

    script = relationship("Script", back_populates="videos")
    publications = relationship(
        "Publication", back_populates="video", cascade="all, delete-orphan"
    )
    analytics = relationship(
        "Analytics", back_populates="video", cascade="all, delete-orphan"
    )


class Publication(Base):
    __tablename__ = "publications"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    video_id = Column(String, ForeignKey("videos.id"), nullable=False, index=True)
    platform_connection_id = Column(
        String,
        ForeignKey("platform_connections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    platform = Column(String, nullable=False, default="youtube")
    remote_media_id = Column(String, nullable=True)
    url = Column(String, nullable=True)
    title = Column(String, nullable=True)
    caption = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    hashtags = Column(JSON, nullable=True)
    tags = Column(JSON, nullable=True)
    privacy_status = Column(SAEnum(PrivacyStatus), default=PrivacyStatus.private)
    published_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="pending")

    # ── Scheduled Publishing ──────────────────────────────────────────────────
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    schedule_status = Column(
        String, default="immediate"
    )  # immediate | scheduled | published | failed
    attempts = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)
    platform_metadata = Column(JSON, default=dict)
    idempotency_key = Column(String, index=True, nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    video = relationship("Video", back_populates="publications")
    platform_connection = relationship("PlatformConnection")


class Analytics(Base):
    __tablename__ = "analytics"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    video_id = Column(String, ForeignKey("videos.id"), nullable=False)
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    subscribers = Column(Integer, default=0)
    retention = Column(Float)
    recorded_at = Column(DateTime(timezone=True), default=utc_now)

    video = relationship("Video", back_populates="analytics")


class AnalyticsSnapshot(Base):
    __tablename__ = "analytics_snapshots"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    video_id = Column(String, ForeignKey("videos.id"), nullable=False)
    date = Column(DateTime(timezone=True), default=utc_now)
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    subscribers = Column(Integer, default=0)

    video = relationship("Video")


# ── Compute Plane / Job Models ────────────────────────────────────────────────


class JobStatus(str, enum.Enum):
    CREATED = "CREATED"
    QUEUED = "QUEUED"
    CLAIMED = "CLAIMED"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    RETRYING = "RETRYING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    DEAD_LETTER = "DEAD_LETTER"


class PipelineStage(str, enum.Enum):
    RESEARCH = "RESEARCH"
    SCRIPT = "SCRIPT"
    ASSETS = "ASSETS"
    VOICE = "VOICE"
    TIMELINE = "TIMELINE"
    RENDER = "RENDER"
    QA = "QA"
    UPLOAD = "UPLOAD"
    PUBLISH = "PUBLISH"
    ANALYTICS = "ANALYTICS"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    channel_id = Column(
        String, ForeignKey("channels.id", ondelete="CASCADE"), nullable=True, index=True
    )
    capability = Column(String, nullable=False, index=True)
    status = Column(SAEnum(JobStatus), default=JobStatus.CREATED, index=True)
    current_stage = Column(SAEnum(PipelineStage), nullable=True)
    priority = Column(Integer, default=1)
    attempt_number = Column(Integer, default=1)
    max_attempts = Column(Integer, default=3)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    heartbeat_at = Column(DateTime(timezone=True), nullable=True)
    lease_expires_at = Column(DateTime(timezone=True), nullable=True)
    idempotency_key = Column(String, index=True, nullable=True)
    input_version = Column(String, nullable=True)
    output_version = Column(String, nullable=True)
    error_code = Column(String, nullable=True)
    payload = Column(JSON, default=dict)
    result = Column(JSON, default=dict)
    worker_id = Column(String, nullable=True)
    worker_type = Column(String, default="local")
    cost_usd = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    def can_transition_to(self, new_status: JobStatus) -> bool:
        current = self.status
        if isinstance(current, str):
            try:
                current = JobStatus(current)
            except ValueError:
                return False

        valid_transitions = {
            JobStatus.CREATED: {JobStatus.QUEUED, JobStatus.CANCELLED},
            JobStatus.QUEUED: {JobStatus.CLAIMED, JobStatus.CANCELLED},
            JobStatus.CLAIMED: {
                JobStatus.RUNNING,
                JobStatus.QUEUED,
                JobStatus.FAILED,
                JobStatus.CANCELLED,
            },
            JobStatus.RUNNING: {
                JobStatus.SUCCEEDED,
                JobStatus.FAILED,
                JobStatus.PAUSED,
                JobStatus.CANCELLED,
                JobStatus.QUEUED,
            },
            JobStatus.PAUSED: {JobStatus.RUNNING, JobStatus.CANCELLED},
            JobStatus.RETRYING: {JobStatus.QUEUED, JobStatus.CANCELLED},
            JobStatus.SUCCEEDED: set(),  # Terminal
            JobStatus.FAILED: {
                JobStatus.RETRYING,
                JobStatus.DEAD_LETTER,
                JobStatus.CANCELLED,
                JobStatus.QUEUED,
            },
            JobStatus.CANCELLED: set(),  # Terminal
            JobStatus.DEAD_LETTER: {JobStatus.QUEUED},
        }
        return new_status in valid_transitions.get(current, set())

    def transition_to(self, new_status: JobStatus):
        if not self.can_transition_to(new_status):
            raise ValueError(
                f"Invalid state transition from {self.status} to {new_status}"
            )
        self.status = new_status


class DailyComputeSpend(Base):
    __tablename__ = "daily_compute_spend"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date = Column(String, index=True)
    amount_spent_usd = Column(Float, default=0.0)
    budget_cap_usd = Column(Float, default=2.0)
    jobs_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_user_date"),)


class CostEvent(Base):
    __tablename__ = "cost_events"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    channel_id = Column(
        String,
        ForeignKey("channels.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    job_id = Column(
        String, ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    stage = Column(String, index=True)
    provider = Column(String)
    model = Column(String)
    tokens = Column(Integer, default=0)
    duration_seconds = Column(Float, default=0.0)
    units = Column(Integer, default=0)
    estimated_cost = Column(Float, default=0.0)
    currency = Column(String, default="USD")
    operation = Column(String)
    created_at = Column(DateTime(timezone=True), default=utc_now)
