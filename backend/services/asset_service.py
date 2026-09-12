import logging
import asyncio
from pathlib import Path
from datetime import datetime

from backend.db.database import AsyncSessionLocal
from backend.models.models import Job, JobStatus, Asset
from engine.visuals.comfyui import ComfyUIClient
from backend.storage.local import LocalStorage
from backend.storage.s3 import S3Storage
from backend.core.config import settings

log = logging.getLogger(__name__)

# Initialize storage based on config
storage = S3Storage() if settings.STORAGE_BACKEND in ["s3", "r2"] else LocalStorage(settings.STORAGE_ROOT)

async def execute_asset_job(job_id: str):
    """
    Background asset generation task.
    Pulls the prompt/mode from Job payload, executes ComfyUI, uploads to storage,
    and tracks it in the Asset table.
    """
    async with AsyncSessionLocal() as db:
        try:
            job = await db.get(Job, job_id)
            if not job:
                log.error(f"[AssetService] Job {job_id} not found.")
                return False

            payload = job.payload or {}
            prompt = payload.get("prompt")
            mode = payload.get("mode") # "IMAGE" or "VIDEO"
            user_id = job.user_id

            if not prompt or not mode:
                raise ValueError("Job payload missing 'prompt' or 'mode'.")

            log.info(f"[AssetService] Starting generation for Job {job_id} ({mode}). Prompt: {prompt}")

            client = ComfyUIClient()
            if not client.is_available():
                raise Exception("ComfyUI API is unavailable. Ensure it is running locally.")

            # Create a temp directory for the generation
            visual_dir = Path("/tmp/autotube/assets")
            visual_dir.mkdir(parents=True, exist_ok=True)

            local_path = None
            if mode == "IMAGE":
                local_path = await client.generate_image(prompt, str(visual_dir))
            elif mode == "VIDEO":
                local_path = await client.generate_video(prompt, str(visual_dir))
            else:
                raise ValueError(f"Unknown mode: {mode}")

            if not local_path or not Path(local_path).exists():
                raise Exception(f"ComfyUI failed to produce a valid file for {mode}")

            log.info(f"[AssetService] Generation complete. Uploading to storage...")

            # Upload to abstracted storage
            file_name = f"assets/{user_id}/{Path(local_path).name}"
            url = await storage.put_file(local_path, file_name)

            log.info(f"[AssetService] Uploaded to {url}. Saving to Asset tracker...")

            # Create Asset tracking record
            new_asset = Asset(
                user_id=user_id,
                asset_type="image" if mode == "IMAGE" else "video_clip",
                source="comfyui",
                source_asset_id=f"comfy_{job_id}",
                path=local_path if settings.STORAGE_BACKEND not in ["s3", "r2"] else "",
                url=url,
                thumbnail_url=url if mode == "IMAGE" else "", # Could generate video thumbnail later
                asset_metadata={"prompt": prompt, "job_id": job_id}
            )
            
            db.add(new_asset)
            await db.commit()
            await db.refresh(new_asset)

            # Update Job result
            job.status = JobStatus.completed.value
            job.result = {
                "asset_id": new_asset.id,
                "url": new_asset.url,
                "thumbnail_url": new_asset.thumbnail_url
            }
            job.completed_at = datetime.utcnow()
            await db.commit()
            
            log.info(f"[AssetService] Asset tracking complete! Asset ID: {new_asset.id}")
            return True

        except Exception as e:
            log.exception(f"[AssetService] Job {job_id} failed: {e}")
            job.status = JobStatus.failed.value
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            await db.commit()
            return False
