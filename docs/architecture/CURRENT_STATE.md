# AutoTube AI — Current Architecture State

> Audit performed: 2026-09-11  
> Auditor: Architecture Review (Phase 0)  
> Repository: `Sagolsa78/AutoTube_AI` branch `v1`

---

## 1. Current Components

### Backend (`backend/`)
| File | Purpose | Lines |
|---|---|---|
| `main.py` | FastAPI entry point, lifespan starts worker in-process | 78 |
| `settings.py` | Flat `os.getenv()` config, no validation | 61 |
| `db/database.py` | SQLAlchemy async engine, `create_all()` on startup | 27 |
| `models/models.py` | 12 SQLAlchemy models, `tenant_id` on most | 312 |
| `worker.py` | In-process `asyncio.create_task` polling loop | 135 |
| `worker_router.py` | Worker registry + dispatch decision tree (local/RunPod) | 305 |
| `events.py` | Redis event bus (graceful fallback if Redis missing) | 39 |
| `security.py` | API key / Bearer / Cloudflare Access auth (bypassed in dev) | 62 |
| `cloud_storage.py` | S3/R2 storage abstraction (upload, download, signed URL) | 113 |
| `youtube.py` | YouTube Analytics API client (mostly mock) | 120 |

### API Routes (`backend/api/routes/`)
| Route | Prefix | Key Behavior |
|---|---|---|
| `profile.py` | `/api/profile` | Singleton `default-user` profile, logo upload |
| `channels.py` | `/api/channels` | CRUD, no tenant filter |
| `ideas.py` | `/api/ideas` | CRUD + AI generation |
| `scripts.py` | `/api/scripts` | Scene-based script generation via AI fallback chain |
| `videos.py` | `/api/videos` | Render trigger, progress polling, approve/reject, YouTube upload |
| `assets.py` | `/api/assets` | Stock footage search + scene assignment |
| `analytics.py` | `/api/analytics` | Dashboard analytics + YouTube integration |
| `jobs.py` | `/api/jobs` | Compute job CRUD, worker heartbeat/poll/complete/fail |
| `health.py` | `/api/system/health` | Hardcoded provider status list |

### Engine (`engine/`)
| Module | Purpose |
|---|---|
| `models.py` | `RenderJob` dataclass — pipeline data bag |
| `story/schemas.py` | Pydantic `StorySpec`, `SceneSpec`, `Claim`, `Evidence` |
| `story/planner.py` | Story planning logic |
| `story/timeline.py` | Scene-to-audio alignment |
| `story/validator.py` | Story validation |
| `script/generator.py` | LLM script generation |
| `script/trends.py` | Trend analysis |
| `tts/voiceover.py` | Edge-TTS with word-boundary capture |
| `visuals/router.py` | Visual routing: STOCK / GENERATED_IMAGE / GENERATED_VIDEO |
| `visuals/fetcher.py` | Pexels + Pixabay search + download |
| `visuals/comfyui.py` | ComfyUI client (not yet implemented — `raise NotImplementedError`) |
| `captions/styles.py` | ASS subtitle style system |
| `quality/checker.py` | Script quality scoring |
| `research/verifier.py` | Fact checking |
| `rendering/assembler.py` | FFmpeg video assembly (1080×1920 H.264) |

### Integrations (`integrations/`)
| Module | Purpose |
|---|---|
| `providers/ai_providers.py` | Ollama → Gemini → Groq → OpenRouter fallback chain |
| `youtube/uploader.py` | OAuth2 + YouTube Data API upload (pickle-based token) |
| `pexels/` | Empty `__init__.py` |
| `pixabay/` | Empty `__init__.py` |

### Infrastructure
| File | Purpose |
|---|---|
| `Dockerfile` | Python 3.11-slim + FFmpeg, runs `uvicorn` |
| `frontend/Dockerfile` | Node build → nginx static serve |
| `docker-compose.yml` | PostgreSQL + Redis + backend + frontend + n8n |
| `render.yaml` | Render web service config |
| `alembic.ini` | Alembic config (URL placeholder, overridden in `env.py`) |
| `migrations/env.py` | Async Alembic runner using `backend.settings.DATABASE_URL` |
| `worker_agent.py` | Standalone HTTP polling worker daemon |

### Frontend (`frontend/`)
- **Framework:** React 18 + Vite + TailwindCSS v4
- **Routing:** react-router-dom v6
- **Pages:** Landing, Dashboard, Channels, Ideas, Scripts, Videos, Analytics, Profile, Health, Logs, Publications, Studio
- **API Client:** `services/api.js` — uses `VITE_API_URL` env var with `/api` proxy fallback
- **UI:** Radix UI primitives, Lucide icons, Recharts, Sonner toasts

---

## 2. Current Data Flow

