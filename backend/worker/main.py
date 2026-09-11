"""
Durable Queue Worker for AutoTube AI.
Polls the database for videos in the 'rendering' state and executes them sequentially.
Run this as a separate process: python -m backend.worker.main
"""
import logging
import asyncio
from backend.db.database import AsyncSessionLocal
from backend.models.models import Video, VideoStatus, Script, Idea, Channel, User
from sqlalchemy import select
from sqlalchemy.orm import selectinload

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger(__name__)

async def poll_jobs():
    """Continuously polls the database for rendering jobs and processes them one by one."""
    log.info("[Worker] Started durable job polling loop.")
    from backend.api.routes.videos import _run_render
    from engine.models import RenderJob
    
    while True:
        try:
            video = None
            job = None
            async with AsyncSessionLocal() as db:
                # Find the oldest video stuck in rendering
                q = select(Video).where(Video.status == VideoStatus.rendering).order_by(Video.created_at.asc()).limit(1)
                res = await db.execute(q)
                video = res.scalars().first()
                
                if video:
                    log.info(f"[Worker] Found pending job for video: {video.id}")
                    
                    try:
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
                        profile = await db.get(User, video.user_id)
                        
                        spec_data = script.body or {}
                        from engine.story.schemas import StorySpec, SceneSpec
                        story_spec = StorySpec(**spec_data) if spec_data else StorySpec(topic=idea.topic if idea else "")
                        
                        if not story_spec.scenes:
                            for s in sorted(script.scenes, key=lambda x: x.scene_number):
                                story_spec.scenes.append(SceneSpec(
                                    scene_number=s.scene_number,
                                    narration=s.narration or "",
                                    visual_intent=s.visual_description or "",
                                ))
                        
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
                            niche=channel.niche if channel else "science_wow",
                            caption_style=video.caption_style or "bold_centered",
                            style=video.style or "fast_facts",
                            language=story_spec.language or (channel.language if channel else "en"),
                        )
                        
                        if profile and profile.watermark_enabled and profile.logo_path:
                            import os
                            if os.path.exists(profile.logo_path):
                                job.watermark_path = profile.logo_path
                                job.watermark_opacity = profile.watermark_opacity or 0.4
                                job.watermark_position = profile.watermark_position or "bottom_right"
                                job.watermark_scale = profile.watermark_scale or 0.12
                    except Exception as init_err:
                        log.error(f"[Worker] Failed to construct job for video {video.id}: {init_err}")
                        video.status = VideoStatus.failed
                        video.notes = f"Job initialization error: {init_err}"
                        await db.commit()
                        continue

            if video and job:
                try:
                    await _run_render(video.id, job)
                except Exception as e:
                    log.error(f"[Worker] Unhandled error during render of {video.id}: {e}")
                    async with AsyncSessionLocal() as db_err:
                        v = await db_err.get(Video, video.id)
                        if v and v.status == VideoStatus.rendering:
                            v.status = VideoStatus.failed
                            v.notes = f"Worker crash: {e}"
                            await db_err.commit()
            else:
                await asyncio.sleep(5)
                
        except asyncio.CancelledError:
            log.info("[Worker] Polling loop cancelled.")
            break
        except Exception as e:
            log.error(f"[Worker] Polling loop encountered error: {e}")
            await asyncio.sleep(10)

if __name__ == "__main__":
    asyncio.run(poll_jobs())
