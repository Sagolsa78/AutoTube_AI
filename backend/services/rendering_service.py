import asyncio
import json
import logging
import os
import re
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.core.config import settings
from backend.db.database import AsyncSessionLocal
from backend.models.models import (
    Asset,
    Channel,
    Idea,
    Publication,
    Script,
    ScriptStatus,
    User,
    Video,
    VideoStatus,
    YouTubeConnection,
)
from backend.storage.local import LocalStorageBackend
from backend.storage.s3 import S3StorageBackend
from engine.models import RenderJob
from engine.rendering.assembler import async_assemble_job
from engine.tts.voiceover import generate_voiceover
from engine.visuals.fetcher import async_download_clip, async_fetch_clips
from engine.visuals.router import VisualRouter
from integrations.providers.ai_providers import generate_with_fallback

log = logging.getLogger(__name__)

# Initialize storage based on config
storage = (
    S3StorageBackend()
    if settings.STORAGE_BACKEND in ["s3", "r2"]
    else LocalStorageBackend(settings.STORAGE_ROOT)
)


async def _check_cancel_pause(db, video):
    while True:
        await db.refresh(video)
        if video.status.value == "cancelled" or video.status == "cancelled":
            raise Exception("Video rendering cancelled by user.")
        if video.status.value != "paused" and video.status != "paused":
            break
        await asyncio.sleep(2)


async def _save_job_state(db, job_id: str | None, render_job: RenderJob):
    """Persist the current RenderJob payload to the Job database record for idempotency."""
    if not job_id:
        return
    from backend.models.models import Job

    db_job = await db.get(Job, job_id)
    if db_job:
        db_job.payload = render_job.model_dump()
        await db.commit()


async def _record_cost_event(
    db, user_id, channel_id, job_id, stage, cost_data, operation
):
    if not cost_data:
        return
    from backend.models.models import CostEvent, Job

    cost_event = CostEvent(
        user_id=user_id,
        channel_id=channel_id,
        job_id=job_id,
        stage=stage,
        provider=cost_data.get("provider"),
        model=cost_data.get("model"),
        tokens=cost_data.get("tokens", 0),
        duration_seconds=cost_data.get("duration_seconds", 0.0),
        units=cost_data.get("units", 0),
        estimated_cost=cost_data.get("estimated_cost", 0.0),
        operation=operation,
    )
    db.add(cost_event)

    if job_id:
        db_job = await db.get(Job, job_id)
        if db_job:
            db_job.cost_usd = (db_job.cost_usd or 0.0) + cost_data.get(
                "estimated_cost", 0.0
            )
    await db.commit()


