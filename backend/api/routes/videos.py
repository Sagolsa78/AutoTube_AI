"""
Videos router — render a video from a script, approve/reject, trigger upload.
Integrates user profile for caption style, watermark, and custom CTA.
"""
from __future__ import annotations
import os
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db, AsyncSessionLocal
from backend.models.models import Video, VideoStatus, Script, Channel, Idea, UserProfile
from engine.models import RenderJob

router = APIRouter()
log = logging.getLogger(__name__)

DEFAULT_PROFILE_ID = "default-user"


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
    created_at:    str


class RenderIn(BaseModel):
    script_id:     str
    style:         str = "fast_facts"
    caption_style: str | None = None    # overrides profile default
    custom_cta:    str | None = None    # overrides profile default CTA


class UploadIn(BaseModel):
    title:          str
    description:    str
    tags:           list[str] = []
    privacy_status: str = "private"
    made_for_kids:  bool = False


@router.get("/", response_model=list[VideoOut])
async def list_videos(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Video)
    if status:
        q = q.where(Video.status == status)
    result = await db.execute(q)
    return [_fmt(v) for v in result.scalars().all()]


async def _run_render(video_id: str, job: RenderJob):
    """Background render task — runs after HTTP response is sent."""
    async with AsyncSessionLocal() as db:
        try:
            video = await db.get(Video, video_id)
            if not video:
                log.warning(f"Video {video_id} not found in _run_render.")
                return

            log.info(f"Starting background render for video {video_id} (Script: {job.script_full_text[:30]}...)")
            # TTS
            from engine.tts.voiceover import generate_voiceover
            audio_dir = f"storage/audio/{video.id}"
            os.makedirs(audio_dir, exist_ok=True)
            tts = await generate_voiceover(
                job.script_full_text, niche=job.niche,
                audio_path=f"{audio_dir}/voice.mp3",
                sub_path=f"{audio_dir}/subs.ass",
            )
            job.audio_path = tts["audio_path"]
            job.sub_path = tts["sub_path"]
            job.duration = tts["duration"]
            job.voice = tts["voice"]
            job.word_boundaries = tts.get("word_boundaries", [])

            # Visuals
            from engine.visuals.fetcher import async_fetch_clips
            visual_dir = f"storage/visuals/{video.id}"
            script = await db.get(Script, video.script_id)
            idea = await db.get(Idea, script.idea_id) if script else None
            queries = script.visual_prompts or [idea.topic if idea else "nature"]
            
            clips = await async_fetch_clips(queries[:3], clips_per_query=2, out_dir=visual_dir)
            if not clips:
                raise RuntimeError("No stock clips found — check Pexels/Pixabay API keys")
            # Filter out zero-byte clips (failed/corrupt downloads)
            valid_clips = [c for c in clips if os.path.getsize(c["path"]) > 10_000]
            if not valid_clips:
                raise RuntimeError(
                    f"All {len(clips)} downloaded clip(s) are empty or corrupt. "
                    "Check Pexels API key and network connectivity."
                )
            if len(valid_clips) < len(clips):
                log.warning(
                    "Discarded %d zero-byte/corrupt clip(s), proceeding with %d valid clip(s).",
                    len(clips) - len(valid_clips), len(valid_clips)
                )
            job.clip_paths = [c["path"] for c in valid_clips]

            # Assembly
            from engine.rendering.assembler import async_assemble_job
            await async_assemble_job(job)

            video.path = job.output_path
            video.duration = job.duration
            video.status = VideoStatus.ready
            video.ai_used = True
            video.notes = None
            await db.commit()
            log.info(f"Background render completed successfully for video {video_id} -> {job.output_path}")
        except Exception as exc:
            log.exception(f"Background render failed for video {video_id}: {exc}")
            video = await db.get(Video, video_id)
            if video:
                video.status = VideoStatus.failed
                video.notes = str(exc)
                await db.commit()


