import os
import logging
import asyncio
import json
import re
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.db.database import AsyncSessionLocal
from backend.models.models import Video, VideoStatus, Script, ScriptStatus, Idea, User, Asset, Publication, YouTubeConnection
from engine.models import RenderJob
from engine.tts.voiceover import generate_voiceover
from engine.visuals.fetcher import async_download_clip, async_fetch_clips
from engine.visuals.router import VisualRouter
from engine.rendering.assembler import async_assemble_job
from backend.storage.local import LocalStorage
from backend.storage.s3 import S3Storage
from backend.core.config import settings
from integrations.providers.ai_providers import generate_with_fallback

log = logging.getLogger(__name__)

# Initialize storage based on config
storage = S3Storage() if settings.STORAGE_BACKEND in ["s3", "r2"] else LocalStorage(settings.STORAGE_ROOT)

async def _check_cancel_pause(db, video):
    while True:
        await db.refresh(video)
        if video.status.value == "cancelled" or video.status == "cancelled":
            raise Exception("Video rendering cancelled by user.")
        if video.status.value != "paused" and video.status != "paused":
            break
        await asyncio.sleep(2)

async def run_job(video_id: str, job: RenderJob):
    """
    Background render task.
    Writes stage updates to the database so the frontend can poll progress.
    """
    async with AsyncSessionLocal() as db:
        try:
            video = await db.get(Video, video_id)
            if not video:
                log.warning(f"Video {video_id} not found in run_job.")
                return

            log.info(f"Starting background render for video {video_id}")
            profile = await db.get(User, video.user_id)

            # ── Temp Workspace ──────────────────────────────────────────────
            workspace = Path(f"/tmp/autotube/{video_id}")
            workspace.mkdir(parents=True, exist_ok=True)
            audio_dir = workspace / "audio"
            visual_dir = workspace / "visuals"
            audio_dir.mkdir(exist_ok=True)
            visual_dir.mkdir(exist_ok=True)

            # ── Stage 1: TTS ──────────────────────────────────────────────
            await _check_cancel_pause(db, video)
            video.render_stage = "tts"
            video.render_progress = 10
            await db.commit()
            
            voice_id = video.voice_override or (profile.default_voice_id if profile else "en-US-ChristopherNeural")
            
            tts = await generate_voiceover(
                job.story_spec.get_full_text(), niche=job.niche,
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

            # ── Stage 2: Visuals (scene-aware with asset caching) ─────────
            await _check_cancel_pause(db, video)
            video.render_stage = "visuals"
            video.render_progress = 30
            await db.commit()
            
            q = select(Script).where(Script.id == video.script_id).options(selectinload(Script.scenes))
            res = await db.execute(q)
            script = res.scalars().first()
            idea = await db.get(Idea, script.idea_id) if script else None
            
            valid_clip_paths = []
            used_source_ids = set()
            
            if script and script.scenes:
                scenes = sorted(script.scenes, key=lambda x: x.scene_number)
                for i, scene in enumerate(scenes):
                    video.render_progress = 30 + (30 * (i / len(scenes)))
                    await db.commit()
                    
                    await _check_cancel_pause(db, video)
                    asset_path = None
                    
                    if scene.asset_id:
                        asset = await db.get(Asset, scene.asset_id)
                        if asset and asset.path and os.path.exists(asset.path):
                            asset_path = asset.path
                        elif asset and asset.asset_metadata.get("download_url"):
                            log.info(f"Re-downloading missing asset {asset.id}")
                            try:
                                asset_path = await async_download_clip(asset.asset_metadata["download_url"], str(visual_dir), asset.source)
                                asset.path = asset_path
                                await db.commit()
                            except Exception as e:
                                log.warning(f"Failed to re-download asset {asset.id}: {e}")
                    
                    if not asset_path:
                        router = VisualRouter(str(visual_dir))
                        scene_spec = job.story_spec.scenes[i]
                        scene_dict = scene_spec.model_dump()
                        
                        asset_path = await router.resolve_asset(scene_dict, idea.topic if idea else "", used_source_ids)
                        
                        if "asset_id" in scene_dict:
                            scene.asset_id = scene_dict["asset_id"]
                            scene_spec.asset_id = scene_dict["asset_id"]
                            await db.commit()
                    
                    if asset_path and os.path.getsize(asset_path) > 10_000:
                        valid_clip_paths.append(asset_path)
                        job.story_spec.scenes[i].asset_path = asset_path
                    else:
                        log.warning(f"Failed to resolve valid asset for scene {scene.scene_number}")
            else:
                queries = script.visual_prompts or [idea.topic if idea else "nature"] if script else ["nature"]
                clips = await async_fetch_clips(queries, clips_per_query=1, out_dir=str(visual_dir))
                valid_clip_paths = [c["path"] for c in clips if os.path.getsize(c["path"]) > 10_000]

            if not valid_clip_paths:
                raise RuntimeError("No stock clips found or successfully downloaded — check API keys and network")

            job.clip_paths = valid_clip_paths

            # ── Stage 3: Assembly ─────────────────────────────────────────
            await _check_cancel_pause(db, video)
            video.render_stage = "assembly"
            video.render_progress = 60
            await db.commit()
            
            # Use temporary directory for output
            job.output_path = str(workspace / "output.mp4")
            await async_assemble_job(job)

            # Upload to storage
            remote_key = f"users/{video.user_id}/videos/{video.id}.mp4"
            try:
                public_url = await storage.put_file(job.output_path, remote_key)
                video.path = remote_key
                video.notes = f"Uploaded to {settings.STORAGE_BACKEND}"
                log.info(f"Video {video.id} uploaded to {settings.STORAGE_BACKEND}: {remote_key}")
            except Exception as st_err:
                log.warning(f"Failed to upload video to storage: {st_err}")
                video.path = job.output_path # Fallback to local temp path (not recommended but keeps it working)

            video.duration = job.duration
            video.status = VideoStatus.ready
            video.ai_used = True

            # ── Stage 4: Metadata ─────────────────────────────────────────
            await _check_cancel_pause(db, video)
            video.render_stage = "metadata"
            video.render_progress = 80
            await db.commit()
            
            title_style = profile.title_style_preference if profile else "curiosity"
            default_tags = profile.hashtag_set if profile and profile.hashtag_set else ["shorts", "viral"]
            
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
                cleaned_meta = re.sub(r"```(?:json)?", "", meta_res).strip().rstrip("```").strip()
                meta_json = json.loads(cleaned_meta)
                video.title_candidates = meta_json.get("title_candidates", [])
                video.description = meta_json.get("description", "")
                video.hashtags = list(set(default_tags + meta_json.get("hashtags", [])))
                metadata_success = True
            except Exception as meta_exc:
                metadata_success = False
                log.error("Metadata generation failed: %s", meta_exc)
                video.notes = (video.notes or "") + f" Metadata generation failed: {meta_exc}"
                video.title_candidates = [idea.title] if idea else ["Untitled Short"]
                video.description = "Auto-generated YouTube Short."
                video.hashtags = default_tags
                
            if video.title_candidates:
                video.selected_title = video.title_candidates[0]
            
            # Draft Upload to YouTube
            from integrations.youtube.uploader import upload_video as yt_upload, _get_credentials
            from googleapiclient.discovery import build
            
            yt_conn_q = select(YouTubeConnection).where(YouTubeConnection.user_id == video.user_id)
            yt_conn_res = await db.execute(yt_conn_q)
            yt_conn = yt_conn_res.scalars().first()
            
            if yt_conn and yt_conn.access_token:
                try:
                    # if video.path is a key, we need a local file for yt_upload.
                    # if we uploaded it, job.output_path still exists.
                    upload_path = job.output_path if os.path.exists(job.output_path) else video.path
                    
                    yt_id = await yt_upload(
                        user_id=video.user_id,
                        video_path=upload_path,
                        title=video.selected_title or "Draft Short",
                        description=f"{video.description}\n\n{' '.join(['#'+t for t in video.hashtags])}",
                        tags=video.hashtags,
                        privacy_status="private",
                        made_for_kids=False,
                    )
                    pub = Publication(
                        user_id=video.user_id,
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
                            creds = await _get_credentials(video.user_id)
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
            await _check_cancel_pause(db, video)
            video.render_stage = "done"
            video.render_progress = 100
            script.status = ScriptStatus.used_in_render
            await db.commit()
            log.info(f"Background render completed successfully for video {video_id}")
            
            # Cleanup temp directory
            import shutil
            try:
                shutil.rmtree(workspace)
            except Exception as e:
                log.error(f"Failed to cleanup workspace {workspace}: {e}")

        except Exception as exc:
            log.exception(f"Background render failed for video {video_id}: {exc}")
            video = await db.get(Video, video_id)
            if video:
                video.status = VideoStatus.failed
                video.render_stage = "failed"
                video.render_progress = 0
                video.notes = str(exc)
                await db.commit()