async def run_job(video_id: str, job: RenderJob, job_id: str = None):
    """
    Background render task.
    Writes stage updates to the database so the frontend can poll progress.
    Always cleans up the temporary workspace, whether the job succeeds or fails.
    """
    if isinstance(job.story_spec, dict):
        from engine.story.schemas import StorySpec

        job.story_spec = StorySpec.model_validate(job.story_spec)

    workspace = Path(f"/tmp/autotube/{job_id or video_id}")
    workspace.mkdir(parents=True, exist_ok=True)
    audio_dir = workspace / "audio"
    visual_dir = workspace / "visuals"
    audio_dir.mkdir(exist_ok=True)
    visual_dir.mkdir(exist_ok=True)

    async with AsyncSessionLocal() as db:
        try:
            video = await db.get(Video, video_id)
            if not video:
                log.warning(f"Video {video_id} not found in run_job.")
                return

            if job_id:
                from backend.models.models import Job

                db_job = await db.get(Job, job_id)
                if db_job and db_job.user_id != video.user_id:
                    log.error(
                        f"Tenant isolation violation: Job {job_id} (user {db_job.user_id}) attempted to render Video {video_id} (user {video.user_id})"
                    )
                    raise PermissionError("Cross-tenant rendering attempt blocked.")

            log.info(f"Starting background render for video {video_id}")
            profile = await db.get(User, video.user_id)

            import shutil

            if not shutil.which("ffmpeg"):
                raise RuntimeError("FFmpeg is not installed or not in PATH.")
            if not shutil.which("ffprobe"):
                raise RuntimeError("ffprobe is not installed or not in PATH.")

            q = (
                select(Script)
                .where(Script.id == video.script_id)
                .options(selectinload(Script.scenes))
            )
            res = await db.execute(q)
            script = res.scalars().first()
            idea = await db.get(Idea, script.idea_id) if script else None
            channel = await db.get(Channel, idea.channel_id) if idea else None

            # ── Stage 1: TTS ──────────────────────────────────────────────
            await _check_cancel_pause(db, video)
            video.render_stage = "tts"
            video.render_progress = 10
            await db.commit()

            if (
                job.audio_path
                and os.path.exists(job.audio_path)
                and job.sub_path
                and os.path.exists(job.sub_path)
            ):
                log.info(f"Skipping TTS, valid audio already exists for job {job_id}")
            else:
                voice_id = video.voice_override or (
                    channel.default_voice_id if channel else "en-US-ChristopherNeural"
                )

                tts = await generate_voiceover(
                    job.story_spec.get_full_text(),
                    niche=job.niche,
                    voice=voice_id,
                    audio_path=str(audio_dir / "voice.mp3"),
                    sub_path=str(audio_dir / "subs.ass"),
                    language=job.language,
                )
                job.audio_path = tts["audio_path"]
                job.sub_path = tts["sub_path"]
                job.duration = tts["duration"]
                job.voice = tts["voice"]
                job.word_boundaries = tts.get("word_boundaries", [])

                if "cost_data" in tts:
                    await _record_cost_event(
                        db,
                        profile.id,
                        channel.id if channel else None,
                        job_id,
                        "TTS",
                        tts["cost_data"],
                        "generate_voiceover",
                    )

                await _save_job_state(db, job_id, job)

            # ── Stage 2: Visuals (scene-aware with asset caching) ─────────
            await _check_cancel_pause(db, video)
            video.render_stage = "visuals"
            video.render_progress = 30
            await db.commit()

            valid_clip_paths = []
            used_source_ids = set()

            # Check idempotency for entire visual stage
            clips_are_valid = bool(
                job.clip_paths and all(os.path.exists(cp) for cp in job.clip_paths)
            )
            if clips_are_valid:
                log.info(
                    f"Skipping Visuals fetching, valid clip_paths exist for job {job_id}"
                )
                valid_clip_paths = job.clip_paths
            else:
                if script and script.scenes:
                    scenes = sorted(script.scenes, key=lambda x: x.scene_number)
                    for i, scene in enumerate(scenes):
                        video.render_progress = 30 + (30 * (i / len(scenes)))
                        await db.commit()

                        await _check_cancel_pause(db, video)
                        asset_path = None

                        # Idempotency per scene
                        scene_spec = job.story_spec.scenes[i]
                        if scene_spec.asset_path and os.path.exists(
                            scene_spec.asset_path
                        ):
                            asset_path = scene_spec.asset_path
                            log.info(
                                f"Skipping asset fetch for scene {scene.scene_number}, already cached."
                            )
                        else:
                            if scene.asset_id:
                                asset = await db.get(Asset, scene.asset_id)
                                if asset and asset.path and os.path.exists(asset.path):
                                    asset_path = asset.path
                                elif asset and asset.asset_metadata.get("download_url"):
                                    log.info(f"Re-downloading missing asset {asset.id}")
                                    try:
                                        asset_path = await async_download_clip(
                                            asset.asset_metadata["download_url"],
                                            str(visual_dir),
                                            asset.source,
                                        )
                                        asset.path = asset_path
                                        await db.commit()
                                    except Exception as e:
                                        log.warning(
                                            f"Failed to re-download asset {asset.id}: {e}"
                                        )

                            if not asset_path:
                                router = VisualRouter(
                                    str(visual_dir), user_id=video.user_id
                                )
                                scene_dict = scene_spec.model_dump()

                                asset_path = await router.resolve_asset(
                                    scene_dict,
                                    idea.topic if idea else "",
                                    used_source_ids,
                                )

                                if "asset_id" in scene_dict:
                                    scene.asset_id = scene_dict["asset_id"]
                                    scene_spec.asset_id = scene_dict["asset_id"]
                                    await db.commit()

                        if asset_path and os.path.getsize(asset_path) > 10_000:
                            valid_clip_paths.append(asset_path)
                            job.story_spec.scenes[i].asset_path = asset_path
                        else:
                            log.warning(
                                f"Failed to resolve valid asset for scene {scene.scene_number}"
                            )
                else:
                    queries = (
                        script.visual_prompts or [idea.topic if idea else "nature"]
                        if script
                        else ["nature"]
                    )
                    clips = await async_fetch_clips(
                        queries, clips_per_query=1, out_dir=str(visual_dir)
                    )
                    valid_clip_paths = [
                        c["path"] for c in clips if os.path.getsize(c["path"]) > 10_000
                    ]

                if not valid_clip_paths:
                    raise RuntimeError(
                        "No stock clips found or successfully downloaded — check API keys and network"
                    )

                job.clip_paths = valid_clip_paths
                await _save_job_state(db, job_id, job)

            # ── Stage 3: Assembly ─────────────────────────────────────────
            await _check_cancel_pause(db, video)
            video.render_stage = "assembly"
            video.render_progress = 60
            await db.commit()

            # Use temporary directory for output
            job.output_path = str(workspace / "output.mp4")

            if (
                job.output_path
                and os.path.exists(job.output_path)
                and os.path.getsize(job.output_path) > 0
            ):
                log.info(
                    f"Skipping assembly, valid output video already exists for job {job_id}"
                )
            else:
                import time

                start_time = time.monotonic()
                await async_assemble_job(job)
                duration_seconds = time.monotonic() - start_time

                # Assume rough cloud compute cost (e.g. $0.50 per hour of T4 GPU)
                estimated_compute_cost = (duration_seconds / 3600.0) * 0.50
                compute_cost_data = {
                    "provider": "local_ffmpeg",
                    "model": "ffmpeg",
                    "duration_seconds": duration_seconds,
                    "estimated_cost": estimated_compute_cost,
                }
                await _record_cost_event(
                    db,
                    profile.id,
                    channel.id if channel else None,
                    job_id,
                    "RENDER",
                    compute_cost_data,
                    "ffmpeg_assembly",
                )

                await _save_job_state(db, job_id, job)

            # Upload to storage
            remote_key = f"users/{video.user_id}/videos/{video.id}.mp4"
            try:
                public_url = await storage.put_file(job.output_path, remote_key)
                video.path = remote_key
                video.notes = f"Uploaded to {settings.STORAGE_BACKEND}"
                log.info(
                    f"Video {video.id} uploaded to {settings.STORAGE_BACKEND}: {remote_key}"
                )
            except Exception as st_err:
                if settings.STORAGE_BACKEND != "local":
                    raise RuntimeError(
                        f"Storage upload failed ({settings.STORAGE_BACKEND}): {st_err}"
                    )
                log.warning(f"Failed to upload video to local storage: {st_err}")
                video.path = (
                    job.output_path
                )  # Fallback to local temp path (not recommended but keeps it working)

            # Persist path immediately to prevent db.refresh in _check_cancel_pause wiping it
            saved_path = video.path
            await db.commit()

            # ── Stage 4: Metadata ─────────────────────────────────────────
            await _check_cancel_pause(db, video)
            # Set status and path NOW (after db.refresh in _check_cancel_pause)
            video.path = saved_path
            video.duration = job.duration
            video.status = VideoStatus.ready
            video.ai_used = True
            video.render_stage = "metadata"
            video.render_progress = 80
            await db.commit()

            # Get channel for metadata preferences
            channel = await db.get(Channel, idea.channel_id) if idea else None
            title_style = (
                getattr(channel, "title_style_preference", None) or "curiosity"
            )
            default_tags = (
                getattr(channel, "hashtag_set", None)
                or getattr(profile, "hashtag_set", None)
                or ["shorts", "viral"]
            )

            meta_prompt = f"""You are an expert YouTube Shorts SEO manager.
Based on the following video script, generate metadata for the YouTube upload.
Title Style: {title_style}
Topics: {idea.topic if idea else ''}
Script: {job.story_spec.get_full_text()}

Respond ONLY with a JSON object in this exact format (no markdown):
{{
  "title_candidates": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"],
  "description": "A 2-line keyword-rich description of the video.",
  "hashtags": ["tag1", "tag2", "tag3"]
}}"""
            try:
                meta_res, _ = generate_with_fallback(meta_prompt)
                cleaned_meta = (
                    re.sub(r"```(?:json)?", "", meta_res).strip().rstrip("```").strip()
                )
                meta_json = json.loads(cleaned_meta)
                video.title_candidates = meta_json.get("title_candidates", [])
                video.description = meta_json.get("description", "")
                video.hashtags = list(set(default_tags + meta_json.get("hashtags", [])))
                metadata_success = True
            except Exception as meta_exc:
                metadata_success = False
                log.error("Metadata generation failed: %s", meta_exc)
                video.notes = (
                    video.notes or ""
                ) + f" Metadata generation failed: {meta_exc}"
                video.title_candidates = [idea.title] if idea else ["Untitled Short"]
                video.description = "Auto-generated YouTube Short."
                video.hashtags = default_tags

            if video.title_candidates:
                video.selected_title = video.title_candidates[0]

            # Commit metadata fields immediately before _check_cancel_pause refreshes DB
            await db.commit()

            # Video is ready for user preview and approval.
            log.info(
                f"Render completed. Video {video_id} metadata generated successfully."
            )

            # ── Stage 5: Done ─────────────────────────────────────────────
            await _check_cancel_pause(db, video)
            video.path = saved_path

            channel = await db.get(Channel, idea.channel_id) if idea else None
            auto_approve = channel.auto_approve if channel else False

            if auto_approve:
                if metadata_success:
                    log.info(
                        f"Auto-publishing video {video_id} because channel.auto_approve is True"
                    )
                    from integrations.youtube.uploader import upload_video as yt_upload

                    try:
                        yt_id = await yt_upload(
                            user_id=video.user_id,
                            video_path=saved_path,
                            title=video.selected_title,
                            description=video.description,
                            tags=video.hashtags,
                            privacy_status="private",
                            made_for_kids=False,
                        )
                        pub = Publication(
                            user_id=video.user_id,
                            video_id=video_id,
                            youtube_id=yt_id,
                            url=f"https://youtu.be/{yt_id}",
                            title=video.selected_title,
                            description=video.description,
                            status="live",
                            privacy_status="public",
                        )
                        db.add(pub)
                        video.status = VideoStatus.uploaded
                    except Exception as upload_exc:
                        log.error(f"Auto-publish failed for {video_id}: {upload_exc}")
                        video.status = VideoStatus.publish_failed
                        video.notes = (
                            video.notes or ""
                        ) + f"\nAuto-publish failed: {upload_exc}"
                        pub = Publication(
                            user_id=video.user_id,
                            video_id=video_id,
                            youtube_id="",
                            url="",
                            title=video.selected_title,
                            description=video.description,
                            status="draft",
                            privacy_status="private",
                        )
                        db.add(pub)
                else:
                    log.info(
                        f"Skipping auto-publish for {video_id} because metadata failed."
                    )
                    video.status = VideoStatus.ready
                    pub = Publication(
                        user_id=video.user_id,
                        video_id=video_id,
                        youtube_id="",
                        url="",
                        title=video.selected_title,
                        description=video.description,
                        status="draft",
                        privacy_status="private",
                    )
                    db.add(pub)
            else:
                video.status = VideoStatus.ready

            video.render_stage = "done"
            video.render_progress = 100
            script.status = ScriptStatus.used_in_render
            await db.commit()
            log.info(f"Background render completed successfully for video {video_id}")
            # Workspace cleanup is now handled in the finally block below

        except Exception as exc:
            log.exception(f"Background render failed for video {video_id}: {exc}")
            video = await db.get(Video, video_id)
            if video:
                video.status = VideoStatus.failed
                video.render_stage = "failed"
                video.render_progress = 0
                video.notes = str(exc)
                await db.commit()
        finally:
            # Always clean up temp workspace — success, failure, or cancellation
            import shutil as _shutil

            video_final_path = None
            is_failed = False
            try:
                # Check if video.path is inside the workspace (local fallback)
                v_check = await db.get(Video, video_id)
                if v_check:
                    video_final_path = v_check.path
                    is_failed = v_check.status == VideoStatus.failed
            except Exception:
                pass

            try:
                path_is_remote = not str(video_final_path or "").startswith(
                    str(workspace)
                )
                if is_failed:
                    log.info(
                        f"Skipping workspace cleanup — video failed. Retaining artifacts at {workspace} for retry."
                    )
                elif path_is_remote and workspace.exists():
                    _shutil.rmtree(workspace, ignore_errors=True)
                    log.info(f"Cleaned up workspace {workspace}")
                elif not path_is_remote:
                    log.warning(
                        f"Skipping workspace cleanup — video.path is local fallback inside workspace: {video_final_path}. "
                        f"Workspace at {workspace} will persist until manually cleaned."
                    )
            except Exception as cleanup_err:
                log.error(f"Failed to cleanup workspace {workspace}: {cleanup_err}")


