"""
YouTube API Router — handles multi-tenant OAuth flow for YouTube uploads.
Stores credentials securely in the database per-user.
"""
from __future__ import annotations
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from google_auth_oauthlib.flow import Flow

from backend.db.database import get_db
from backend.models.models import YouTubeConnection, User
from backend.auth.dependencies import get_current_user
from backend.core.config import settings

log = logging.getLogger(__name__)
router = APIRouter()

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/youtube.readonly"
]

def get_oauth_flow(redirect_uri: str) -> Flow:
    """Initialize the Google OAuth flow from client secrets."""
    if not settings.YOUTUBE_CLIENT_SECRETS.exists():
        raise HTTPException(
            status_code=500, 
            detail="YouTube client secrets not configured. Please add client_secrets.json to secrets/."
        )
    flow = Flow.from_client_secrets_file(
        str(settings.YOUTUBE_CLIENT_SECRETS),
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )
    return flow


@router.get("/auth")
async def start_youtube_auth(
    request: Request,
    user: User = Depends(get_current_user)
):
    """Start the OAuth flow. Returns a URL to redirect the user to Google."""
    # The frontend should pass its origin or we determine it
    redirect_uri = f"{request.base_url.scheme}://{request.base_url.netloc}/api/youtube/callback"
    flow = get_oauth_flow(redirect_uri)
    
    # We use a signed JWT as state to prevent CSRF
    import jwt
    from backend.auth.provider import AuthProvider
    auth_provider = AuthProvider()
    secret = auth_provider.jwt_secret or "dev-secret"
    
    secure_state = jwt.encode({"sub": user.id, "exp": datetime.utcnow().timestamp() + 600}, secret, algorithm="HS256")
    
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=secure_state
    )
    
    return {"auth_url": auth_url}


@router.get("/callback")
async def youtube_auth_callback(
    request: Request,
    state: str,
    code: str,
    db: AsyncSession = Depends(get_db)
):
    """Handle the OAuth callback from Google and store the credentials."""
    redirect_uri = f"{request.base_url.scheme}://{request.base_url.netloc}/api/youtube/callback"
    
    import jwt
    from backend.auth.provider import AuthProvider
    auth_provider = AuthProvider()
    secret = auth_provider.jwt_secret or "dev-secret"
    
    try:
        payload = jwt.decode(state, secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Missing sub in state")
    except Exception as state_err:
        log.warning(f"Invalid state parameter: {state_err}")
        raise HTTPException(status_code=400, detail="Invalid OAuth state parameter")
        
    try:
        flow = get_oauth_flow(redirect_uri)
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Check if a connection already exists
        q = select(YouTubeConnection).where(YouTubeConnection.user_id == user_id)
        result = await db.execute(q)
        conn = result.scalars().first()
        
        if not conn:
            conn = YouTubeConnection(user_id=user_id)
            db.add(conn)
            
        from backend.security import encrypt_value
        conn.access_token = encrypt_value(credentials.token)
        conn.refresh_token = encrypt_value(credentials.refresh_token) if credentials.refresh_token else conn.refresh_token
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
        return {"status": "success", "message": "YouTube connected successfully."}
        
    except Exception as e:
        log.error(f"YouTube OAuth callback failed: {e}")
        raise HTTPException(status_code=400, detail=f"OAuth failed: {str(e)}")


@router.get("/status")
async def youtube_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check if the user has a valid YouTube connection."""
    q = select(YouTubeConnection).where(YouTubeConnection.user_id == user.id)
    result = await db.execute(q)
    conn = result.scalars().first()
    
    if not conn:
        return {"connected": False}
        
    # Check if expired and needs refresh (handled lazily in uploader usually, but good to know)
    is_expired = conn.expires_at and conn.expires_at < datetime.utcnow()
    
    return {
        "connected": True,
        "channel_id": conn.channel_id,
        "channel_title": conn.channel_title,
        "is_expired": is_expired,
        "expires_at": conn.expires_at
    }


@router.delete("/disconnect")
async def disconnect_youtube(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Disconnect YouTube and delete credentials."""
    q = select(YouTubeConnection).where(YouTubeConnection.user_id == user.id)
    result = await db.execute(q)
    conn = result.scalars().first()
    
    if conn:
        await db.delete(conn)
        await db.commit()
        
    return {"status": "success", "message": "YouTube disconnected."}
