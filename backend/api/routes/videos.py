"""
Videos router — render a video from a script, approve/reject, trigger upload.
Integrates user profile for caption style, watermark, and custom CTA.
Now uses scene-aware rendering with stage-by-stage progress tracking.
"""
from __future__ import annotations
import os
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db, AsyncSessionLocal
from backend.models.models import Video, VideoStatus, Script, Channel, Idea, User, ScriptStatus, Scene
from engine.models import RenderJob
from backend.auth.dependencies import get_current_user

router = APIRouter()
log = logging.getLogger(__name__)

DEFAULT_PROFILE_ID = "default-user"

# ── Render stage definitions ──────────────────────────────────────────────────
RENDER_STAGES = {
    "queued":   {"label": "Queued",              "progress": 0},
    "tts":      {"label": "Generating voiceover", "progress": 15},
    "visuals":  {"label": "Fetching visuals",     "progress": 40},
    "assembly": {"label": "Assembling video",     "progress": 65},
    "metadata": {"label": "Generating metadata",  "progress": 85},
    "done":     {"label": "Complete",              "progress": 100},
    "failed":   {"label": "Failed",                "progress": 0},
}


# ── Pydantic models ──────────────────────────────────────────────────────────

class VideoOut(BaseModel):
    id:            str
    script_id:     str
    path:          str | None
    duration:      float | None
    style:         str | None
    caption_style: str | None
    status:        str
    ai_used:       bool
    notes:         str | None
    
    # Render progress
    render_stage:    str
    render_progress: float
    
    # Metadata
    title_candidates: list[str]
    selected_title:   str | None
    description:      str | None
    hashtags:         list[str]
    voice_override:   str | None
    
    created_at:    str


class RenderIn(BaseModel):
    script_id:     str
    style:         str = "fast_facts"
    caption_style: str | None = None    # overrides profile default
    custom_cta:    str | None = None    # overrides profile default CTA
    voice_override: str | None = None   # overrides profile default voice

class ApproveIn(BaseModel):
    selected_title: str | None = None
    description:    str | None = None
    hashtags:       list[str] | None = None


class UploadIn(BaseModel):
    title:          str
    description:    str
    tags:           list[str] = []
    privacy_status: str = "private"
    made_for_kids:  bool = False


class VideoUpdateIn(BaseModel):
    selected_title: str | None = None
    description:    str | None = None
    hashtags:       list[str] | None = None


# ── Helper: update render stage in DB ─────────────────────────────────────────

async def _set_stage(db, video_id: str, stage: str, progress: float | None = None):
    """Update the render stage for a video. Uses the stage map for default progress."""
    video = await db.get(Video, video_id)
    if video:
        video.render_stage = stage
        video.render_progress = progress if progress is not None else RENDER_STAGES.get(stage, {}).get("progress", 0)
        await db.commit()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[VideoOut])
async def list_videos(
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Video).where(Video.user_id == user.id)
    if status:
        q = q.where(Video.status == status)
    result = await db.execute(q)
    return [_fmt(v) for v in result.scalars().all()]


