import asyncio
import logging
from datetime import datetime
from pathlib import Path

from backend.core.config import settings
from backend.db.database import AsyncSessionLocal
from backend.models.content_spec import AssetJobPayload
from backend.models.models import Asset, Job, JobStatus
from backend.storage import storage
from integrations.providers.visuals.comfyui_provider import ComfyUIProvider

log = logging.getLogger(__name__)


def get_visual_provider():
    """Factory to get the configured Visual Provider. Defaults to ComfyUI."""
    return ComfyUIProvider()


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

            try:
                asset_payload = AssetJobPayload.model_validate(job.payload or {})
            except Exception as e:
                raise ValueError(f"Invalid AssetJobPayload: {e}")

            prompt = asset_payload.prompt
            mode = asset_payload.mode
            user_id = job.user_id

            log.info(
                f"[AssetService] Starting generation for Job {job_id} ({mode}). Prompt: {prompt}"
            )

            provider = get_visual_provider()
            if not provider.is_available():
                raise Exception(
                    f"{provider.name} API is unavailable. Ensure it is configured and running."
                )

            # Create a temp directory for the generation
            visual_dir = Path("/tmp/autotube/assets")
            visual_dir.mkdir(parents=True, exist_ok=True)

            local_path = None
            if mode == "IMAGE":
                local_path = await provider.generate_image(prompt, str(visual_dir))
            elif mode == "VIDEO":
                local_path = await provider.generate_video(prompt, str(visual_dir))
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
                thumbnail_url=(
                    url if mode == "IMAGE" else ""
                ),  # Could generate video thumbnail later
                asset_metadata={"prompt": prompt, "job_id": job_id},
            )

            db.add(new_asset)
            await db.commit()
            await db.refresh(new_asset)

            # Update Job result
            job.status = JobStatus.SUCCEEDED.value
            job.result = {
                "asset_id": new_asset.id,
                "url": new_asset.url,
                "thumbnail_url": new_asset.thumbnail_url,
            }
            job.completed_at = datetime.utcnow()
            await db.commit()

            log.info(
                f"[AssetService] Asset tracking complete! Asset ID: {new_asset.id}"
            )
            return True

        except Exception as e:
            log.exception(f"[AssetService] Job {job_id} failed: {e}")
            job.status = JobStatus.FAILED.value
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            await db.commit()
            return False
