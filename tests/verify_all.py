"""
Direct End-to-End Verification Runner for AutoTube AI Overhaul.
Runs tests in a clean, unified event loop.
"""
import asyncio
import uuid
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.db.database import init_db, engine
from integrations.providers.ai_providers import get_available_models
from backend.youtube import youtube_client

async def main():
    print("==================================================")
    print("▶ Running AutoTube AI Overhaul Verification Suite")
    print("==================================================")

    # 1. Database Init & Schema Check
    print("\n[1/5] Checking Database Initialization & Schema...")
    await init_db()
    from sqlalchemy import text
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'users';"))
        cols = [r[0] for r in res.fetchall()]
        print(f"Users columns in database: {cols}")
        assert "password_hash" in cols, "password_hash column missing!"
        assert "preferred_ai_provider" in cols, "preferred_ai_provider column missing!"
        assert "preferred_ai_model" in cols, "preferred_ai_model column missing!"
    print("✔ [1/5] Database columns verified successfully.")

    # 2. AI Model Detection
    print("\n[2/5] Checking AI Provider & Installed Models Detection...")
    models_info = get_available_models()
    assert "ollama" in models_info
    assert "gemini" in models_info
    print(f"Ollama Local Status: available={models_info['ollama']['available']}, models={models_info['ollama']['models']}")
    print(f"Gemini Cloud Status: available={models_info['gemini']['available']}")
    print("✔ [2/5] AI Model Detection working correctly.")

    # 3. Native Multi-User Auth (Register, Login, Me, AI Preference)
    print("\n[3/5] Testing Multi-User Auth & Settings API...")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        uid = str(uuid.uuid4())[:8]
        test_email = f"creator_{uid}@autotube.ai"
        test_pass = "mypassword123"

        # Register
        print(f"Registering new user: {test_email}...")
        reg_res = await ac.post("/api/auth/register", json={
            "email": test_email,
            "password": test_pass,
            "display_name": f"Alex {uid}",
            "channel_name": f"Science Lab {uid}",
            "niche": "science_wow"
        })
        assert reg_res.status_code == 201, f"Registration failed: {reg_res.text}"
        reg_data = reg_res.json()
        token = reg_data["access_token"]
        user_id = reg_data["user"]["id"]
        assert token and user_id
        print(f"✔ Registered successfully (User ID: {user_id}).")

        headers = {"Authorization": f"Bearer {token}"}

        # Get Me
        me_res = await ac.get("/api/auth/me", headers=headers)
        assert me_res.status_code == 200
        assert me_res.json()["email"] == test_email
        print("✔ /api/auth/me verified.")

        # Get Models
        models_res = await ac.get("/api/auth/models", headers=headers)
        assert models_res.status_code == 200
        assert "providers" in models_res.json()
        print("✔ /api/auth/models verified.")

        # Update AI Preference to qwen2.5-coder:7b
        patch_res = await ac.patch("/api/auth/ai-settings", json={
            "provider": "ollama",
            "model": "qwen2.5-coder:7b"
        }, headers=headers)
        assert patch_res.status_code == 200
        assert patch_res.json()["preferred_ai_model"] == "qwen2.5-coder:7b"
        print("✔ /api/auth/ai-settings preference persisted.")

        # Login
        print("Logging in with newly created credentials...")
        login_res = await ac.post("/api/auth/login", json={
            "email": test_email,
            "password": test_pass
        })
        assert login_res.status_code == 200
        login_token = login_res.json()["access_token"]
        assert login_token
        print("✔ Login succeeded with valid JWT issued.")

    # 4. YouTube Real Analytics (Zero Mock Data)
    print("\n[4/5] Checking Real YouTube Analytics (Zero Mock)...")
    yt_data = await youtube_client.fetch_channel_analytics(user_id)
    print(f"YouTube data for unconnected user: {yt_data}")
    assert yt_data["connected"] is False
    assert yt_data["views_90d"] == 0
    assert yt_data["subscribers_gained"] == 0
    # Must NOT be mock numbers!
    assert yt_data["views_90d"] != 4250, "Still returning mock 4250 views!"
    assert yt_data["subscribers_gained"] != 142, "Still returning mock 142 subscribers!"
    print("✔ YouTube analytics confirmed: Real zero baseline, zero mock data.")

    # 5. Review & Approval YouTube Workflow Verification
    print("\n[5/5] Checking Video Approval State Machine...")
    from backend.models.models import VideoStatus
    assert VideoStatus.ready == "ready"
    assert VideoStatus.approved == "approved"
    assert VideoStatus.uploaded == "uploaded"
    print("✔ Video lifecycle stages verified.")

    print("\n==================================================")
    print("🎉 ALL 5 VERIFICATION SUITES PASSED PERFECTLY!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(main())
