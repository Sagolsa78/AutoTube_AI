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
from backend.models.models import Video, VideoStatus, Script, Channel, Idea, UserProfile, ScriptStatus, Scene
from engine.models import RenderJob

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
    db: AsyncSession = Depends(get_db),
):
    q = select(Video)
    if status:
        q = q.where(Video.status == status)
    result = await db.execute(q)
    return [_fmt(v) for v in result.scalars().all()]


@router.get("/{video_id}/progress")
async def get_render_progress(video_id: str, db: AsyncSession = Depends(get_db)):
    """Lightweight endpoint for polling render progress."""
    v = await db.get(Video, video_id)
    if not v:
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


async def _run_render(video_id: str, job: RenderJob):
    """Background render task — runs after HTTP response is sent.
    Now writes stage updates to the database so the frontend can poll progress.
    Uses scene visual_descriptions for clip queries instead of generic visual_prompts.
    """
    async with AsyncSessionLocal() as db:
        try:
            video = await db.get(Video, video_id)
            if not video:
                log.warning(f"Video {video_id} not found in _run_render.")
                return

            log.info(f"Starting background render for video {video_id}")
            
            profile = await db.get(UserProfile, DEFAULT_PROFILE_ID)
            
            # ── Stage 1: TTS ──────────────────────────────────────────────
            video.render_stage = "tts"
            video.render_progress = 10
            await db.commit()
            
            from engine.tts.voiceover import generate_voiceover
            audio_dir = f"storage/audio/{video.id}"
            os.makedirs(audio_dir, exist_ok=True)
            
            voice_id = video.voice_override or (profile.default_voice_id if profile else "en-US-ChristopherNeural")
            
            tts = await generate_voiceover(
                job.script_full_text, niche=job.niche,
                voice=voice_id,
                audio_path=f"{audio_dir}/voice.mp3",
                sub_path=f"{audio_dir}/subs.ass",
            )
            job.audio_path = tts["audio_path"]
            job.sub_path = tts["sub_path"]
            job.duration = tts["duration"]
            job.voice = tts["voice"]
            job.word_boundaries = tts.get("word_boundaries", [])

            # ── Stage 2: Visuals (scene-aware) ────────────────────────────
            video.render_stage = "visuals"
            video.render_progress = 30
            await db.commit()
            
            from engine.visuals.fetcher import async_fetch_clips
            visual_dir = f"storage/visuals/{video.id}"
            
            # Load script with scenes for scene-aware clip fetching
            q = select(Script).where(Script.id == video.script_id).options(selectinload(Script.scenes))
            res = await db.execute(q)
            script = res.scalars().first()
            idea = await db.get(Idea, script.idea_id) if script else None
            
            # Use scene visual_descriptions as clip queries (scene-aware)
            if script and script.scenes:
                queries = [sc.visual_description for sc in sorted(script.scenes, key=lambda x: x.scene_number) if sc.visual_description]
            else:
                # Fallback to old visual_prompts or topic
                queries = script.visual_prompts or [idea.topic if idea else "nature"] if script else ["nature"]
            
            if not queries:
                queries = [idea.topic if idea else "nature"]
            
            # Fetch one clip per scene query for better scene-to-clip alignment
            clips = await async_fetch_clips(queries, clips_per_query=1, out_dir=visual_dir)
            if not clips:
                raise RuntimeError("No stock clips found — check Pexels/Pixabay API keys")
            
            # Filter out zero-byte clips
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

            # ── Stage 3: Assembly ─────────────────────────────────────────
            video.render_stage = "assembly"
            video.render_progress = 60
            await db.commit()
            
            from engine.rendering.assembler import async_assemble_job
            await async_assemble_job(job)

            video.path = job.output_path
            video.duration = job.duration
            video.status = VideoStatus.ready
            video.ai_used = True
            video.notes = None

            # ── Stage 4: Metadata ─────────────────────────────────────────
            video.render_stage = "metadata"
            video.render_progress = 80
            await db.commit()
            
            from integrations.providers.ai_providers import generate_with_fallback
            import json
            import re
            
            title_style = profile.title_style_preference if profile else "curiosity"
            default_tags = profile.hashtag_set if profile and profile.hashtag_set else ["shorts", "viral"]
            
            meta_prompt = f"""You are an expert YouTube Shorts SEO manager.
Based on the following video script, generate metadata for the YouTube upload.
Title Style: {title_style}
Topics: {idea.topic if idea else ''}
Script: {job.script_full_text}

Respond ONLY with a JSON object in this exact format (no markdown):
{{
  "title_candidates": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"],
  "description": "A 2-line keyword-rich description of the video.",
  "hashtags": ["tag1", "tag2", "tag3"]
}}"""
            try:
                meta_res, _ = generate_with_fallback(meta_prompt)
                cleaned_meta = re.sub(r"```(?:json)?", "", meta_res).strip().rstrip("```").strip()
                meta_json = json.loads(cleaned_meta)
                video.title_candidates = meta_json.get("title_candidates", [])
                video.description = meta_json.get("description", "")
                video.hashtags = list(set(default_tags + meta_json.get("hashtags", [])))
                metadata_success = True
            except Exception as meta_exc:
                metadata_success = False
                log.error("Metadata generation failed: %s", meta_exc)
                video.notes = f"Metadata generation failed: {meta_exc}"
                video.title_candidates = [idea.title] if idea else ["Untitled Short"]
                video.description = "Auto-generated YouTube Short."
                video.hashtags = default_tags
                
            if video.title_candidates:
                video.selected_title = video.title_candidates[0]
            
            # Draft Upload to YouTube
            from integrations.youtube.uploader import upload_video as yt_upload
            from backend.settings import YOUTUBE_TOKEN_FILE
            from backend.models.models import Publication
            
            if YOUTUBE_TOKEN_FILE.exists():
                try:
                    yt_id = yt_upload(
                        video.path,
                        title=video.selected_title or "Draft Short",
                        description=f"{video.description}\n\n{' '.join(['#'+t for t in video.hashtags])}",
                        tags=video.hashtags,
                        privacy_status="private",
                        made_for_kids=False,
                    )
                    pub = Publication(
                        video_id=video.id,
                        youtube_id=yt_id,
                        url=f"https://youtu.be/{yt_id}",
                        title=video.selected_title,
                        description=video.description,
                        tags=video.hashtags,
                        privacy_status="private",
                        status="draft",
                    )
                    db.add(pub)
                    log.info("Draft video uploaded to YouTube: %s", yt_id)
                    
                    if profile.auto_approve and metadata_success:
                        try:
                            # Make it public immediately
                            from integrations.youtube.uploader import _get_credentials
                            from googleapiclient.discovery import build
                            creds = _get_credentials()
                            youtube = build("youtube", "v3", credentials=creds)
                            youtube.videos().update(part="status", body={
                                "id": yt_id,
                                "status": {"privacyStatus": "public"}
                            }).execute()
                            pub.privacy_status = "public"
                            pub.status = "live"
                            video.status = VideoStatus.uploaded
                            log.info("Auto-approve enabled: Video %s made public immediately", yt_id)
                        except Exception as publish_exc:
                            video.status = VideoStatus.publish_failed
                            video.notes = f"Auto-publish failed: {publish_exc}"
                            log.error("Draft upload succeeded, but auto-publish failed: %s", publish_exc)
                except Exception as upload_exc:
                    log.warning("Draft YouTube upload failed: %s", upload_exc)
            
            # ── Stage 5: Done ─────────────────────────────────────────────
            video.render_stage = "done"
            video.render_progress = 100
            script.status = ScriptStatus.used_in_render
            await db.commit()
            log.info(f"Background render completed successfully for video {video_id} -> {job.output_path}")
        except Exception as exc:
            log.exception(f"Background render failed for video {video_id}: {exc}")
            video = await db.get(Video, video_id)
            if video:
                video.status = VideoStatus.failed
                video.render_stage = "failed"
                video.render_progress = 0
                video.notes = str(exc)
                await db.commit()


