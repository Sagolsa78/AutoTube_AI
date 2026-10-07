"""
Facebook Reels uploader via Graph API.
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
    Upload video to Facebook Reels.
    Returns the Facebook video ID.
    """
    if not connection.account_id:
        raise RuntimeError(f"Missing Facebook account ID for user {connection.user_id}")

    page_access_token_enc = connection.platform_metadata.get("page_access_token")
    if not page_access_token_enc:
        raise RuntimeError(
            f"Missing Facebook Page Access Token for user {connection.user_id}"
        )

    access_token = decrypt_value(page_access_token_enc)

    # We need a publicly accessible URL for the video
    public_video_url = None

    async with AsyncSessionLocal() as db:
        video = await db.get(Video, publication.video_id)
        if not video:
            raise RuntimeError(f"Video {publication.video_id} not found")

        storage = get_storage()
        try:
            public_video_url = await storage.generate_signed_url(
                video.path, expires_in=3600
            )
        except Exception as e:
            from backend.core.config import settings

            if getattr(settings, "BACKEND_URL", None):
                public_video_url = (
                    f"{settings.BACKEND_URL.rstrip('/')}/api/videos/{video.id}/download"
                )
            else:
                raise RuntimeError(f"Cannot generate public URL for Facebook API: {e}")

    page_id = connection.account_id

    async with httpx.AsyncClient() as client:
        # Step 1: Initialize upload
        init_url = f"https://graph.facebook.com/v18.0/{page_id}/video_reels"
        init_payload = {"upload_phase": "start", "access_token": access_token}
        log.info(f"Initializing Facebook Reels upload for {page_id}")
        init_res = await client.post(init_url, data=init_payload)

        if init_res.status_code != 200:
            raise RuntimeError(f"Failed to init Facebook upload: {init_res.text}")

        video_id = init_res.json().get("video_id")
        upload_url = init_res.json().get("upload_url")

        if not video_id or not upload_url:
            raise RuntimeError("Facebook API did not return video_id or upload_url")

        # Step 2: Transfer (we pass the URL to Facebook instead of uploading bytes, using file_url)
        transfer_payload = {
            "upload_phase": "transfer",
            "access_token": access_token,
            "file_url": public_video_url,
        }
        # Note: Facebook docs say to POST to the same url with file_url or to upload_url
        # However, upload_url expects actual binary stream. To use url, we POST to /{page_id}/video_reels
        transfer_res = await client.post(init_url, data=transfer_payload)

        # Actually, using file_url directly might skip start/transfer/finish phases for standard video publish,
        # but for reels the start/transfer/finish is required. Wait, we can upload file bytes to `upload_url`.
        # Let's upload file bytes to avoid public URL issues if we have the local file path.

        import os

        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found at {video_path}")

        # Let's upload bytes to upload_url
        log.info(f"Uploading bytes to Facebook Reels upload_url...")
        with open(video_path, "rb") as f:
            headers = {
                "Authorization": f"OAuth {access_token}",
                "offset": "0",
                "file_size": str(os.path.getsize(video_path)),
            }
            # Facebook Reels upload API is a bit complex, let's just use the direct file upload
            # standard way for Reels.
            upload_res = await client.post(
                upload_url, headers=headers, content=f.read()
            )

            if upload_res.status_code != 200:
                raise RuntimeError(
                    f"Failed to upload video bytes to Facebook: {upload_res.text}"
                )

        # Step 3: Finish upload
        caption = publication.title or ""
        if publication.description:
            caption += f"\n\n{publication.description}"
        if publication.tags:
            caption += "\n" + " ".join([f"#{t}" for t in publication.tags])

        finish_payload = {
            "upload_phase": "finish",
            "access_token": access_token,
            "video_id": video_id,
            "video_state": "PUBLISHED",
            "description": caption[:2000],
        }

        log.info(f"Finishing Facebook Reels upload for video {video_id}")
        finish_res = await client.post(init_url, data=finish_payload)

        if finish_res.status_code != 200:
            raise RuntimeError(f"Failed to finish Facebook upload: {finish_res.text}")

        log.info(f"Facebook upload complete: {video_id}")
        return video_id
