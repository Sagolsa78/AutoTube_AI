"""
Instagram uploader via Instagram Graph API.
"""

import asyncio
import logging

import httpx
from sqlalchemy import select

from backend.db.database import AsyncSessionLocal
from backend.models.models import PlatformConnection, Publication, Video
from backend.security import decrypt_value
from backend.storage import get_storage

log = logging.getLogger(__name__)


async def upload_video(
    publication: Publication,
    connection: PlatformConnection,
    video_path: str,
) -> str:
    """
    Upload video to Instagram Reels.
    Returns the Instagram media ID.
    """
    if not connection.access_token_encrypted or not connection.account_id:
        raise RuntimeError(
            f"Missing Instagram credentials or account ID for user {connection.user_id}"
        )

    access_token = decrypt_value(connection.access_token_encrypted)

    # We need a publicly accessible URL for the video
    public_video_url = None

    async with AsyncSessionLocal() as db:
        video = await db.get(Video, publication.video_id)
        if not video:
            raise RuntimeError(f"Video {publication.video_id} not found")

        storage = get_storage()
        try:
            # Assuming video.path is the storage key
            public_video_url = await storage.generate_signed_url(
                video.path, expires_in=3600
            )
        except Exception as e:
            from backend.core.config import settings

            # Fallback for local development or if storage engine doesn't support signed URLs
            if getattr(settings, "BACKEND_URL", None):
                public_video_url = (
                    f"{settings.BACKEND_URL.rstrip('/')}/api/videos/{video.id}/download"
                )
            else:
                raise RuntimeError(f"Cannot generate public URL for Instagram API: {e}")

    ig_user_id = connection.account_id

    async with httpx.AsyncClient() as client:
        # Step 1: Create media container
        container_url = f"https://graph.facebook.com/v18.0/{ig_user_id}/media"
        caption = publication.title or ""
        if publication.description:
            caption += f"\n\n{publication.description}"
        if publication.tags:
            caption += "\n" + " ".join([f"#{t}" for t in publication.tags])

        payload = {
            "media_type": "REELS",
            "video_url": public_video_url,
            "caption": caption[:2200],  # IG max caption length
            "access_token": access_token,
        }

        log.info(f"Creating Instagram media container for {ig_user_id}")
        res = await client.post(container_url, data=payload)

        if res.status_code != 200:
            raise RuntimeError(f"Failed to create Instagram container: {res.text}")

        container_id = res.json().get("id")
        if not container_id:
            raise RuntimeError("Instagram API did not return a container ID")

        # Step 2: Poll status until finished
        status_url = f"https://graph.facebook.com/v18.0/{container_id}"
        max_attempts = 60
        is_ready = False

        log.info(f"Polling Instagram container {container_id} status...")
        for attempt in range(max_attempts):
            status_res = await client.get(
                status_url,
                params={"fields": "status_code", "access_token": access_token},
            )
            if status_res.status_code == 200:
                status_code = status_res.json().get("status_code")
                if status_code == "FINISHED":
                    is_ready = True
                    break
                elif status_code == "ERROR":
                    raise RuntimeError("Instagram container processing failed.")
            await asyncio.sleep(5)

        if not is_ready:
            raise RuntimeError("Instagram container processing timed out.")

        # Step 3: Publish the container
        publish_url = f"https://graph.facebook.com/v18.0/{ig_user_id}/media_publish"
        publish_payload = {"creation_id": container_id, "access_token": access_token}

        log.info(f"Publishing Instagram container {container_id}")
        pub_res = await client.post(publish_url, data=publish_payload)
        if pub_res.status_code != 200:
            raise RuntimeError(f"Failed to publish Instagram media: {pub_res.text}")

        media_id = pub_res.json().get("id")
        log.info(f"Instagram upload complete: {media_id}")
        return media_id
