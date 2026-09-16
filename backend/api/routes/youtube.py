"""
YouTube API Router — handles multi-tenant OAuth flow for YouTube uploads.
Stores credentials securely in the database per-user.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.core.config import settings
from backend.db.database import get_db
from backend.models.models import User, YouTubeConnection

log = logging.getLogger(__name__)
router = APIRouter()

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/youtube.readonly",
]


def get_oauth_flow(redirect_uri: str) -> Flow:
    """Initialize the Google OAuth flow from client secrets."""
    if not settings.YOUTUBE_CLIENT_SECRETS.exists():
        raise HTTPException(
            status_code=500,
            detail="YouTube client secrets not configured. Please add client_secrets.json to secrets/.",
        )
    flow = Flow.from_client_secrets_file(
        str(settings.YOUTUBE_CLIENT_SECRETS), scopes=SCOPES, redirect_uri=redirect_uri
    )
    return flow


@router.get("/auth")
async def youtube_auth_url(request: Request, user: User = Depends(get_current_user)):
    """Generate YouTube OAuth authorization URL."""
    try:
        # Use incoming request host for callback URL
        host = request.headers.get("host", "localhost:8000")
        scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
        redirect_uri = f"{scheme}://{host}/api/youtube/callback"

        flow = get_oauth_flow(redirect_uri)

        # State encoding including user_id, timestamp, and PKCE code_verifier
        import time

        import jwt

        payload = {
            "sub": str(user.id),
            "cv": flow.code_verifier,
            "exp": int(time.time()) + 3600,
        }
        state = jwt.encode(
            payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
        )

        authorization_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
            state=state,
        )
        return {"authorization_url": authorization_url}
    except Exception as e:
        log.error(f"Failed to generate YouTube auth URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/callback")
async def youtube_auth_callback(
    request: Request,
    state: str,
    code: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Handle OAuth callback from Google."""
    if error:
        log.error(f"YouTube OAuth error: {error}")
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    try:
        import jwt

        payload = jwt.decode(
            state, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        code_verifier = payload.get("cv")
        if not user_id:
            raise ValueError("Invalid payload in state")
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Invalid OAuth state parameter: {exc}"
        )

    try:
        host = request.headers.get("host", "localhost:8000")
        scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
        redirect_uri = f"{scheme}://{host}/api/youtube/callback"

        flow = get_oauth_flow(redirect_uri)
        if code_verifier:
            flow.code_verifier = code_verifier
        flow.fetch_token(code=code)

        credentials = flow.credentials

        # Save to database
        q = select(YouTubeConnection).where(YouTubeConnection.user_id == user_id)
        result = await db.execute(q)
        conn = result.scalars().first()

        if not conn:
            conn = YouTubeConnection(user_id=user_id)
            db.add(conn)

        from backend.security import encrypt_value

        conn.access_token = encrypt_value(credentials.token)
        conn.refresh_token = (
            encrypt_value(credentials.refresh_token)
            if credentials.refresh_token
            else conn.refresh_token
        )
        conn.expires_at = credentials.expiry

        # Optional: fetch channel ID using the API
        from googleapiclient.discovery import build

        youtube = build("youtube", "v3", credentials=credentials)
        channels_response = youtube.channels().list(mine=True, part="snippet").execute()
        if channels_response.get("items"):
            channel = channels_response["items"][0]
            conn.channel_id = channel["id"]
            conn.channel_title = channel["snippet"]["title"]

        await db.commit()
        frontend_url = settings.FRONTEND_URL or "http://localhost:5173"
        return RedirectResponse(
            url=f"{frontend_url.rstrip('/')}/app/channels?youtube=connected"
        )

    except Exception as e:
        log.error(f"YouTube OAuth callback failed: {e}")
        raise HTTPException(status_code=400, detail=f"OAuth failed: {str(e)}")


@router.get("/status")
async def youtube_status(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Check if the user has a valid YouTube connection."""
    q = select(YouTubeConnection).where(YouTubeConnection.user_id == user.id)
    result = await db.execute(q)
    conn = result.scalars().first()

    if not conn:
        return {"connected": False}

    # Check if expired and needs refresh safely comparing timezone-aware/naive datetimes
    is_expired = False
    if conn.expires_at:
        now = datetime.now(timezone.utc)
        expires = (
            conn.expires_at
            if conn.expires_at.tzinfo is not None
            else conn.expires_at.replace(tzinfo=timezone.utc)
        )
        is_expired = expires < now

    return {
        "connected": True,
        "channel_id": conn.channel_id,
        "channel_title": conn.channel_title,
        "is_expired": is_expired,
        "expires_at": conn.expires_at,
    }


@router.delete("/disconnect")
async def disconnect_youtube(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Disconnect YouTube and delete credentials."""
    q = select(YouTubeConnection).where(YouTubeConnection.user_id == user.id)
    result = await db.execute(q)
    conn = result.scalars().first()

    if conn:
        await db.delete(conn)
        await db.commit()

    return {"status": "success", "message": "YouTube disconnected."}