@router.get("/{video_id}/progress")
async def get_render_progress(
    video_id: str, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lightweight endpoint for polling render progress."""
    v = await db.get(Video, video_id)
    if not v or v.user_id != user.id:
        raise HTTPException(404, "Video not found")
    stage_info = RENDER_STAGES.get(v.render_stage or "queued", RENDER_STAGES["queued"])
    return {
        "video_id":     v.id,
        "status":       v.status.value if hasattr(v.status, "value") else v.status,
        "render_stage": v.render_stage or "queued",
        "stage_label":  stage_info["label"],
        "progress":     v.render_progress or 0,
        "notes":        v.notes,
    }




@router.post("/render", response_model=VideoOut, status_code=202)
async def render_video(
    body: RenderIn, 
    bg: BackgroundTasks, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Queue render pipeline: TTS → visuals → FFmpeg assembly.
    """
    q = select(Script).where(Script.id == body.script_id, Script.user_id == user.id).options(selectinload(Script.scenes))
    res = await db.execute(q)
    script = res.scalars().first()
    if not script:
        raise HTTPException(404, "Script not found")
    if not script.full_text:
        raise HTTPException(400, "Script has no full_text — regenerate it")

    # Load user profile for defaults
    profile = user
    caption_style = body.caption_style or (profile.caption_style if profile else "bold_centered")

    # Get niche and language
    idea    = await db.get(Idea, script.idea_id)
    channel = await db.get(Channel, idea.channel_id) if idea else None
    niche   = channel.niche if channel else "science_wow"
    language = channel.language if channel else "en"
    
    script.status = ScriptStatus.used_in_render

    video = Video(
        script_id=body.script_id,
        user_id=user.id,
        style=body.style,
        caption_style=caption_style,
        voice_override=body.voice_override,
        status=VideoStatus.rendering,
        render_stage="queued",
        render_progress=0,
    )
    db.add(video)
    await db.commit()
    await db.refresh(video)

    spec_data = script.body or {}
    
    from engine.story.schemas import StorySpec, SceneSpec
    story_spec = StorySpec(**spec_data) if spec_data else StorySpec(topic=idea.topic if idea else "")
    
    if not story_spec.scenes:
        # Build scenes from script.scenes if missing
        for s in script.scenes:
            story_spec.scenes.append(SceneSpec(
                scene_number=s.scene_number,
                narration=s.narration or "",
                visual_intent=s.visual_description or "",
            ))
            
    # Apply latest API edits to story_spec scenes
    scene_map = {s.scene_number: s for s in script.scenes}
    for spec_scene in story_spec.scenes:
        if spec_scene.scene_number in scene_map:
            db_scene = scene_map[spec_scene.scene_number]
            spec_scene.narration = db_scene.narration or ""
            spec_scene.visual_intent = db_scene.visual_description or ""
            spec_scene.scene_id = db_scene.id

    job = RenderJob(
        video_id=video.id,
        story_spec=story_spec,
        niche=niche,
        caption_style=caption_style,
        style=body.style,
        language=story_spec.language or language,
    )
    
    if profile and profile.watermark_enabled and profile.logo_path:
        from pathlib import Path
        if Path(profile.logo_path).exists():
            job.watermark_path = profile.logo_path
            job.watermark_opacity = profile.watermark_opacity or 0.4
            job.watermark_position = profile.watermark_position or "bottom_right"
            job.watermark_scale = profile.watermark_scale or 0.12

    # Create DB Job and dispatch via Worker Router
    import uuid
    from datetime import datetime
    from backend.models.models import Job as DBJob
    from backend.worker_router import dispatch_job, WorkerCapability
    
    job_id = str(uuid.uuid4())
    route_meta = await dispatch_job(
        job_id=job_id, 
        capability=WorkerCapability.RENDER, 
        payload=job.model_dump(), 
        db=db
    )
    
    new_db_job = DBJob(
        id=job_id,
        user_id=user.id,
        capability=WorkerCapability.RENDER.value,
        status=route_meta["status"],
        payload=job.model_dump(),
        worker_id=route_meta.get("worker_id"),
        worker_type=route_meta.get("worker_type", "local"),
        cost_usd=0.0,
        created_at=datetime.utcnow()
    )
    db.add(new_db_job)
    await db.commit()

    return _fmt(video)

@router.get("/{video_id}", response_model=VideoOut)
async def get_video(
    video_id: str, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    v = await db.get(Video, video_id)
    if not v or v.user_id != user.id:
        raise HTTPException(404, "Video not found")
    return _fmt(v)


@router.patch("/{video_id}", response_model=VideoOut)
async def update_video(
    video_id: str, 
    body: VideoUpdateIn, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    v = await db.get(Video, video_id)
    if not v or v.user_id != user.id:
        raise HTTPException(404, "Video not found")
    if body.selected_title is not None:
        v.selected_title = body.selected_title
    if body.description is not None:
        v.description = body.description
    if body.hashtags is not None:
        v.hashtags = body.hashtags
    await db.commit()
    await db.refresh(v)
    return _fmt(v)


@router.get("/{video_id}/preview")
async def preview_video(
    video_id: str, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    v = await db.get(Video, video_id)
    if not v or v.user_id != user.id or not v.path:
        raise HTTPException(404, "Video file not found")
    
    # 1. If path is an HTTP(S) remote URL (e.g. R2 public CDN)
    if v.path.startswith("http://") or v.path.startswith("https://"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=v.path, status_code=307)
        
    # 2. If storage provider is S3/R2 and file is a remote object key
    if not os.path.exists(v.path):
        from backend.storage import storage
        from backend.core.config import settings
        if settings.STORAGE_BACKEND in ["s3", "r2"]:
            try:
                signed_url = await storage.generate_signed_url(v.path)
                from fastapi.responses import RedirectResponse
                return RedirectResponse(url=signed_url, status_code=307)
            except Exception as e:
                log.error(f"Failed to generate presigned URL for {v.path}: {e}")
        raise HTTPException(404, f"Video file not found: {v.path}")
        
    # 3. Local filesystem fallback
    return FileResponse(v.path, media_type="video/mp4")


@router.patch("/{video_id}/approve", response_model=VideoOut)
async def approve_video(
    video_id: str, 
    body: ApproveIn | None = None, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    v = await db.get(Video, video_id)
    if not v or v.user_id != user.id:
        raise HTTPException(404, "Video not found")
        
    if body:
        if body.selected_title is not None: v.selected_title = body.selected_title
        if body.description is not None: v.description = body.description
        if body.hashtags is not None: v.hashtags = body.hashtags

    v.status = VideoStatus.approved
    
    # If drafted, update privacy to public
    from backend.models.models import Publication
    pub_q = select(Publication).where(Publication.video_id == video_id)
    pub_res = await db.execute(pub_q)
    pub = pub_res.scalar_one_or_none()
    
    if pub and pub.youtube_id:
        from integrations.youtube.uploader import _get_credentials
        from googleapiclient.discovery import build
        try:
            creds = await _get_credentials(user.id)
            youtube = build("youtube", "v3", credentials=creds)
            body = {
                "id": pub.youtube_id,
                "snippet": {
                    "title": v.selected_title or pub.title,
                    "description": f"{v.description}\n\n{' '.join(['#'+t for t in (v.hashtags or [])])}",
                    "tags": v.hashtags,
                    "categoryId": "27"
                },
                "status": {
                    "privacyStatus": "public"
                }
            }
            youtube.videos().update(part="snippet,status", body=body).execute()
            pub.privacy_status = "public"
            pub.status = "live"
            v.status = VideoStatus.uploaded
        except Exception as e:
            v.status = VideoStatus.publish_failed
            v.notes = f"Approval succeeded, but YouTube update (draft -> public) failed: {e}"
            log.error("Failed to update YouTube video to public: %s", e)
    
    await db.flush()
    return _fmt(v)


@router.patch("/{video_id}/reject", response_model=VideoOut)
async def reject_video(
    video_id: str, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    v = await db.get(Video, video_id)
    if not v or v.user_id != user.id:
        raise HTTPException(404, "Video not found")
    v.status = VideoStatus.rejected
    await db.flush()
    return _fmt(v)


@router.post("/{video_id}/upload")
async def upload_video(
    video_id: str, 
    body: UploadIn, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload an approved video to YouTube as private."""
    v = await db.get(Video, video_id)
    if not v or v.user_id != user.id:
        raise HTTPException(404, "Video not found")
    if v.status != VideoStatus.approved:
        raise HTTPException(400, "Video must be approved before uploading")
    if not v.path or not os.path.exists(v.path):
        raise HTTPException(400, "Video file missing on disk")

    from integrations.youtube.uploader import upload_video as yt_upload
    from backend.models.models import Publication
    try:
        yt_id = await yt_upload(
            user_id=user.id,
            video_path=v.path,
            title=body.title,
            description=body.description,
            tags=body.tags,
            privacy_status=body.privacy_status,
            made_for_kids=body.made_for_kids,
        )
    except Exception as exc:
        raise HTTPException(500, f"YouTube upload failed: {exc}")

    pub = Publication(
        user_id=user.id,
        video_id=video_id,
        youtube_id=yt_id,
        url=f"https://youtu.be/{yt_id}",
        title=body.title,
        description=body.description,
        tags=body.tags,
        privacy_status=body.privacy_status,
        status="live",
    )
    db.add(pub)
    v.status = VideoStatus.uploaded
    await db.flush()
    return {"youtube_id": yt_id, "url": f"https://youtu.be/{yt_id}"}



@router.post("/{video_id}/cancel", response_model=VideoOut)
async def cancel_video(
    video_id: str, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    v = await db.get(Video, video_id)
    if not v or v.user_id != user.id:
        raise HTTPException(404, "Video not found")
    v.status = VideoStatus.cancelled
    await db.commit()
    await db.refresh(v)
    return _fmt(v)

@router.post("/{video_id}/pause", response_model=VideoOut)
async def pause_video(
    video_id: str, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    v = await db.get(Video, video_id)
    if not v or v.user_id != user.id:
        raise HTTPException(404, "Video not found")
    if v.status == VideoStatus.rendering:
        v.status = VideoStatus.paused
        await db.commit()
        await db.refresh(v)
    return _fmt(v)

@router.post("/{video_id}/resume", response_model=VideoOut)
async def resume_video(
    video_id: str, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    v = await db.get(Video, video_id)
    if not v or v.user_id != user.id:
        raise HTTPException(404, "Video not found")
    if v.status == VideoStatus.paused:
        v.status = VideoStatus.rendering
        await db.commit()
        await db.refresh(v)
    return _fmt(v)

def _fmt(v: Video) -> dict:
    return {
        "id":            v.id,
        "script_id":     v.script_id,
        "path":          v.path,
        "duration":      v.duration,
        "style":         v.style,
        "caption_style": v.caption_style or "bold_centered",
        "status":        v.status.value if hasattr(v.status, "value") else v.status,
        "ai_used":       v.ai_used,
        "notes":         v.notes,
        "render_stage":    v.render_stage or "queued",
        "render_progress": v.render_progress or 0,
        "title_candidates": v.title_candidates or [],
        "selected_title":   v.selected_title,
        "description":      v.description,
        "hashtags":         v.hashtags or [],
        "voice_override":   v.voice_override,
        "created_at":    str(v.created_at),
    }