```
User (Browser)
    │
    ▼
Frontend (React/Vite :5173)
    │ Vite dev proxy: /api → localhost:8000
    ▼
FastAPI (uvicorn :8000)
    │
    ├── Profile → singleton "default-user"
    ├── Channel → CRUD (no tenant filter)
    ├── Idea → AI generate via fallback chain
    ├── Script → AI generate + fact check + quality check
    ├── Video/Render →
    │       1. Create Video row (status=rendering)
    │       2. queue_render_task() → ensures worker polling loop running
    │       3. Return 202 with video_id
    │
    ▼
Worker (in-process asyncio task)
    │ Polls DB for status=rendering videos
    │
    ├── TTS (Edge-TTS) → storage/audio/{video_id}/
    ├── Visuals (Pexels/Pixabay) → storage/visuals/{video_id}/
    ├── Assembly (FFmpeg) → storage/renders/
    ├── Metadata (AI generation)
    ├── YouTube upload (if token.json exists)
    │
    ▼
Video row updated: status=ready, path=local_path
```

---

## 3. Current Rendering Flow

1. **POST `/api/videos/render`** creates `Video` row, builds `RenderJob` dataclass
2. **`queue_render_task()`** calls `start_worker()` which spawns `poll_jobs()` as `asyncio.create_task`
3. **`poll_jobs()`** queries `Video WHERE status=rendering ORDER BY created_at LIMIT 1`
4. **`_run_render()`** executes pipeline stages sequentially:
   - Stage 1: TTS → Edge-TTS with word boundaries → `storage/audio/{id}/`
   - Stage 2: Visuals → VisualRouter → Pexels/Pixabay/ComfyUI → `storage/visuals/{id}/`
   - Stage 3: Assembly → FFmpeg filtergraph → `storage/renders/short_{hex}.mp4`
   - Stage 4: Metadata → AI-generated titles, descriptions, hashtags
   - Stage 5: YouTube draft upload (if `token.json` exists)
5. Progress tracked via `Video.render_stage` and `Video.render_progress` columns

**Critical Issue:** The worker runs **inside the FastAPI process** via `asyncio.create_task`. There is no separate worker process in the default setup.

---

## 4. Current Worker Behavior

### Two Worker Systems (Coexisting, Partially Overlapping)

**System 1: In-Process Poller (`backend/worker.py`)**
- Started in FastAPI lifespan via `asyncio.create_task(poll_jobs())`
- Polls `Video` table for `status=rendering`
- Calls `_run_render()` from `videos.py` directly
- Sequential processing, single video at a time
- **This is what actually renders videos**

**System 2: HTTP Worker Agent (`worker_agent.py`)**
- Standalone daemon, polls `/api/jobs/worker/poll`
- Sends heartbeats to `/api/jobs/worker/heartbeat`
- Reports completion via `/api/jobs/{id}/complete`
- **`execute_job()` is a stub** — returns simulated results, doesn't actually render
- Uses the `Job` model (separate from `Video` model)

**System 3: Worker Router (`backend/worker_router.py`)**
- Decision tree: local_pc → RunPod → queue
- In-memory `WorkerRegistry` with heartbeat tracking
- Budget tracking via `DailyComputeSpend` model
- **Not connected to actual rendering** — dispatches `Job` records but video rendering uses `Video.status=rendering`

**Assessment:** Three partially-built worker/job systems exist. Only System 1 actually renders videos. Systems 2 and 3 are architectural scaffolding that don't connect to the rendering pipeline.

---

## 5. Current Storage Behavior

### Local Storage (Active)
- `storage/audio/{video_id}/` — TTS output
- `storage/visuals/{video_id}/` — downloaded stock clips
- `storage/renders/` — final MP4 output
- `storage/logos/` — uploaded watermark logos
- `storage/projects/` — unused
- `storage/autoshorts.db` — SQLite database (when using SQLite)
- Paths created at import time in `settings.py`

### Cloud Storage (Scaffolding)
- `backend/cloud_storage.py` provides `CloudStorage` class
- `upload_file()`, `download_file()`, `get_signed_url()`, `get_public_url()`
- Singleton `storage = CloudStorage(provider=os.getenv("STORAGE_PROVIDER", "local"))`
- Used in `_run_render()` — uploads to R2/S3 after assembly if provider != local
- Video preview endpoint supports R2 signed URLs and redirect

**Assessment:** Storage abstraction exists but is a flat class, not protocol-based. Lacks `put_file`, `exists`, `delete_file`, `generate_upload_url`. Missing lifecycle/retention.

---

## 6. Current Authentication State

