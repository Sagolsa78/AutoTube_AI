import logging
import time
import urllib.parse
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.core.config import settings
from backend.db.database import get_db
from backend.models.models import PlatformConnection, User
from backend.security import decrypt_value, encrypt_value

log = logging.getLogger(__name__)
router = APIRouter()


def get_oauth_state(user_id: str, platform: str) -> str:
    payload = {
        "sub": str(user_id),
        "platform": platform,
        "exp": int(time.time()) + 3600,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_oauth_state(state: str) -> dict:
    try:
        return jwt.decode(
            state, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
    except Exception as exc:
        raise ValueError(f"Invalid state: {exc}")


@router.get("/{platform}/connect")
async def connect_platform(
    platform: str, request: Request, user: User = Depends(get_current_user)
):
    host = request.headers.get("host", "localhost:8000")
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    redirect_uri = f"{scheme}://{host}/api/integrations/{platform}/callback"
    state = get_oauth_state(user.id, platform)

    if platform == "instagram":
        # Meta requires Instagram Business Account linked to Facebook Page
        client_id = settings.FACEBOOK_CLIENT_ID
        if not client_id:
            raise HTTPException(500, "FACEBOOK_CLIENT_ID not configured")

        scopes = "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement"
        url = f"https://www.facebook.com/v18.0/dialog/oauth?client_id={client_id}&redirect_uri={urllib.parse.quote(redirect_uri)}&state={state}&scope={scopes}&response_type=code"
        return {"authorization_url": url}
    elif platform == "facebook":
        client_id = settings.FACEBOOK_CLIENT_ID
        if not client_id:
            raise HTTPException(500, "FACEBOOK_CLIENT_ID not configured")
        scopes = (
            "pages_manage_posts,pages_read_engagement,pages_show_list,publish_video"
        )
        url = f"https://www.facebook.com/v18.0/dialog/oauth?client_id={client_id}&redirect_uri={urllib.parse.quote(redirect_uri)}&state={state}&scope={scopes}&response_type=code"
        return {"authorization_url": url}
    elif platform == "tiktok":
        client_key = settings.TIKTOK_CLIENT_KEY
        if not client_key:
            raise HTTPException(500, "TIKTOK_CLIENT_KEY not configured")
        scopes = "video.upload,user.info.basic"
        url = f"https://www.tiktok.com/v2/auth/authorize/?client_key={client_key}&response_type=code&scope={scopes}&redirect_uri={urllib.parse.quote(redirect_uri)}&state={state}"
        return {"authorization_url": url}
    else:
        raise HTTPException(400, f"Unsupported platform for generic OAuth: {platform}")


@router.get("/{platform}/callback")
async def callback_platform(
    platform: str,
    request: Request,
    state: str,
    code: str = None,
    error: str = None,
    db: AsyncSession = Depends(get_db),
):
    if error:
        raise HTTPException(400, f"OAuth Error: {error}")
    if not code:
        raise HTTPException(400, "Missing authorization code")

    try:
        payload = decode_oauth_state(state)
        user_id = payload.get("sub")
        state_platform = payload.get("platform")
        if platform != state_platform:
            raise ValueError("Platform mismatch in state")
    except Exception as e:
        raise HTTPException(400, f"Invalid OAuth state: {e}")

    host = request.headers.get("host", "localhost:8000")
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    redirect_uri = f"{scheme}://{host}/api/integrations/{platform}/callback"

    access_token = None
    refresh_token = None
    expires_at = None
    account_id = None
    account_name = None
    platform_metadata = {}

    async with httpx.AsyncClient() as client:
        if platform in ["facebook", "instagram"]:
            client_id = settings.FACEBOOK_CLIENT_ID
            client_secret = settings.FACEBOOK_CLIENT_SECRET
            res = await client.get(
                f"https://graph.facebook.com/v18.0/oauth/access_token",
                params={
                    "client_id": client_id,
                    "redirect_uri": redirect_uri,
                    "client_secret": client_secret,
                    "code": code,
                },
            )
            if res.status_code != 200:
                raise HTTPException(400, f"Failed to fetch Meta token: {res.text}")

            data = res.json()
            access_token = data.get("access_token")
            expires_in = data.get("expires_in", 3600)
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

            # Exchange for long-lived token
            ll_res = await client.get(
                "https://graph.facebook.com/v18.0/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "fb_exchange_token": access_token,
                },
            )
            if ll_res.status_code == 200:
                ll_data = ll_res.json()
                access_token = ll_data.get("access_token")
                expires_in = ll_data.get("expires_in", 5184000)  # 60 days
                expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

            # Fetch accounts/pages
            me_res = await client.get(
                f"https://graph.facebook.com/v18.0/me/accounts?access_token={access_token}"
            )
            if me_res.status_code == 200:
                pages = me_res.json().get("data", [])
                if pages:
                    # Select first page for now
                    page = pages[0]
                    account_id = page["id"]
                    account_name = page["name"]
                    platform_metadata["page_access_token"] = encrypt_value(
                        page["access_token"]
                    )

                    if platform == "instagram":
                        # Fetch linked IG account
                        ig_res = await client.get(
                            f"https://graph.facebook.com/v18.0/{account_id}?fields=instagram_business_account&access_token={page['access_token']}"
                        )
                        if ig_res.status_code == 200:
                            ig_data = ig_res.json()
                            if "instagram_business_account" in ig_data:
                                account_id = ig_data["instagram_business_account"]["id"]
                                # Fetch IG profile
                                prof_res = await client.get(
                                    f"https://graph.facebook.com/v18.0/{account_id}?fields=username&access_token={page['access_token']}"
                                )
                                if prof_res.status_code == 200:
                                    account_name = prof_res.json().get("username")
                            else:
                                raise HTTPException(
                                    400,
                                    "No Instagram Business Account linked to the Facebook Page.",
                                )

        elif platform == "tiktok":
            client_key = settings.TIKTOK_CLIENT_KEY
            client_secret = settings.TIKTOK_CLIENT_SECRET
            res = await client.post(
                "https://open.tiktokapis.com/v2/oauth/token/",
                data={
                    "client_key": client_key,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if res.status_code != 200:
                raise HTTPException(400, f"Failed to fetch TikTok token: {res.text}")

            data = res.json()
            access_token = data.get("access_token")
            refresh_token = data.get("refresh_token")
            expires_in = data.get("expires_in", 86400)
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            account_id = data.get("open_id")

            # Fetch user info
            user_res = await client.get(
                "https://open.tiktokapis.com/v2/user/info/?fields=display_name",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if user_res.status_code == 200:
                user_data = user_res.json().get("data", {}).get("user", {})
                account_name = user_data.get("display_name", "TikTok User")

    if not access_token:
        raise HTTPException(400, "Failed to obtain access token.")

    q = select(PlatformConnection).where(
        PlatformConnection.user_id == user_id, PlatformConnection.platform == platform
    )
    result = await db.execute(q)
    conn = result.scalars().first()
    if not conn:
        conn = PlatformConnection(user_id=user_id, platform=platform)
        db.add(conn)

    conn.access_token_encrypted = encrypt_value(access_token)
    if refresh_token:
        conn.refresh_token_encrypted = encrypt_value(refresh_token)
    conn.expires_at = expires_at
    conn.account_id = account_id
    conn.account_name = account_name
    if platform_metadata:
        conn.platform_metadata = platform_metadata

    await db.commit()
    frontend_url = settings.FRONTEND_URL or "http://localhost:5173"
    return RedirectResponse(
        url=f"{frontend_url.rstrip('/')}/app/channels?{platform}=connected"
    )


@router.get("/{platform}/status")
async def status_platform(
    platform: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(PlatformConnection).where(
        PlatformConnection.user_id == user.id, PlatformConnection.platform == platform
    )
    result = await db.execute(q)
    conn = result.scalars().first()

    if not conn:
        return {"connected": False}

    is_expired = False
    if conn.expires_at:
        now = datetime.now(timezone.utc)
        expires = (
            conn.expires_at
            if conn.expires_at.tzinfo
            else conn.expires_at.replace(tzinfo=timezone.utc)
        )
        is_expired = expires < (now + timedelta(minutes=5))

    return {
        "connected": True,
        "account_id": conn.account_id,
        "account_name": conn.account_name,
        "is_expired": is_expired,
        "expires_at": conn.expires_at,
        "platform": platform,
    }


@router.post("/{platform}/disconnect")
async def disconnect_platform(
    platform: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(PlatformConnection).where(
        PlatformConnection.user_id == user.id, PlatformConnection.platform == platform
    )
    result = await db.execute(q)
    conn = result.scalars().first()

    if conn:
        await db.delete(conn)
        await db.commit()

    return {"status": "success", "message": f"{platform} disconnected."}