@router.post("/render", response_model=VideoOut, status_code=202)
async def render_video(body: RenderIn, bg: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """
    Queue render pipeline: TTS → visuals → FFmpeg assembly.
    """
    q = select(Script).where(Script.id == body.script_id).options(selectinload(Script.scenes))
    res = await db.execute(q)
    script = res.scalars().first()
    if not script:
        raise HTTPException(404, "Script not found")
    if not script.full_text:
        raise HTTPException(400, "Script has no full_text — regenerate it")

    # Load user profile for defaults
    profile = await db.get(UserProfile, DEFAULT_PROFILE_ID)
    caption_style = body.caption_style or (profile.caption_style if profile else "bold_centered")

    # Get niche
    idea    = await db.get(Idea, script.idea_id)
    channel = await db.get(Channel, idea.channel_id) if idea else None
    niche   = channel.niche if channel else "science_wow"
    
    script.status = ScriptStatus.used_in_render

    video = Video(
        script_id=body.script_id,
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


@router.patch("/{video_id}", response_model=VideoOut)
async def update_video(video_id: str, body: VideoUpdateIn, db: AsyncSession = Depends(get_db)):
    v = await db.get(Video, video_id)
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


@router.get("/{video_id}/preview")
async def preview_video(video_id: str, db: AsyncSession = Depends(get_db)):
    v = await db.get(Video, video_id)
    if not v or not v.path or not os.path.exists(v.path):
        raise HTTPException(404, "Video file not found")
    return FileResponse(v.path, media_type="video/mp4")


@router.patch("/{video_id}/approve", response_model=VideoOut)
async def approve_video(video_id: str, body: ApproveIn | None = None, db: AsyncSession = Depends(get_db)):
    v = await db.get(Video, video_id)
    if not v:
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
            creds = _get_credentials()
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
        "render_stage":    v.render_stage or "queued",
        "render_progress": v.render_progress or 0,
        "title_candidates": v.title_candidates or [],
        "selected_title":   v.selected_title,
        "description":      v.description,
        "hashtags":         v.hashtags or [],
        "voice_override":   v.voice_override,
        "created_at":    str(v.created_at),
    }
