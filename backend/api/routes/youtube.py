"""
YouTube API Router — handles multi-tenant OAuth flow for YouTube uploads.
Stores credentials securely in the database per-user.
Supports client_secret.json file OR YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET env vars.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
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


def _get_client_config() -> dict | None:
    """
    Load Google OAuth client config from file or environment variables.
    Returns the config dict in the format expected by google_auth_oauthlib, or None.
    """
    # 1. Try the JSON file (supports both "web" and "installed" top-level keys)
    if settings.YOUTUBE_CLIENT_SECRETS.exists():
        try:
            with open(settings.YOUTUBE_CLIENT_SECRETS, "r") as f:
                data = json.load(f)
            # The file is valid — return it directly
            if "web" in data or "installed" in data:
                return data
        except (json.JSONDecodeError, IOError) as e:
            log.warning(f"Failed to read client_secret.json: {e}")

    # 2. Fallback: build config from env vars (for cloud/Vercel deployments)
    client_id = os.getenv("YOUTUBE_CLIENT_ID", "")
    client_secret = os.getenv("YOUTUBE_CLIENT_SECRET", "")

    if client_id and client_secret:
        return {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            }
        }

    return None


def _get_client_credentials() -> tuple[str, str]:
    """Extract client_id and client_secret from config (file or env)."""
    config = _get_client_config()
    if not config:
        return ("", "")
    data = config.get("web") or config.get("installed") or {}
    return (data.get("client_id", ""), data.get("client_secret", ""))


def get_oauth_flow(redirect_uri: str) -> Flow:
    """Initialize the Google OAuth flow from client secrets file or env vars."""
    config = _get_client_config()
    if not config:
        raise HTTPException(
            status_code=500,
            detail="YouTube OAuth not configured. Provide client_secret.json or set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET environment variables.",
        )

    flow = Flow.from_client_config(config, scopes=SCOPES, redirect_uri=redirect_uri)
    return flow


async def _refresh_token_if_needed(conn: YouTubeConnection, db: AsyncSession) -> bool:
    """
    Attempt to refresh an expired OAuth token using the stored refresh_token.
    Returns True if successfully refreshed, False otherwise.
    Updates the DB record in-place and commits.
    """
    if not conn.refresh_token:
        log.warning(f"No refresh token available for user {conn.user_id}")
        return False

    client_id, client_secret = _get_client_credentials()
    if not client_id or not client_secret:
        log.error("Cannot refresh token: OAuth client credentials not configured")
        return False

    try:
        from backend.security import decrypt_value, encrypt_value

        creds = Credentials(
            token=decrypt_value(conn.access_token),
            refresh_token=decrypt_value(conn.refresh_token),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=SCOPES,
        )

        # Force refresh
        creds.refresh(GoogleAuthRequest())

        # Update stored credentials
        conn.access_token = encrypt_value(creds.token)
        if creds.refresh_token:
            conn.refresh_token = encrypt_value(creds.refresh_token)
        if creds.expiry:
            conn.expires_at = creds.expiry.replace(tzinfo=timezone.utc)

        await db.commit()
        log.info(f"Successfully refreshed YouTube token for user {conn.user_id}")
        return True

    except Exception as e:
        log.error(f"Token refresh failed for user {conn.user_id}: {e}")
        return False


@router.get("/auth")
async def youtube_auth_url(request: Request, user: User = Depends(get_current_user)):
    """Generate YouTube OAuth authorization URL."""
    try:
        # Use incoming request host for callback URL
        host = request.headers.get("host", "localhost:8000")
        scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
        redirect_uri = (
            settings.YOUTUBE_REDIRECT_URI or f"{scheme}://{host}/api/youtube/callback"
        )

        flow = get_oauth_flow(redirect_uri)

        # Generate PKCE verifier by calling authorization_url once before state encoding
        flow.authorization_url(access_type="offline", prompt="consent")

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
        error_msg = str(e)
        if "client_secrets.json" in error_msg or "not configured" in error_msg.lower():
            raise HTTPException(
                status_code=500,
                detail="YouTube client_secret.json is missing or improperly configured. Please follow the setup guide.",
            )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initiate YouTube connection: {error_msg}",
        )


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
        redirect_uri = (
            settings.YOUTUBE_REDIRECT_URI or f"{scheme}://{host}/api/youtube/callback"
        )

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
        # Ensure expiry is always timezone-aware UTC
        if credentials.expiry:
            conn.expires_at = (
                credentials.expiry.replace(tzinfo=timezone.utc)
                if credentials.expiry.tzinfo is None
                else credentials.expiry
            )
        else:
            # Google access tokens last ~1 hour; set a safe default
            from datetime import timedelta

            conn.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

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


@router.get("/config-status")
async def youtube_config_status():
    """Check if the backend has YouTube OAuth properly configured (file or env vars)."""
    config = _get_client_config()
    has_config = config is not None
    return {
        "configured": has_config,
        "message": (
            "Configured"
            if has_config
            else "YouTube OAuth not configured. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars, or provide client_secret.json."
        ),
    }


@router.get("/status")
async def youtube_status(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """
    Check if the user has a valid YouTube connection.
    Automatically refreshes expired tokens using the refresh_token.
    """
    q = select(YouTubeConnection).where(YouTubeConnection.user_id == user.id)
    result = await db.execute(q)
    conn = result.scalars().first()

    if not conn:
        return {"connected": False}

    # Check if expired — compare safely with timezone-aware datetimes
    is_expired = False
    if conn.expires_at:
        now = datetime.now(timezone.utc)
        expires = (
            conn.expires_at
            if conn.expires_at.tzinfo is not None
            else conn.expires_at.replace(tzinfo=timezone.utc)
        )
        # Consider token expired if it expires within 5 minutes (proactive refresh)
        from datetime import timedelta

        is_expired = expires < (now + timedelta(minutes=5))

    # Auto-refresh if expired and we have a refresh token
    if is_expired and conn.refresh_token:
        refreshed = await _refresh_token_if_needed(conn, db)
        if refreshed:
            # Re-read the updated record
            await db.refresh(conn)
            is_expired = False

    return {
        "connected": True,
        "channel_id": conn.channel_id,
        "channel_title": conn.channel_title,
        "is_expired": is_expired,
        "expires_at": conn.expires_at,
    }


@router.post("/refresh")
async def refresh_youtube_token(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Manually refresh the YouTube OAuth token."""
    q = select(YouTubeConnection).where(YouTubeConnection.user_id == user.id)
    result = await db.execute(q)
    conn = result.scalars().first()

    if not conn:
        raise HTTPException(status_code=404, detail="No YouTube connection found")

    refreshed = await _refresh_token_if_needed(conn, db)
    if not refreshed:
        raise HTTPException(
            status_code=400,
            detail="Token refresh failed. Please re-authorize your YouTube connection.",
        )

    return {
        "status": "success",
        "message": "Token refreshed successfully",
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