### Backend Auth (`backend/security.py`)
- Supports: API Key header, Bearer token, Cloudflare Access JWT
- **Bypassed entirely** when `APP_ENV=development` or `AUTH_DISABLED=true`
- **NOT applied to any routes** — `verify_control_plane_auth` exists as a dependency but no router uses it
- No user model, no sessions, no JWT tokens

### Current State
- **Zero authentication in practice**
- All API endpoints are publicly accessible
- No user login/registration
- No session management
- `DEFAULT_PROFILE_ID = "default-user"` hardcoded everywhere

---

## 7. Current YouTube OAuth Behavior

### Token Storage
- **Global singleton** `token.json` at project root (pickle format)
- `client_secret.json` at project root (**committed to repo — SECURITY RISK**)
- OAuth flow via `InstalledAppFlow.run_local_server()` — requires local browser

### Upload Flow
- `integrations/youtube/uploader.py` reads `YOUTUBE_TOKEN_FILE` (Path object)
- `_get_credentials()` loads pickle, refreshes if expired
- `upload_video()` uses `MediaFileUpload` with resumable upload
- Called from `_run_render()` during metadata stage

### Issues
- ⚠️ `client_secret.json` contains real OAuth client ID + secret — committed to repo
- ⚠️ `token.json` is per-machine, not per-user
- ⚠️ `InstalledAppFlow` only works with local browser — incompatible with cloud
- ⚠️ Pickle-based credential storage — not portable, not secure for multi-user
- ⚠️ No per-user YouTube connection model
- ⚠️ No OAuth callback URL for cloud deployments

---

## 8. Current Database Behavior

### Engine
- SQLAlchemy 2.0 async (asyncio)
- Default: `sqlite+aiosqlite:///./storage/autoshorts.db`
- Current `.env`: PostgreSQL on Neon (`postgresql+asyncpg://...`)
- `settings.py` auto-converts `postgres://` → `postgresql+asyncpg://`, strips `channel_binding`

### Schema
- 12 models: `UserProfile`, `Channel`, `Idea`, `Script`, `Scene`, `Asset`, `Video`, `Publication`, `Analytics`, `AnalyticsSnapshot`, `Job`, `DailyComputeSpend`
- All user-facing models have `tenant_id` column with `default=DEFAULT_PROFILE_ID`
- **No foreign key from resources to User** — `tenant_id` is a plain string, not a FK

### Migrations
- Alembic configured with async engine
- 6 migrations exist (initial + scenes + tenant_id + render_stage + assets + lifecycle)
- `env.py` reads `DATABASE_URL` from `backend.settings`
- **Startup uses `create_all()`** — migrations exist but aren't the primary schema strategy

### Issues
- ⚠️ `create_all()` in production startup — may conflict with migrations
- ⚠️ `tenant_id` defaults to `"default-user"` — not null, not FK
- ⚠️ No unique constraints on `(tenant_id, resource_id)` pairs
- ⚠️ `datetime.utcnow` deprecated in newer Python — should use `timezone.utc`

---

## 9. Current Local-Only Dependencies

| Dependency | Used Where | Cloud Blocker? |
|---|---|---|
| Local filesystem (`storage/`) | TTS, visuals, renders, logos | **YES** — Render has no persistent disk |
| `token.json` (pickle file) | YouTube upload | **YES** — per-machine, not per-user |
| `client_secret.json` | YouTube OAuth | **YES** — hardcoded path |
| ComfyUI (`localhost:8188`) | Visual generation | No — graceful fallback |
| Ollama (`localhost:11434`) | Script generation | No — fallback chain skips if unavailable |
| In-process worker | Video rendering | **YES** — Render free tier has 30s request timeout |
| FFmpeg subprocess | Video assembly | **YES** — must be installed on worker |
| SQLite file | Database | No — already supports PostgreSQL |
| Redis (`localhost:6379`) | Event bus | No — graceful fallback |

---

## 10. Current Cloud Blockers

### Critical (Must Fix)

