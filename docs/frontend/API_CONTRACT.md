# AutoTube AI — Frontend API Contract Specification

This document maps all backend endpoints consumed by the AutoTube AI frontend. It defines methods, URLs, authentication headers, request payloads, response shapes, and error status handling.

---

## Base URL Configuration

- **Local Development**: `http://localhost:8000/api` (or proxied via Vite `/api`)
- **Cloud / Production**: `VITE_API_BASE_URL` env variable + `/api` prefix
- **Authentication**: `Authorization: Bearer <jwt_access_token>` in HTTP headers.

---

## 1. Authentication & User Profile (`/api/auth`, `/api/profile`)

### `POST /api/auth/register`
- **Auth**: None
- **Request**:
  ```json
  {
    "email": "creator@example.com",
    "password": "securepassword",
    "display_name": "Tech Creator",
    "channel_name": "Tech Explained",
    "niche": "science_wow"
  }
  ```
- **Response** `201 Created`:
  ```json
  {
    "access_token": "jwt_token_string",
    "token_type": "bearer",
    "user": {
      "id": "uuid-str",
      "email": "creator@example.com",
      "display_name": "Tech Creator",
      "channel_name": "Tech Explained",
      "preferred_ai_provider": "gemini",
      "preferred_ai_model": "gemini-3.5-flash-lite"
    }
  }
  ```

### `POST /api/auth/login`
- **Auth**: None
- **Request**: `{ "email": "creator@example.com", "password": "password" }`
- **Response** `200 OK`: Same as `AuthResponse`.

### `GET /api/auth/me`
- **Auth**: Bearer Token
- **Response** `200 OK`: `UserOut` object.

### `GET /api/profile/`
- **Auth**: Bearer Token
- **Response** `200 OK`:
  ```json
  {
    "id": "uuid",
    "email": "creator@example.com",
    "display_name": "Tech Creator",
    "channel_name": "Tech Explained",
    "logo_path": "/static/logos/user_logo.png",
    "preferred_ai_provider": "gemini",
    "preferred_ai_model": "gemini-3.5-flash-lite"
  }
  ```

### `PATCH /api/profile/`
- **Auth**: Bearer Token
- **Request**: `{ "display_name": "...", "channel_name": "...", "preferred_ai_provider": "...", "preferred_ai_model": "..." }`
- **Response** `200 OK`: Updated profile.

---

## 2. Channels (`/api/channels`)

### `GET /api/channels/`
- **Auth**: Bearer Token
- **Response** `200 OK`:
  ```json
  [
    {
      "id": "channel-uuid",
      "name": "AI Facts Daily",
      "niche": "ai_tech",
      "language": "en",
      "default_cta": "Subscribe for daily AI breakthroughs!",
      "caption_style": "bold_centered",
      "watermark_enabled": true,
      "watermark_opacity": 0.4,
      "watermark_position": "bottom_right",
      "watermark_scale": 0.12,
      "default_voice_id": "en-US-ChristopherNeural",
      "content_tone": "dynamic",
      "niche_keywords": ["artificial intelligence", "tech", "future"],
      "title_style_preference": "curiosity",
      "hashtag_set": ["shorts", "tech", "ai"],
      "auto_approve": false,
      "created_at": "2026-09-14T20:00:00Z"
    }
  ]
  ```

### `POST /api/channels/`
- **Auth**: Bearer Token
- **Request**: `ChannelCreate` object.
- **Response** `201 Created`: `ChannelOut`.

### `PATCH /api/channels/{channel_id}`
- **Auth**: Bearer Token
- **Request**: `ChannelUpdate` fields.
- **Response** `200 OK`: Updated `ChannelOut`.

---

## 3. Ideas (`/api/ideas`)

### `GET /api/ideas/?channel_id={id}`
- **Auth**: Bearer Token
- **Response** `200 OK`:
  ```json
  [
    {
      "id": "idea-uuid",
      "channel_id": "channel-uuid",
      "title": "How Quantum Computers Hack Passwords in Seconds",
      "topic": "Quantum Computing Security",
      "angle": "Explains Shor's algorithm in plain English with 3D visuals",
      "status": "pending",
      "score": 9.2,
      "notes": "High viral potential from trending search spike",
      "created_at": "2026-09-14T20:00:00Z"
    }
  ]
  ```

### `POST /api/ideas/generate`
- **Auth**: Bearer Token
- **Request**:
  ```json
  {
    "channel_id": "channel-uuid",
    "count": 5,
    "niche": "tech"
  }
  ```
- **Response** `201 Created`: List of newly generated `IdeaOut` objects.

---

## 4. Scripts (`/api/scripts`)

### `GET /api/scripts/?channel_id={id}&idea_id={id}`
- **Auth**: Bearer Token
- **Response** `200 OK`:
  ```json
  [
    {
      "id": "script-uuid",
      "idea_id": "idea-uuid",
      "full_text": "Did you know that your password could be cracked in 2 seconds?...",
      "duration_est": 48.5,
      "quality_score": 9.4,
      "fact_check_ok": true,
      "provider_used": "gemini-3.5-flash-lite",
      "status": "draft",
      "language": "en",
      "locale": "US",
      "scenes": [
        {
          "id": "scene-uuid-1",
          "scene_number": 1,
          "narration": "Did you know that standard encryption is vulnerable?",
          "visual_description": "Futuristic padlock glowing blue breaking into shards",
          "asset_id": null,
          "preferred_visual_mode": "ai_gen",
          "generation_prompt": "Futuristic glowing lock shattering into digital code, 9:16 cinematic",
          "visual_intent": "high_tension",
          "stock_query": "cyber security digital lock"
        }
      ],
      "created_at": "2026-09-14T20:00:00Z"
    }
  ]
  ```

