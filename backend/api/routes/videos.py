"""
Videos router — render a video from a script, approve/reject, trigger upload.
Integrates user profile for caption style, watermark, and custom CTA.
Now uses scene-aware rendering with stage-by-stage progress tracking.
"""

from __future__ import annotations

import logging
import os

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    Response,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.auth.dependencies import get_current_user, get_optional_current_user
from backend.db.database import AsyncSessionLocal, get_db
from backend.models.models import (
    Channel,
    Idea,
    JobStatus,
    Scene,
    Script,
    ScriptStatus,
    User,
    Video,
    VideoStatus,
)
from backend.services.rendering_service import run_job as _run_render
from engine.models import RenderJob

router = APIRouter()
log = logging.getLogger(__name__)


# ── Range-aware video streaming ───────────────────────────────────────────────


def _iter_file_range(path: str, start: int, end: int, chunk_size: int = 1024 * 1024):
    """Yield byte chunks from a file within [start, end] inclusive."""
    with open(path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            read_size = min(chunk_size, remaining)
            data = f.read(read_size)
            if not data:
                break
            remaining -= len(data)
            yield data


def _stream_video_with_range(request: Request, file_path: str):
    """
    Stream a video file with HTTP Range Request support.
    Returns 206 Partial Content when Range header is present,
    200 OK otherwise. This is required for browsers to play and seek in video.
    """
    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("range")

    start = 0
    end = file_size - 1
    status_code = 200
    headers = {
        "accept-ranges": "bytes",
        "content-type": "video/mp4",
        "content-encoding": "identity",
        "cache-control": "no-store",
    }

    if range_header:
        try:
            range_val = range_header.replace("bytes=", "").split("-")
            start = int(range_val[0]) if range_val[0] else 0
            end = (
                int(range_val[1])
                if len(range_val) > 1 and range_val[1]
                else file_size - 1
            )
        except (ValueError, IndexError):
            pass

        # Clamp values
        start = max(0, min(start, file_size - 1))
        end = max(start, min(end, file_size - 1))

        status_code = 206
        headers["content-range"] = f"bytes {start}-{end}/{file_size}"

    headers["content-length"] = str(end - start + 1)

    return StreamingResponse(
        _iter_file_range(file_path, start, end),
        status_code=status_code,
        headers=headers,
        media_type="video/mp4",
    )


# ── Render stage definitions ──────────────────────────────────────────────────
RENDER_STAGES = {
    "queued": {"label": "Queued", "progress": 0},
    "tts": {"label": "Generating voiceover", "progress": 15},
    "visuals": {"label": "Fetching visuals", "progress": 40},
    "assembly": {"label": "Assembling video", "progress": 65},
    "metadata": {"label": "Generating metadata", "progress": 85},
    "done": {"label": "Complete", "progress": 100},
    "failed": {"label": "Failed", "progress": 0},
}


# ── Pydantic models ──────────────────────────────────────────────────────────


class VideoOut(BaseModel):
    id: str
    script_id: str
    path: str | None
    duration: float | None
    style: str | None
    caption_style: str | None
    status: str
    ai_used: bool
    notes: str | None

    # Render progress
    render_stage: str
    render_progress: float

    # Metadata
    title_candidates: list[str]
    selected_title: str | None
    description: str | None
    hashtags: list[str]
    voice_override: str | None

    created_at: str


class RenderIn(BaseModel):
    script_id: str
    style: str = "fast_facts"
    caption_style: str | None = None  # overrides profile default
    custom_cta: str | None = None  # overrides profile default CTA
    voice_override: str | None = None  # overrides profile default voice


class ApproveIn(BaseModel):
    selected_title: str | None = None
    description: str | None = None
    hashtags: list[str] | None = None


class UploadIn(BaseModel):
    title: str
    description: str
    tags: list[str] = []
    privacy_status: str = "private"
    made_for_kids: bool = False


class VideoUpdateIn(BaseModel):
    selected_title: str | None = None
    description: str | None = None
    hashtags: list[str] | None = None


# ── Helper: update render stage in DB ─────────────────────────────────────────


async def _set_stage(db, video_id: str, stage: str, progress: float | None = None):
    """Update the render stage for a video. Uses the stage map for default progress."""
    video = await db.get(Video, video_id)
    if video:
        video.render_stage = stage
        video.render_progress = (
            progress
            if progress is not None
            else RENDER_STAGES.get(stage, {}).get("progress", 0)
        )
        await db.commit()


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/", response_model=list[VideoOut])
async def list_videos(
    channel_id: str | None = None,
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Video).where(Video.user_id == user.id)
    if channel_id:
        q = (
            q.join(Script, Video.script_id == Script.id)
            .join(Idea, Script.idea_id == Idea.id)
            .where(Idea.channel_id == channel_id)
        )
    if status:
        q = q.where(Video.status == status)
    result = await db.execute(q)
    return [_fmt(v) for v in result.scalars().all()]


@router.get("/{video_id}/progress")
async def get_render_progress(
    video_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lightweight endpoint for polling render progress."""
    v = await db.scalar(
        select(Video).where(Video.id == video_id, Video.user_id == user.id)
    )
    if not v:
        raise HTTPException(404, "Video not found")
    stage_info = RENDER_STAGES.get(v.render_stage or "queued", RENDER_STAGES["queued"])
    return {
        "video_id": v.id,
        "status": v.status.value if hasattr(v.status, "value") else v.status,
        "render_stage": v.render_stage or "queued",
        "stage_label": stage_info["label"],
        "progress": v.render_progress or 0,
        "notes": v.notes,
    }


@router.post("/render", response_model=VideoOut, status_code=202)
async def render_video(
    body: RenderIn,
    bg: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Queue render pipeline: TTS → visuals → FFmpeg assembly.
    """
    q = (
        select(Script)
        .where(Script.id == body.script_id, Script.user_id == user.id)
        .options(selectinload(Script.scenes))
    )
    res = await db.execute(q)
    script = res.scalars().first()
    if not script:
        raise HTTPException(404, "Script not found")
    if not script.full_text:
        raise HTTPException(400, "Script has no full_text — regenerate it")

    # Get niche and language from channel
    idea = await db.get(Idea, script.idea_id)
    channel = await db.get(Channel, idea.channel_id) if idea else None
    if not channel:
        raise HTTPException(404, "Channel not found for script")

    niche = channel.niche
    language = channel.language
    caption_style = body.caption_style or (
        channel.caption_style if channel else "bold_centered"
    )

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

    from engine.story.schemas import SceneSpec, StorySpec

    story_spec = (
        StorySpec(**spec_data)
        if spec_data
        else StorySpec(topic=idea.topic if idea else "")
    )

    if not story_spec.scenes:
        # Build scenes from script.scenes if missing
        for s in script.scenes:
            story_spec.scenes.append(
                SceneSpec(
                    scene_number=s.scene_number,
                    narration=s.narration or "",
                    visual_intent=s.visual_description or "",
                )
            )

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

    if channel and channel.watermark_enabled and user.logo_path:
        from pathlib import Path

        if Path(user.logo_path).exists():
            job.watermark_path = user.logo_path
            job.watermark_opacity = channel.watermark_opacity or 0.4
            job.watermark_position = channel.watermark_position or "bottom_right"
            job.watermark_scale = channel.watermark_scale or 0.12

    # Create DB Job and dispatch via JobExecutor (based on WORKER_BACKEND setting)
    import uuid
    from datetime import datetime

    from backend.core.config import settings as _settings
    from backend.models.models import Job as DBJob

    job_payload = job.model_dump()
    job_id = str(uuid.uuid4())
    new_db_job = DBJob(
        id=job_id,
        user_id=user.id,
        capability="RENDER",
        status=JobStatus.CREATED,
        payload=job_payload,
        worker_type=_settings.WORKER_BACKEND,
        cost_usd=0.0,
        created_at=datetime.utcnow(),
    )
    db.add(new_db_job)
    # CRITICAL: Commit Job BEFORE dispatching so executor can read it from DB
    await db.commit()
    await db.refresh(new_db_job)

    try:
        # Select executor based on WORKER_BACKEND setting
        if _settings.WORKER_BACKEND == "github_actions":
            from backend.jobs.github_executor import GitHubActionsJobExecutor

            executor = GitHubActionsJobExecutor()
        else:
            from backend.jobs.local_executor import LocalJobExecutor

            executor = LocalJobExecutor()

        await executor.submit(job_id, job_payload)
        await db.refresh(new_db_job)
    except Exception as e:
        log.exception(f"Failed to dispatch job {job_id}")
        new_db_job.status = JobStatus.FAILED
        new_db_job.error_message = f"Dispatch failed: {str(e)}"
        await db.commit()

    return _fmt(video)


@router.get("/{video_id}", response_model=VideoOut)
async def get_video(
    video_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    v = await db.scalar(
        select(Video).where(Video.id == video_id, Video.user_id == user.id)
    )
    if not v:
        raise HTTPException(404, "Video not found")
    return _fmt(v)


@router.patch("/{video_id}", response_model=VideoOut)
async def update_video(
    video_id: str,
    body: VideoUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    v = await db.scalar(
        select(Video).where(Video.id == video_id, Video.user_id == user.id)
    )
    if not v:
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


@router.post("/{video_id}/generate-metadata", response_model=VideoOut)
async def generate_metadata_endpoint(
    video_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    v = await db.scalar(
        select(Video).where(Video.id == video_id, Video.user_id == user.id)
    )
    if not v:
        raise HTTPException(404, "Video not found")

    from backend.services.rendering_service import generate_video_metadata

    await generate_video_metadata(video_id)
    await db.refresh(v)
    return _fmt(v)


@router.get("/{video_id}/preview")
async def preview_video(
    video_id: str,
    request: Request,
    user: User | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    v = await db.get(Video, video_id)
    if not v:
        raise HTTPException(404, "Video not found")

    # If authenticated, ensure user cannot view other users' private videos
    if user and v.user_id and v.user_id != user.id:
        raise HTTPException(403, "Forbidden")

    from pathlib import Path

    from backend.core.config import settings

    # 1. If path is a public HTTP(S) URL (e.g. R2 public CDN domain)
    if v.path and (v.path.startswith("http://") or v.path.startswith("https://")):
        # If it's a Cloudflare R2 / S3 direct URL without CORS, extract key to stream directly
        is_direct_storage_url = False
        if settings.S3_ENDPOINT_URL and settings.S3_ENDPOINT_URL in v.path:
            is_direct_storage_url = True
        elif "r2.cloudflarestorage.com" in v.path:
            is_direct_storage_url = True

        if not is_direct_storage_url:
            from fastapi.responses import RedirectResponse

            return RedirectResponse(url=v.path, status_code=307)
        else:
            from urllib.parse import urlparse

            parsed = urlparse(v.path)
            path_parts = parsed.path.lstrip("/").split("/")
            if (
                settings.S3_BUCKET_NAME
                and path_parts
                and path_parts[0] == settings.S3_BUCKET_NAME
            ):
                v.path = "/".join(path_parts[1:])
            else:
                v.path = parsed.path.lstrip("/")

    # 2. Local file exists or storage file resolution
    resolved_path = None

    # Check direct path if present
    if v.path and os.path.exists(v.path):
        resolved_path = v.path

    # Check storage root relative path
    if not resolved_path and v.path:
        storage_rel = Path(settings.STORAGE_ROOT) / v.path.lstrip("/")
        if storage_rel.exists():
            resolved_path = str(storage_rel)

    # Auto-healing: if v.path is missing or wrong, discover where it was stored
    if not resolved_path:
        candidate_paths = [
            Path(settings.STORAGE_ROOT)
            / "users"
            / str(v.user_id)
            / "videos"
            / f"{v.id}.mp4",
            Path(settings.STORAGE_ROOT) / "renders" / f"{v.id}.mp4",
            Path(settings.STORAGE_ROOT) / "renders" / f"short_{v.id[:8]}.mp4",
        ]
        for cp in candidate_paths:
            if cp.exists() and cp.stat().st_size > 0:
                resolved_path = str(cp)
                # Self-heal video.path in database
                v.path = (
                    f"users/{v.user_id}/videos/{v.id}.mp4"
                    if "users" in str(cp)
                    else str(cp)
                )
                await db.commit()
                log.info(f"Self-healed video {v.id} path in DB: {v.path}")
                break

    if resolved_path and os.path.exists(resolved_path):
        return _stream_video_with_range(request, resolved_path)

    # 3. Remote storage key (S3/R2) — stream directly to avoid CORS/latency
    if settings.STORAGE_BACKEND in ["s3", "r2"] and v.path:
        try:
            from backend.storage import get_storage

            storage = get_storage()

            if hasattr(storage, "get_stream"):
                range_header = request.headers.get("range")
                status_code, content_length, content_range, content_type, body_gen = (
                    await storage.get_stream(v.path, range_header=range_header)
                )

                if status_code == 416:
                    return Response(
                        status_code=416,
                        headers={"content-range": "bytes */*"},
                    )

                headers = {
                    "accept-ranges": "bytes",
                    "content-type": content_type or "video/mp4",
                    "content-encoding": "identity",
                    "cache-control": "no-store",
                }
                if content_length is not None:
                    headers["content-length"] = str(content_length)
                if content_range:
                    headers["content-range"] = content_range

                return StreamingResponse(
                    body_gen,
                    status_code=status_code,
                    headers=headers,
                    media_type=content_type or "video/mp4",
                )

            public_url = await storage.get_public_url(v.path)
            if public_url:
                from fastapi.responses import RedirectResponse

                return RedirectResponse(url=public_url, status_code=307)
            signed_url = await storage.generate_signed_url(v.path)
            from fastapi.responses import RedirectResponse

            return RedirectResponse(url=signed_url, status_code=307)
        except Exception as e:
            log.error(f"Failed to stream video from storage {v.path}: {e}")
            raise HTTPException(500, f"Video could not be retrieved from storage: {e}")

    raise HTTPException(404, f"Video file not found: {v.path or video_id}")


@router.patch("/{video_id}/approve", response_model=VideoOut)
async def approve_video(
    video_id: str,
    body: ApproveIn | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    v = await db.scalar(
        select(Video).where(Video.id == video_id, Video.user_id == user.id)
    )
    if not v:
        raise HTTPException(404, "Video not found")

    if body:
        if body.selected_title is not None:
            v.selected_title = body.selected_title
        if body.description is not None:
            v.description = body.description
        if body.hashtags is not None:
            v.hashtags = body.hashtags

    v.status = VideoStatus.approved

    # If drafted, update privacy to public
    from backend.models.models import Publication

    pub_q = select(Publication).where(
        Publication.video_id == video_id, Publication.user_id == user.id
    )
    pub_res = await db.execute(pub_q)
    pub = pub_res.scalar_one_or_none()

    if pub and pub.youtube_id:
        from googleapiclient.discovery import build

        from integrations.youtube.uploader import _get_credentials

        try:
            creds = await _get_credentials(user.id)
            youtube = build("youtube", "v3", credentials=creds)
            body = {
                "id": pub.youtube_id,
                "snippet": {
                    "title": v.selected_title or pub.title,
                    "description": f"{v.description}\n\n{' '.join(['#'+t for t in (v.hashtags or [])])}",
                    "tags": v.hashtags,
                    "categoryId": "27",
                },
                "status": {"privacyStatus": "public"},
            }
            youtube.videos().update(part="snippet,status", body=body).execute()
            pub.privacy_status = "public"
            pub.status = "live"
            v.status = VideoStatus.uploaded
        except Exception as e:
            v.status = VideoStatus.publish_failed
            v.notes = (
                f"Approval succeeded, but YouTube update (draft -> public) failed: {e}"
            )
            log.error("Failed to update YouTube video to public: %s", e)

    await db.flush()
    return _fmt(v)


@router.patch("/{video_id}/reject", response_model=VideoOut)
async def reject_video(
    video_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    v = await db.scalar(
        select(Video).where(Video.id == video_id, Video.user_id == user.id)
    )
    if not v:
        raise HTTPException(404, "Video not found")
    v.status = VideoStatus.rejected
    await db.flush()
    return _fmt(v)


@router.post("/{video_id}/upload")
async def upload_video(
    video_id: str,
    body: UploadIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload an approved video to YouTube as private."""
    v = await db.scalar(
        select(Video).where(Video.id == video_id, Video.user_id == user.id)
    )
    if not v:
        raise HTTPException(404, "Video not found")

    # Idempotency check
    if v.status == VideoStatus.uploaded:
        from backend.models.models import Publication

        pub = await db.scalar(
            select(Publication).where(Publication.video_id == video_id)
        )
        if pub:
            return {
                "youtube_id": pub.youtube_id,
                "url": pub.url,
                "status": "already_uploaded",
            }

    if v.status not in (VideoStatus.approved, VideoStatus.ready):
        raise HTTPException(
            400,
            f"Video must be in 'ready' or 'approved' status before uploading (current: {v.status})",
        )

    upload_file_path = None
    temp_download_dir = None
    from pathlib import Path

    from backend.core.config import settings

    # 1. Direct path check
    if v.path and os.path.exists(v.path) and os.path.getsize(v.path) > 0:
        upload_file_path = v.path
    # 2. Storage root relative path check
    elif v.path and (Path(settings.STORAGE_ROOT) / v.path.lstrip("/")).exists():
        upload_file_path = str(Path(settings.STORAGE_ROOT) / v.path.lstrip("/"))
    # 3. Fallback to storage engine get_file download
    else:
        from backend.storage import get_storage

        storage = get_storage()
        try:
            import tempfile

            temp_download_dir = tempfile.mkdtemp()
            local_target = os.path.join(temp_download_dir, f"{video_id}.mp4")
            remote_key = v.path or f"users/{user.id}/videos/{video_id}.mp4"
            await storage.get_file(remote_key, local_target)
            if os.path.exists(local_target) and os.path.getsize(local_target) > 0:
                upload_file_path = local_target
            else:
                raise FileNotFoundError(
                    f"Downloaded file at {local_target} is missing or empty"
                )
        except Exception as dl_err:
            log.error(f"Failed to fetch video from remote storage: {dl_err}")
            raise HTTPException(
                400, f"Video file not found locally or in cloud storage: {dl_err}"
            )

    from backend.models.models import Publication
    from integrations.youtube.uploader import upload_video as yt_upload

    try:
        yt_id = await yt_upload(
            user_id=user.id,
            video_path=upload_file_path,
            title=body.title,
            description=body.description,
            tags=body.tags,
            privacy_status=body.privacy_status,
            made_for_kids=body.made_for_kids,
        )
    except Exception as exc:
        raise HTTPException(500, f"YouTube upload failed: {exc}")
    finally:
        if temp_download_dir and os.path.exists(temp_download_dir):
            import shutil

            shutil.rmtree(temp_download_dir, ignore_errors=True)

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
    db: AsyncSession = Depends(get_db),
):
    v = await db.scalar(
        select(Video).where(Video.id == video_id, Video.user_id == user.id)
    )
    if not v:
        raise HTTPException(404, "Video not found")
    v.status = VideoStatus.cancelled
    await db.commit()
    await db.refresh(v)
    return _fmt(v)


@router.post("/{video_id}/pause", response_model=VideoOut)
async def pause_video(
    video_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    v = await db.scalar(
        select(Video).where(Video.id == video_id, Video.user_id == user.id)
    )
    if not v:
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
    db: AsyncSession = Depends(get_db),
):
    v = await db.scalar(
        select(Video).where(Video.id == video_id, Video.user_id == user.id)
    )
    if not v:
        raise HTTPException(404, "Video not found")
    if v.status == VideoStatus.paused:
        v.status = VideoStatus.rendering
        await db.commit()
        await db.refresh(v)
    return _fmt(v)


def _fmt(v: Video) -> dict:
    return {
        "id": v.id,
        "script_id": v.script_id,
        "path": v.path,
        "duration": v.duration,
        "style": v.style,
        "caption_style": v.caption_style or "bold_centered",
        "status": v.status.value if hasattr(v.status, "value") else v.status,
        "ai_used": v.ai_used,
        "notes": v.notes,
        "render_stage": v.render_stage or "queued",
        "render_progress": v.render_progress or 0,
        "title_candidates": v.title_candidates or [],
        "selected_title": v.selected_title,
        "description": v.description,
        "hashtags": v.hashtags or [],
        "voice_override": v.voice_override,
        "created_at": str(v.created_at),
    }
