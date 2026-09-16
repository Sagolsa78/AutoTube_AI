import pytest
from httpx import ASGITransport, AsyncClient

from backend.api.routes.auth import create_access_token
from backend.main import app
from backend.models.models import Channel, Idea, Script, User, Video, VideoStatus


@pytest.mark.asyncio
async def test_cross_user_isolation_channels_and_videos():
    import uuid

    uid_a = uuid.uuid4().hex[:8]
    uid_b = uuid.uuid4().hex[:8]
    email_a = f"user_a_{uid_a}@test.com"
    email_b = f"user_b_{uid_b}@test.com"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Register User A and User B via register endpoint so DB records exist
        reg_a = await ac.post(
            "/api/auth/register",
            json={
                "email": email_a,
                "password": "password123",
                "display_name": "User A",
                "channel_name": "Channel A",
                "niche": "science_wow",
            },
        )
        assert reg_a.status_code == 201, reg_a.text
        data_a = reg_a.json()
        headers_a = {"Authorization": f"Bearer {data_a['access_token']}"}
        user_a_id = data_a["user"]["id"]

        reg_b = await ac.post(
            "/api/auth/register",
            json={
                "email": email_b,
                "password": "password123",
                "display_name": "User B",
                "channel_name": "Channel B",
                "niche": "history",
            },
        )
        assert reg_b.status_code == 201, reg_b.text
        data_b = reg_b.json()
        headers_b = {"Authorization": f"Bearer {data_b['access_token']}"}
        user_b_id = data_b["user"]["id"]

        # User A lists channels — should only see User A's channel
        res_a_channels = await ac.get("/api/channels/", headers=headers_a)
        assert res_a_channels.status_code == 200
        channels_a = res_a_channels.json()
        assert len(channels_a) >= 1
        assert all(c["name"] == "Channel A" for c in channels_a)

        channel_a_id = channels_a[0]["id"]

        # User B attempts to access User A's channel directly — must return 404 or 403
        res_b_get_channel_a = await ac.get(
            f"/api/channels/{channel_a_id}", headers=headers_b
        )
        assert res_b_get_channel_a.status_code in (403, 404)

        # User B attempts to update User A's channel — must return 404 or 403
        res_b_patch_channel_a = await ac.patch(
            f"/api/channels/{channel_a_id}", json={"name": "Hacked"}, headers=headers_b
        )
        assert res_b_patch_channel_a.status_code in (403, 404)

        # User B attempts to preview a non-existent/unowned video — must return 404 or 403
        res_b_preview_fake = await ac.get(
            "/api/videos/fake-video-id/preview", headers=headers_b
        )
        assert res_b_preview_fake.status_code in (403, 404)