### `POST /api/scripts/generate/{idea_id}`
- **Auth**: Bearer Token
- **Request**: Query parameters `?language=en&locale=US`.
- **Response** `201 Created`: Generated `ScriptOut`.

---

## 5. Videos & Rendering (`/api/videos`)

### `GET /api/videos/?channel_id={id}&status={status}`
- **Auth**: Bearer Token
- **Response** `200 OK`:
  ```json
  [
    {
      "id": "video-uuid",
      "script_id": "script-uuid",
      "path": "storage/output/video-uuid.mp4",
      "duration": 52.4,
      "style": "fast_facts",
      "caption_style": "bold_centered",
      "status": "ready",
      "ai_used": true,
      "notes": null,
      "render_stage": "done",
      "render_progress": 100.0,
      "title_candidates": [
        "How Quantum Computers Crack Passwords in 2 Seconds",
        "Your Passwords Are No Longer Safe"
      ],
      "selected_title": "How Quantum Computers Crack Passwords in 2 Seconds",
      "description": "Quantum decryption explained in 60 seconds. #shorts #quantum #cybersecurity",
      "hashtags": ["shorts", "quantum", "tech"],
      "voice_override": "en-US-ChristopherNeural",
      "created_at": "2026-09-14T20:00:00Z"
    }
  ]
  ```

### `POST /api/videos/render`
- **Auth**: Bearer Token
- **Request**:
  ```json
  {
    "script_id": "script-uuid",
    "style": "fast_facts",
    "caption_style": "bold_centered",
    "custom_cta": "Subscribe for more daily tech!",
    "voice_override": "en-US-ChristopherNeural"
  }
  ```
- **Response** `202 Accepted`: Initial `VideoOut` with `status: "rendering"`, `render_stage: "queued"`, `render_progress: 0`.

### `GET /api/videos/{video_id}/progress`
- **Auth**: Bearer Token
- **Response** `200 OK`:
  ```json
  {
    "video_id": "video-uuid",
    "status": "rendering",
    "render_stage": "visuals",
    "stage_label": "Fetching visuals",
    "progress": 40.0,
    "notes": null
  }
  ```

### `GET /api/videos/{video_id}/preview`
- **Auth**: Bearer Header or Token query parameter for `<video>` stream tags.
- **Response**: Streams video file (`video/mp4`) or 307 Redirect to signed CDN URL.

---

## 6. Jobs & Compute Telemetry (`/api/jobs`)

### `GET /api/jobs/` *(Added for unified listing)*
- **Auth**: Bearer Token
- **Query**: `?limit=20&status=running`
- **Response** `200 OK`:
  ```json
  [
    {
      "id": "job-uuid",
      "capability": "RENDER",
      "status": "running",
      "worker_id": "local-worker-1",
      "worker_type": "local",
      "cost_usd": 0.0,
      "payload": { "video_id": "video-uuid", "style": "fast_facts" },
      "result": null,
      "error_message": null,
      "created_at": "2026-09-14T20:00:00Z",
      "started_at": "2026-09-14T20:00:02Z",
      "completed_at": null
    }
  ]
  ```

### `GET /api/jobs/{job_id}`
- **Auth**: Bearer Token
- **Response** `200 OK`: `JobResponse` object.

### `GET /api/jobs/telemetry`
- **Auth**: None / Authenticated
- **Response** `200 OK`:
  ```json
  {
    "strategy": "Local-First ($0)",
    "local_worker": {
      "name": "Local RTX 3050",
      "status": "online",
      "last_seen_seconds_ago": 4
    },
    "cloud_burst": {
      "provider": "RunPod Serverless",
      "today_spent_usd": 0.0,
      "daily_budget_usd": 2.0,
      "budget_remaining_usd": 2.0
    }
  }
  ```

---

## 7. YouTube & Publications (`/api/youtube`, `/api/videos/{id}/upload`)

### `GET /api/youtube/auth`
- **Auth**: Bearer Token
- **Response** `200 OK`: `{ "authorization_url": "https://accounts.google.com/o/oauth2/..." }`

### `GET /api/youtube/status`
- **Auth**: Bearer Token
- **Response** `200 OK`:
  ```json
  {
    "connected": true,
    "channel_id": "UCxxxxxxx",
    "channel_title": "AI Facts Daily",
    "is_expired": false,
    "expires_at": "2026-09-15T12:00:00Z"
  }
  ```

### `DELETE /api/youtube/disconnect`
- **Auth**: Bearer Token
- **Response** `200 OK`: `{ "status": "success", "message": "YouTube disconnected." }`

---

## 8. Analytics (`/api/analytics`)

### `GET /api/analytics/?channel_id={id}`
- **Auth**: Bearer Token
- **Response** `200 OK`:
  ```json
  {
    "youtube_connected": true,
    "youtube_channel_title": "AI Facts Daily",
    "monetization": {
      "current_views": 142500,
      "views_target": 10000000,
      "current_subs": 420,
      "subs_target": 1000
    },
    "performance": {
      "total_views": 142500,
      "total_subs": 420,
      "total_likes": 8940,
      "total_videos": 18,
      "total_ideas": 45
    },
    "storage": {
      "output_mb": 420.5,
      "temp_mb": 110.2,
      "total_mb": 530.7,
      "limit_mb": 50000
    },
    "niche_distribution": [{ "niche": "Tech", "count": 14 }]
  }
  ```
