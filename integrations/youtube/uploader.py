"""
YouTube uploader — OAuth2 authentication + video upload via YouTube Data API v3.
Run auth_setup() once locally to generate token.json.
"""
from __future__ import annotations
import logging
import os
import pickle
from pathlib import Path

from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

from backend.settings import YOUTUBE_CLIENT_SECRETS, YOUTUBE_TOKEN_FILE

log = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.readonly"]


def auth_setup() -> None:
    """
    Interactive one-time OAuth flow.  Run this locally once, then
    commit token.json as a GitHub Secret (base64-encoded) for CI.
    """
    flow = InstalledAppFlow.from_client_secrets_file(str(YOUTUBE_CLIENT_SECRETS), SCOPES)
    creds = flow.run_local_server(port=0)
    with open(str(YOUTUBE_TOKEN_FILE), "wb") as f:
        pickle.dump(creds, f)
    log.info("Auth token saved to %s", YOUTUBE_TOKEN_FILE)


def _get_credentials():
    creds = None
    if YOUTUBE_TOKEN_FILE.exists():
        with open(str(YOUTUBE_TOKEN_FILE), "rb") as f:
            creds = pickle.load(f)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(str(YOUTUBE_TOKEN_FILE), "wb") as f:
                pickle.dump(creds, f)
        else:
            raise RuntimeError(
                "No valid YouTube credentials found. "
                "Run `python -m integrations.youtube.uploader auth` first."
            )
    return creds


def upload_video(
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
    creds   = _get_credentials()
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


# ── CLI entry ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "auth":
        auth_setup()
    else:
        print("Usage: python -m integrations.youtube.uploader auth")