async def generate_video_metadata(video_id: str) -> bool:
    """Generates SEO metadata (titles, description, hashtags) for a video on demand."""
    async with AsyncSessionLocal() as db:
        video = await db.get(Video, video_id)
        if not video:
            return False
        script = await db.get(Script, video.script_id) if video.script_id else None
        idea = await db.get(Idea, script.idea_id) if script else None
        profile = await db.get(User, video.user_id) if video.user_id else None
        channel = await db.get(Channel, idea.channel_id) if idea else None

        title_style = getattr(channel, "title_style_preference", None) or "curiosity"
        default_tags = (
            getattr(channel, "hashtag_set", None)
            or getattr(profile, "hashtag_set", None)
            or ["shorts", "viral"]
        )
        script_text = (
            script.full_text
            if script and script.full_text
            else (idea.topic if idea else "YouTube Short")
        )

        meta_prompt = f"""You are an expert YouTube Shorts SEO manager.
Based on the following video script, generate metadata for the YouTube upload.
Title Style: {title_style}
Topics: {idea.topic if idea else ''}
Script: {script_text}

Respond ONLY with a JSON object in this exact format (no markdown):
{{
  "title_candidates": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"],
  "description": "A 2-line keyword-rich description of the video.",
  "hashtags": ["tag1", "tag2", "tag3"]
}}"""
        try:
            meta_res, prov, cost_data = generate_with_fallback(meta_prompt)
            cleaned_meta = (
                re.sub(r"```(?:json)?", "", meta_res).strip().rstrip("```").strip()
            )
            meta_json = json.loads(cleaned_meta)
            video.title_candidates = meta_json.get("title_candidates", [])
            video.description = meta_json.get("description", "")
            video.hashtags = list(set(default_tags + meta_json.get("hashtags", [])))

            if cost_data:
                await _record_cost_event(
                    db,
                    profile.id if profile else None,
                    channel.id if channel else None,
                    None,
                    "QA",
                    cost_data,
                    "generate_metadata",
                )
        except Exception as meta_exc:
            log.error("Metadata generation failed for %s: %s", video_id, meta_exc)
            video.title_candidates = [idea.title] if idea else ["Untitled Short"]
            video.description = "Auto-generated YouTube Short."
            video.hashtags = default_tags

        if video.title_candidates:
            video.selected_title = video.title_candidates[0]

        await db.commit()
        return True
