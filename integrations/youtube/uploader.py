"""
YouTube uploader — OAuth2 authentication + video upload via YouTube Data API v3.
Now supports multi-tenant credentials fetched from PostgreSQL.
"""
from __future__ import annotations
import logging
import datetime
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

from backend.db.database import AsyncSessionLocal
from backend.models.models import YouTubeConnection
from backend.core.config import settings

log = logging.getLogger(__name__)


async def _get_credentials(user_id: str) -> Credentials:
    """Fetch user credentials from the database and refresh if needed."""
    async with AsyncSessionLocal() as db:
        conn = await db.get(YouTubeConnection, user_id) # user_id is NOT the primary key! wait!
        
        # user_id is indexed, not primary key. Need to query it.
        from sqlalchemy import select
        q = select(YouTubeConnection).where(YouTubeConnection.user_id == user_id)
        result = await db.execute(q)
        conn = result.scalars().first()
        
        if not conn or not conn.access_token:
            raise RuntimeError(f"No valid YouTube credentials found for user {user_id}")
            
        import json
        client_secrets = {}
        if settings.YOUTUBE_CLIENT_SECRETS.exists():
            with open(settings.YOUTUBE_CLIENT_SECRETS, "r") as f:
                client_secrets = json.load(f)
                
        client_id = client_secrets.get("installed", {}).get("client_id", "")
        client_secret = client_secrets.get("installed", {}).get("client_secret", "")
        
        from backend.security import decrypt_value
        creds = Credentials(
            token=decrypt_value(conn.access_token),
            refresh_token=decrypt_value(conn.refresh_token),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube"]
        )

        if not creds.valid:
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
                from backend.security import encrypt_value
                conn.access_token = encrypt_value(creds.token)
                # Optionally update expiry if provided
                if creds.expiry:
                    # Make it timezone aware
                    conn.expires_at = creds.expiry.replace(tzinfo=datetime.timezone.utc)
                await db.commit()
            else:
                raise RuntimeError("Credentials expired and no refresh token available")
                
        return creds


async def upload_video(
    user_id: str,
    video_path: str,
    title: str,
    description: str,
    tags: list[str] | None = None,
    category_id: str = "27",          # 27 = Education
    privacy_status: str = "private",  # always private initially
    made_for_kids: bool = False,
) -> str:
    """
    Upload video to YouTube.
    Returns the YouTube video ID.
    """
    creds = await _get_credentials(user_id)
    youtube = build("youtube", "v3", credentials=creds)

    body = {
        "snippet": {
            "title":       title[:100],       # YT max
            "description": description[:5000],
            "tags":        (tags or [])[:500],
            "categoryId":  category_id,
        },
        "status": {
            "privacyStatus":          privacy_status,
            "selfDeclaredMadeForKids": made_for_kids,
        },
    }

    media = MediaFileUpload(video_path, chunksize=-1, resumable=True,
                            mimetype="video/mp4")
    request = youtube.videos().insert(
        part="snippet,status", body=body, media_body=media
    )

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            pct = int(status.progress() * 100)
            log.info("Upload progress: %d%%", pct)

    video_id = response["id"]
    log.info("Upload complete: https://youtu.be/%s  (status=%s)", video_id, privacy_status)
    return video_id
