"""
Videos router — render a video from a script, approve/reject, trigger upload.
Integrates user profile for caption style, watermark, and custom CTA.
"""
from __future__ import annotations
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.models.models import Video, VideoStatus, Script, Channel, Idea, UserProfile

router = APIRouter()

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


@router.post("/render", response_model=VideoOut, status_code=201)
async def render_video(body: RenderIn, db: AsyncSession = Depends(get_db)):
    """
    Full render pipeline: TTS → visuals → FFmpeg assembly.
    Uses the user profile for caption style, CTA text, and watermark.
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
    await db.flush()

    try:
        # TTS
        from engine.tts.voiceover import generate_voiceover
        audio_dir = f"storage/audio/{video.id}"
        os.makedirs(audio_dir, exist_ok=True)
        tts = await generate_voiceover(
            script.full_text, niche=niche,
            audio_path=f"{audio_dir}/voice.mp3",
            srt_path=f"{audio_dir}/subs.srt",
        )

        # Visuals
        from engine.visuals.fetcher import fetch_clips
        visual_dir = f"storage/visuals/{video.id}"
        queries = script.visual_prompts or [idea.topic if idea else "nature"]
        clips = fetch_clips(queries[:3], clips_per_query=1, out_dir=visual_dir)
        if not clips:
            raise RuntimeError("No stock clips found — check Pexels/Pixabay API keys")

        # Watermark setup from profile
        watermark_path = None
        wm_opacity = 0.4
        wm_position = "bottom_right"
        wm_scale = 0.12
        if profile and profile.watermark_enabled and profile.logo_path:
            from pathlib import Path
            if Path(profile.logo_path).exists():
                watermark_path = profile.logo_path
                wm_opacity = profile.watermark_opacity or 0.4
                wm_position = profile.watermark_position or "bottom_right"
                wm_scale = profile.watermark_scale or 0.12

        # Assembly
        from engine.rendering.assembler import assemble_video
        out_path = f"storage/renders/{video.id}.mp4"
        assemble_video(
            [c["path"] for c in clips],
            audio_path=tts["audio_path"],
            srt_path=tts["srt_path"],
            out_path=out_path,
            style=body.style,
            caption_style=caption_style,
            watermark_path=watermark_path,
            watermark_opacity=wm_opacity,
            watermark_position=wm_position,
            watermark_scale=wm_scale,
        )

        video.path     = out_path
        video.duration = tts["duration"]
        video.status   = VideoStatus.ready
        video.ai_used  = True

    except Exception as exc:
        video.status = VideoStatus.failed
        video.notes  = str(exc)
        await db.flush()
        raise HTTPException(500, f"Render failed: {exc}")

    await db.flush()
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
        "ai_used":       v.ai_used or True,
        "notes":         v.notes,
        "created_at":    str(v.created_at),
    }
