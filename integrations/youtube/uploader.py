"""
YouTube uploader — OAuth2 authentication + video upload via YouTube Data API v3.
Now supports multi-tenant credentials fetched from PostgreSQL.
"""

from __future__ import annotations

import datetime
import logging

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from backend.core.config import settings
from backend.db.database import AsyncSessionLocal
from backend.models.models import PlatformConnection, Publication

log = logging.getLogger(__name__)


async def _get_credentials(connection: PlatformConnection) -> Credentials:
    """Fetch user credentials from the connection and refresh if needed."""

    if not connection.access_token_encrypted:
        raise RuntimeError(
            f"No valid YouTube credentials found for user {connection.user_id}"
        )

    import json
    import os

    client_id = ""
    client_secret = ""

    if settings.YOUTUBE_CLIENT_SECRETS.exists():
        with open(settings.YOUTUBE_CLIENT_SECRETS, "r") as f:
            client_secrets = json.load(f)
        secret_data = client_secrets.get("web") or client_secrets.get("installed") or {}
        client_id = secret_data.get("client_id", "")
        client_secret = secret_data.get("client_secret", "")

    if not client_id:
        client_id = os.getenv("YOUTUBE_CLIENT_ID", "")
    if not client_secret:
        client_secret = os.getenv("YOUTUBE_CLIENT_SECRET", "")

    if not client_id or not client_secret:
        meta = connection.platform_metadata or {}
        client_id = client_id or meta.get("client_id", "")
        client_secret = client_secret or meta.get("client_secret", "")

    if not client_id or not client_secret:
        raise RuntimeError(
            "YouTube OAuth client credentials not found. "
            "Provide client_secret.json or set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars."
        )

    from backend.security import decrypt_value

    creds = Credentials(
        token=decrypt_value(connection.access_token_encrypted),
        refresh_token=(
            decrypt_value(connection.refresh_token_encrypted)
            if connection.refresh_token_encrypted
            else None
        ),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=[
            "https://www.googleapis.com/auth/youtube.upload",
            "https://www.googleapis.com/auth/youtube",
        ],
    )

    if not creds.valid:
        if creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as e:
                raise RuntimeError(
                    f"YouTube credentials revoked or expired. Please reconnect. Details: {e}"
                )

            from backend.security import encrypt_value

            connection.access_token_encrypted = encrypt_value(creds.token)
            if creds.expiry:
                connection.expires_at = creds.expiry.replace(
                    tzinfo=datetime.timezone.utc
                )

            # Note: The caller (publisher.py) or scheduler should commit this update to the database.
        else:
            raise RuntimeError("Credentials expired and no refresh token available")

    return creds


async def upload_video(
    publication: Publication,
    connection: PlatformConnection,
    video_path: str,
    category_id: str = "27",  # 27 = Education
) -> str:
    """
    Upload video to YouTube.
    Returns the YouTube video ID.
    """
    creds = await _get_credentials(connection)
    youtube = build("youtube", "v3", credentials=creds)

    privacy_val = (
        publication.privacy_status.value
        if hasattr(publication.privacy_status, "value")
        else str(publication.privacy_status)
    )

    body = {
        "snippet": {
            "title": (publication.title or "")[:100],  # YT max
            "description": (publication.description or "")[:5000],
            "tags": (publication.tags or [])[:500],
            "categoryId": category_id,
        },
        "status": {
            "privacyStatus": privacy_val,
            "selfDeclaredMadeForKids": False,
        },
    }

    import asyncio

    def _execute_upload():
        media = MediaFileUpload(
            video_path, chunksize=-1, resumable=True, mimetype="video/mp4"
        )
        request = youtube.videos().insert(
            part="snippet,status", body=body, media_body=media
        )

        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                pct = int(status.progress() * 100)
                log.info("Upload progress: %d%%", pct)
        return response["id"]

    video_id = await asyncio.to_thread(_execute_upload)

    log.info("Upload complete: https://youtu.be/%s  (status=%s)", video_id, privacy_val)
    return video_id
