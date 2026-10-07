"""
TikTok uploader via Direct Post API.
"""

import logging
import os

import httpx

from backend.models.models import PlatformConnection, Publication
from backend.security import decrypt_value

log = logging.getLogger(__name__)


async def upload_video(
    publication: Publication,
    connection: PlatformConnection,
    video_path: str,
) -> str:
    """
    Upload video to TikTok.
    Returns the TikTok publish ID.
    """
    if not connection.access_token_encrypted:
        raise RuntimeError(f"Missing TikTok credentials for user {connection.user_id}")

    access_token = decrypt_value(connection.access_token_encrypted)

    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found at {video_path}")

    file_size = os.path.getsize(video_path)

    async with httpx.AsyncClient() as client:
        # Step 1: Initialize Upload
        init_url = "https://open.tiktokapis.com/v2/post/publish/video/init/"
        init_payload = {
            "post_info": {
                "title": (publication.title or "")[:150],
                "privacy_level": (
                    "PUBLIC_TO_EVERYONE"
                    if publication.privacy_status == "public"
                    else "MUTUAL_FOLLOW_FRIENDS"
                ),
                "disable_duet": False,
                "disable_comment": False,
                "disable_stitch": False,
            },
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": file_size,
                "chunk_size": file_size,  # Upload whole file in one chunk for simplicity if size < threshold, else handle chunks
                "total_chunk_count": 1,
            },
        }

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json; charset=UTF-8",
        }

        log.info(f"Initializing TikTok upload for user {connection.user_id}")
        init_res = await client.post(init_url, json=init_payload, headers=headers)

        if init_res.status_code != 200:
            raise RuntimeError(f"Failed to init TikTok upload: {init_res.text}")

        data = init_res.json().get("data", {})
        publish_id = data.get("publish_id")
        upload_url = data.get("upload_url")

        if not publish_id or not upload_url:
            raise RuntimeError("TikTok API did not return publish_id or upload_url")

        # Step 2: Upload Video Bytes
        log.info(f"Uploading bytes to TikTok upload_url for {publish_id}...")
        with open(video_path, "rb") as f:
            upload_res = await client.put(
                upload_url,
                headers={"Content-Type": "video/mp4", "Content-Length": str(file_size)},
                content=f.read(),
            )

            if upload_res.status_code not in (200, 201):
                raise RuntimeError(
                    f"Failed to upload video bytes to TikTok: {upload_res.text}"
                )

        # TikTok automatically processes the video after bytes are uploaded.
        # There's no explicit finish call.
        log.info(f"TikTok upload complete: {publish_id}")
        return publish_id
