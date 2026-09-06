"""
Phase 18: Durable Queue Worker
Polls the database for jobs in the 'rendering' state and executes them sequentially.
Replaces transient in-memory asyncio.create_task.
"""
import logging
import asyncio
from backend.db.database import AsyncSessionLocal
from backend.models.models import Video, VideoStatus, Script, Idea, Channel, UserProfile
from sqlalchemy import select
from sqlalchemy.orm import selectinload

log = logging.getLogger(__name__)

# Single background task reference
_WORKER_TASK = None

async def poll_jobs():
    """Continuously polls the database for rendering jobs and processes them one by one."""
    log.info("[Worker] Started durable job polling loop.")
    from backend.api.routes.videos import _run_render
    from engine.models import RenderJob
    
    while True:
        try:
            async with AsyncSessionLocal() as db:
                # Find the oldest video stuck in rendering
                q = select(Video).where(Video.status == VideoStatus.rendering).order_by(Video.created_at.asc()).limit(1)
                res = await db.execute(q)
                video = res.scalars().first()
                
                if video:
                    log.info(f"[Worker] Found pending job for video: {video.id}")
                    
                    # Reconstruct RenderJob from database
                    script_q = select(Script).where(Script.id == video.script_id).options(selectinload(Script.scenes))
                    script_res = await db.execute(script_q)
                    script = script_res.scalars().first()
                    
                    if not script:
                        video.status = VideoStatus.failed
                        video.notes = "Script missing."
                        await db.commit()
                        continue
                        
                    idea = await db.get(Idea, script.idea_id)
                    channel = await db.get(Channel, idea.channel_id) if idea else None
                    profile = await db.get(UserProfile, video.tenant_id)
                    
                    spec_data = script.body or {}
                    spec_scenes = {s.get("scene_number"): s for s in spec_data.get("scenes", [])}
                    
                    scenes_data = []
                    for s in sorted(script.scenes, key=lambda x: x.scene_number):
                        s_spec = spec_scenes.get(s.scene_number, {})
                        scenes_data.append({
                            "scene_number": s.scene_number,
                            "narration": s.narration,
                            "scene_id": s.id,
                            "visual_description": s.visual_description,
                            "preferred_visual_mode": s_spec.get("preferred_visual_mode", "STOCK")
                        })
                        
                    job = RenderJob(
                        video_id=video.id,
                        script_full_text=script.full_text,
                        niche=channel.niche if channel else "science_wow",
                        caption_style=video.caption_style,
                        style=video.style,
                        language=channel.language if channel else "en",
                        scenes_data=scenes_data
                    )
                    
                    if profile and profile.watermark_enabled and profile.logo_path:
                        import os
                        if os.path.exists(profile.logo_path):
                            job.watermark_path = profile.logo_path
                            job.watermark_opacity = profile.watermark_opacity or 0.4
                            job.watermark_position = profile.watermark_position or "bottom_right"
                            job.watermark_scale = profile.watermark_scale or 0.12

            if video:
                # Execute it (outside the db session so _run_render can manage its own)
                # Wait, _run_render doesn't assume much, but it creates its own session.
                # If we await it here, we process sequentially.
                try:
                    await _run_render(video.id, job)
                except Exception as e:
                    log.error(f"[Worker] Unhandled error during render of {video.id}: {e}")
                    # Recovery mechanism if _run_render crashed violently
                    async with AsyncSessionLocal() as db_err:
                        v = await db_err.get(Video, video.id)
                        if v and v.status == VideoStatus.rendering:
                            v.status = VideoStatus.failed
                            v.notes = f"Worker crash: {e}"
                            await db_err.commit()
            else:
                # No jobs found, sleep before next poll
                await asyncio.sleep(5)
                
        except asyncio.CancelledError:
            log.info("[Worker] Polling loop cancelled.")
            break
        except Exception as e:
            log.error(f"[Worker] Polling loop encountered error: {e}")
            await asyncio.sleep(10)

def start_worker():
    global _WORKER_TASK
    if _WORKER_TASK is None or _WORKER_TASK.done():
        _WORKER_TASK = asyncio.create_task(poll_jobs())

def queue_render_task(video_id: str, tenant_id: str, job=None):
    """
    Since the worker polls the DB, this function no longer spawns an isolated task.
    It just ensures the worker is running.
    """
    log.info(f"[Worker] Acknowledged new render request for {video_id}.")
    start_worker()
    return True