1. **Worker runs inside FastAPI process** — Render free tier kills requests after 30s. Video rendering takes 2-10 minutes.
2. **No persistent disk** — `storage/` directory is ephemeral on Render. Renders would be lost.
3. **YouTube OAuth is per-machine** — `InstalledAppFlow` requires local browser. No cloud OAuth callback.
4. **No real authentication** — public beta exposes all endpoints without login.
5. **No tenant isolation** — all queries return all data (e.g., `GET /api/videos/` returns every user's videos).
6. **CORS is `allow_origins=["*"]`** — insecure for authenticated APIs.

### Important (Should Fix)

7. **`create_all()` as migration strategy** — risky for production schema changes.
8. **Health endpoint is hardcoded** — doesn't reflect actual provider availability.
9. **No rate limiting** — any client can trigger unlimited renders.
10. **No structured error responses** — raw exception strings returned.
11. **No graceful shutdown** — FFmpeg processes can be orphaned.
12. **`client_secret.json` in repo** — OAuth client secret exposed.

---

## 11. Existing Reusable Abstractions

### Strong — Keep and Extend
- **AI Provider Fallback Chain** (`integrations/providers/ai_providers.py`) — Clean `BaseProvider` ABC with `generate()` + `is_available()`. 4 providers implemented. Well-designed.
- **Story/Scene Schema** (`engine/story/schemas.py`) — Pydantic models for `StorySpec`, `SceneSpec`, `Claim`, `Evidence`. Solid foundation.
- **Visual Router** (`engine/visuals/router.py`) — Mode-based routing (STOCK/GENERATED_IMAGE/GENERATED_VIDEO). Good abstraction.
- **Edge-TTS Integration** (`engine/tts/voiceover.py`) — Word-boundary capture, language fallback. Production-quality.
- **FFmpeg Assembler** (`engine/rendering/assembler.py`) — Filtergraph builder, async wrapper, watermark support. Solid.
- **Cloud Storage** (`backend/cloud_storage.py`) — S3/R2 client exists. Needs protocol interface and `delete`/`exists`/`upload_url`.
- **Frontend API Client** (`frontend/src/services/api.js`) — Already uses `VITE_API_URL`. Clean.
- **Database Models** — `tenant_id` already on most models. Job model exists with good fields.

### Weak — Needs Rework
- **Worker System** — Three overlapping systems, only one works. Needs consolidation.
- **Worker Router** — Over-engineered for current needs. RunPod never implemented.
- **Event Bus** — Redis pub/sub with no subscribers. Not needed for MVP.
- **Security/Auth** — Dependency exists but unused. Need real auth.
- **YouTube Integration** — Global singleton, pickle tokens. Needs per-user redesign.

---

## 12. Critical Technical Risks

| Risk | Severity | Impact |
|---|---|---|
| Worker inside API process | 🔴 Critical | Render kills long requests. Videos will never complete on cloud. |
| No authentication | 🔴 Critical | Public beta with no login = anyone can access/modify all data |
| No tenant isolation | 🔴 Critical | Multi-user data leaks — one user sees another's videos |
| `client_secret.json` committed | 🔴 Critical | Google OAuth credentials exposed in git history |
| No rate limiting | 🟡 High | Abuse vector — unlimited renders, unlimited AI calls |
| Ephemeral storage on Render | 🟡 High | Files lost on redeploy. Must use R2 for permanence. |
| `create_all()` in production | 🟡 High | Schema drift, migration conflicts |
| CORS `*` with auth | 🟡 High | Cross-origin attacks possible |
| No graceful FFmpeg shutdown | 🟡 Medium | Zombie processes on worker termination |
| Pickle-based YouTube tokens | 🟡 Medium | Not portable, not secure |

---

## 13. Recommended Migration Path

### Phase 1: Configuration
- Create `backend/core/config.py` with Pydantic Settings
- Add `APP_MODE`, `WORKER_BACKEND`, `STORAGE_BACKEND` variables
- Centralize all env access

### Phase 2: Database
- Remove `create_all()` from startup
- Make Alembic the sole migration path
- Add user FK to models
- PostgreSQL-first schema

### Phase 3: Storage
- Formalize `StorageBackend` protocol
- Add `LocalStorageBackend`, `S3StorageBackend`
- Add `delete_file`, `exists`, `generate_upload_url`

### Phase 4: Worker Separation
- Remove `start_worker()` from FastAPI lifespan
- Create `backend/worker/` package
- `LocalJobExecutor` — separate process polling DB
- CLI entry: `python -m backend.worker`

### Phase 5: Cloud Worker
- `GitHubActionsJobExecutor` — triggers workflow_dispatch
- `.github/workflows/video-worker.yml`
- Job-oriented: one workflow = one video

### Phase 6: Authentication + Tenancy
- Add auth provider (Supabase Auth or API key + JWT)
- Add `get_current_user()` dependency
- Filter all queries by `user_id`

### Phase 7: YouTube
- Per-user `YouTubeConnection` model with encrypted credentials
- OAuth callback endpoint for cloud
- Remove global `token.json`

### Phase 8: Frontend
- Ensure `VITE_API_BASE_URL` works for cloud
- Job progress survives refresh
- Error handling for cloud failures

### Phase 9: Docker + Deployment
- Separate API and worker Dockerfiles
- `docker-compose.yml` with separate services
- `render.yaml` for API only
- GitHub Actions workflow for worker

### Phase 10: Testing + Security
- Config, storage, job, auth, tenant isolation tests
- Security audit (CORS, CSRF, path traversal, subprocess injection)
- Rate limiting

### Phase 11: Documentation
- All architecture docs
- Local setup guide
- Cloud deployment guide
- Handoff document