@router.post("/render", response_model=VideoOut, status_code=202)
async def render_video(body: RenderIn, bg: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """
    Queue render pipeline: TTS → visuals → FFmpeg assembly.
    """
    script = await db.get(Script, body.script_id)
    if not script:
        raise HTTPException(404, "Script not found")
    if not script.full_text:
        raise HTTPException(400, "Script has no full_text — regenerate it")

    # Load user profile for defaults
    profile = await db.get(UserProfile, DEFAULT_PROFILE_ID)
    caption_style = body.caption_style or (profile.caption_style if profile else "bold_centered")
    custom_cta = body.custom_cta or (profile.default_cta if profile else "Follow for more!")

    # If the user provided a custom CTA, rebuild full_text with it
    if custom_cta and custom_cta != script.cta:
        # Replace the CTA portion in full_text
        body_text = " ".join(script.body) if isinstance(script.body, list) else (script.body or "")
        script.full_text = " ".join(filter(None, [
            script.hook or "",
            body_text,
            script.payoff or "",
            custom_cta,
        ]))

    # Get niche
    idea    = await db.get(Idea, script.idea_id)
    channel = await db.get(Channel, idea.channel_id) if idea else None
    niche   = channel.niche if channel else "science_wow"

    video = Video(
        script_id=body.script_id,
        style=body.style,
        caption_style=caption_style,
        status=VideoStatus.rendering,
    )
    db.add(video)
    await db.commit()
    await db.refresh(video)

    job = RenderJob(
        video_id=video.id,
        script_full_text=script.full_text,
        niche=niche,
        caption_style=caption_style,
        style=body.style,
    )
    
    if profile and profile.watermark_enabled and profile.logo_path:
        from pathlib import Path
        if Path(profile.logo_path).exists():
            job.watermark_path = profile.logo_path
            job.watermark_opacity = profile.watermark_opacity or 0.4
            job.watermark_position = profile.watermark_position or "bottom_right"
            job.watermark_scale = profile.watermark_scale or 0.12

    import asyncio
    asyncio.create_task(_run_render(video.id, job))
    return _fmt(video)


@router.get("/{video_id}", response_model=VideoOut)
async def get_video(video_id: str, db: AsyncSession = Depends(get_db)):
    v = await db.get(Video, video_id)
    if not v:
        raise HTTPException(404, "Video not found")
    return _fmt(v)


@router.get("/{video_id}/preview")
async def preview_video(video_id: str, db: AsyncSession = Depends(get_db)):
    v = await db.get(Video, video_id)
    if not v or not v.path or not os.path.exists(v.path):
        raise HTTPException(404, "Video file not found")
    return FileResponse(v.path, media_type="video/mp4")


@router.patch("/{video_id}/approve", response_model=VideoOut)
async def approve_video(video_id: str, db: AsyncSession = Depends(get_db)):
    v = await db.get(Video, video_id)
    if not v:
        raise HTTPException(404, "Video not found")
    v.status = VideoStatus.approved
    await db.flush()
    return _fmt(v)


@router.patch("/{video_id}/reject", response_model=VideoOut)
async def reject_video(video_id: str, db: AsyncSession = Depends(get_db)):
    v = await db.get(Video, video_id)
    if not v:
        raise HTTPException(404, "Video not found")
    v.status = VideoStatus.rejected
    await db.flush()
    return _fmt(v)


@router.post("/{video_id}/upload")
async def upload_video(video_id: str, body: UploadIn, db: AsyncSession = Depends(get_db)):
    """Upload an approved video to YouTube as private."""
    v = await db.get(Video, video_id)
    if not v:
        raise HTTPException(404, "Video not found")
    if v.status != VideoStatus.approved:
        raise HTTPException(400, "Video must be approved before uploading")
    if not v.path or not os.path.exists(v.path):
        raise HTTPException(400, "Video file missing on disk")

    from integrations.youtube.uploader import upload_video as yt_upload
    from backend.models.models import Publication
    try:
        yt_id = yt_upload(
            v.path,
            title=body.title,
            description=body.description,
            tags=body.tags,
            privacy_status=body.privacy_status,
            made_for_kids=body.made_for_kids,
        )
    except Exception as exc:
        raise HTTPException(500, f"YouTube upload failed: {exc}")

    pub = Publication(
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
        "created_at":    str(v.created_at),
    }
