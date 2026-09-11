# AutoTube AI — Handoff Document

> Last Updated: 2026-09-11  
> Phase: 0 (Audit Complete)

---

## PROJECT GOAL

Transform AutoTube AI from a local-only, single-user YouTube Shorts automation tool into a production-grade dual-mode (local + cloud) platform with:
- Multi-tenant authentication and user isolation
- Separated API and worker processes
- Cloud storage (Cloudflare R2)
- Cloud worker execution (GitHub Actions for zero-cost beta)
- Deployment on Render (API) + Neon (PostgreSQL) + R2 (storage)
- Clean abstractions for future GPU worker migration

---

## CURRENT ARCHITECTURE

```
Frontend (React/Vite/TailwindCSS v4)
    │ Vite proxy: /api → localhost:8000
    ▼
FastAPI (uvicorn)
    ├── 9 API routers (profile, channels, ideas, scripts, videos, assets, analytics, jobs, health)
    ├── In-process worker (asyncio.create_task polling loop)
    ├── SQLAlchemy 2.0 async (SQLite or PostgreSQL)
    ├── 12 models with tenant_id="default-user"
    ├── No authentication enforced
    ├── CORS: allow_origins=["*"]
    │
    ├── Engine modules:
    │   ├── AI providers (Ollama→Gemini→Groq→OpenRouter fallback)
    │   ├── TTS (Edge-TTS with word boundaries)
    │   ├── Visuals (Pexels/Pixabay search, ComfyUI stub)
    │   ├── Rendering (FFmpeg 1080×1920 assembly)
    │   ├── Captions (ASS karaoke styles)
    │   └── Quality/Research (script checking, fact verification)
    │
    └── YouTube (global token.json, pickle-based OAuth)
```

---

## TARGET ARCHITECTURE

```
Frontend (Render Static Site)
    │
    ▼
FastAPI API (Render Web Service) ← Auth (Supabase/JWT)
    │
    ├── Neon PostgreSQL (durable state)
    ├── Storage Abstraction → Cloudflare R2
    ├── Job Executor Abstraction
    │       ├── LocalJobExecutor (dev)
    │       └── GitHubActionsJobExecutor (cloud)
    │
    ▼
Worker Process (Local or GitHub Actions)
    ├── TTS → temp workspace
    ├── Visuals → temp workspace
    ├── FFmpeg → temp workspace
    ├── Upload → R2
    └── Update → PostgreSQL
```

---

## COMPLETED WORK

### Phase 0 — Audit (Complete)
- Full inspection of all 50+ source files
- Identified 3 overlapping worker systems (only 1 functional)
- Identified critical security risks (committed credentials, no auth, no tenant isolation)
- Created comprehensive architecture audit
- Created implementation plan with 11 phases
- Created progress tracking system
- Created this handoff document
- Created architectural decision records

### Files Created
| File | Purpose |
|---|---|
| `docs/architecture/CURRENT_STATE.md` | Comprehensive audit of current codebase |
| `docs/implementation/PLAN.md` | Detailed implementation plan with all phases |
| `docs/implementation/PROGRESS.md` | Phase-by-phase progress tracking |
| `docs/implementation/HANDOFF.md` | This file — context for continuation |
| `docs/implementation/DECISIONS.md` | Architectural decision records |

### Files Changed
None — Phase 0 is audit-only, no code modifications.

---

## INCOMPLETE WORK

All implementation phases (1-11) are pending. See `docs/implementation/PLAN.md` for details.

| Phase | Name | Status |
|---|---|---|
| 1 | Configuration System | Not started |
| 2 | Database & Migrations | Not started |
| 3 | Storage Abstraction | Not started |
| 4 | Worker Separation | Not started |
| 5 | Cloud Worker | Not started |
| 6 | Authentication + Tenancy | Not started |
| 7 | YouTube OAuth | Not started |
| 8 | Frontend Cloud | Not started |
| 9 | Docker & Deployment | Not started |
| 10 | Testing & Hardening | Not started |
| 11 | Documentation | 15% (audit docs only) |

---

## IMPORTANT FILES

### Backend Core
| File | Lines | Role |
|---|---|---|
| `backend/main.py` | 78 | FastAPI entry point — **worker started here (must remove)** |
| `backend/settings.py` | 61 | Config — **must be replaced with Pydantic Settings** |
| `backend/db/database.py` | 27 | DB engine — **uses create_all() (must switch to Alembic-only)** |
| `backend/models/models.py` | 312 | All models — **tenant_id needs FK to User** |
| `backend/worker.py` | 135 | In-process worker — **must become separate process** |
| `backend/worker_router.py` | 305 | Worker routing — **over-engineered, needs simplification** |
| `backend/cloud_storage.py` | 113 | Storage — **needs protocol interface** |
| `backend/security.py` | 62 | Auth dependency — **exists but unused** |
| `backend/youtube.py` | 120 | YT analytics — **singleton, mock data** |

### API Routes
| File | Lines | Critical Issues |
|---|---|---|
| `backend/api/routes/videos.py` | 639 | Contains `_run_render()` (rendering logic in API), no tenant filter |
| `backend/api/routes/scripts.py` | 292 | No tenant filter on queries |
| `backend/api/routes/jobs.py` | 282 | Compute job CRUD, no auth |
| `backend/api/routes/profile.py` | 162 | Singleton `default-user` profile |
| `backend/api/routes/channels.py` | 71 | No tenant filter |

### Engine (Generally Well-Structured)
| File | Lines | Notes |
|---|---|---|
| `engine/rendering/assembler.py` | 327 | FFmpeg assembly — solid, keep |
| `engine/tts/voiceover.py` | 147 | Edge-TTS — solid, keep |
| `engine/visuals/router.py` | 187 | Visual routing — good abstraction |
| `engine/visuals/fetcher.py` | 143 | Stock footage — solid |
| `engine/story/schemas.py` | 61 | Pydantic schemas — solid |
| `integrations/providers/ai_providers.py` | 142 | AI fallback chain — excellent |

### Infrastructure
| File | Notes |
|---|---|
| `Dockerfile` | Single container for everything — needs separation |
| `docker-compose.yml` | Includes Redis + n8n (may not need) |
| `render.yaml` | API deployment — missing frontend, missing env vars |
| `worker_agent.py` | Standalone daemon — stubs only, doesn't render |

---

## IMPORTANT CLASSES

| Class | File | Role |
|---|---|---|
| `Base` | `backend/models/models.py` | SQLAlchemy declarative base |
| `Video` / `VideoStatus` | `backend/models/models.py` | Core video model with render tracking |
| `Job` / `JobStatus` | `backend/models/models.py` | Compute job model |
| `RenderJob` | `engine/models.py` | Dataclass carrying pipeline data between stages |
| `StorySpec` / `SceneSpec` | `engine/story/schemas.py` | Pydantic models for script structure |
| `CloudStorage` | `backend/cloud_storage.py` | S3/R2 storage (needs protocol refactor) |
| `WorkerRegistry` | `backend/worker_router.py` | In-memory worker tracking |
| `BaseProvider` | `integrations/providers/ai_providers.py` | AI provider ABC |
| `VisualRouter` | `engine/visuals/router.py` | Visual mode routing |

---

## IMPORTANT ENVIRONMENT VARIABLES

### Currently Used
| Variable | Default | Location |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./storage/autoshorts.db` | `settings.py` |
| `STORAGE_ROOT` | `storage` | `settings.py` |
| `GEMINI_API_KEY` | `""` | `settings.py` |
| `GROQ_API_KEY` | `""` | `settings.py` |
| `OPENROUTER_API_KEY` | `""` | `settings.py` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | `settings.py` |
| `OLLAMA_MODEL` | `llama3.2` | `settings.py` |
| `PEXELS_API_KEY` | `""` | `settings.py` |
| `PIXABAY_API_KEY` | `""` | `settings.py` |
| `YOUTUBE_CLIENT_SECRETS` | `client_secret.json` | `settings.py` |
| `SCRIPT_PROVIDER_ORDER` | `ollama,gemini,groq,openrouter` | `settings.py` |
| `APP_ENV` | `development` | `settings.py` |
| `LOG_LEVEL` | `INFO` | `settings.py` |
| `STORAGE_PROVIDER` | `local` | `cloud_storage.py` |
| `S3_ENDPOINT_URL` | None | `cloud_storage.py` |
| `S3_BUCKET_NAME` | `autoshorts-assets` | `cloud_storage.py` |
| `S3_ACCESS_KEY_ID` | None | `cloud_storage.py` |
| `S3_SECRET_ACCESS_KEY` | None | `cloud_storage.py` |
| `R2_PUBLIC_DOMAIN` | None | `cloud_storage.py` |
| `REDIS_URL` | `redis://localhost:6379/0` | `events.py` |
| `AUTOTUBE_API_KEY` | `""` | `security.py` |
| `AUTH_DISABLED` | `false` | `security.py` |
| `DAILY_GPU_BUDGET_CAP` | `2.00` | `worker_router.py` |
| `COMPUTE_STRATEGY` | `local-first` | `worker_router.py` |
| `ZERO_LAPTOP_MODE` | `false` | `worker_router.py` |
| `COMFYUI_URL` | `http://127.0.0.1:8188` | `visuals/comfyui.py` |
| `VITE_API_URL` | `""` | `frontend/api.js` |

### To Be Added
| Variable | Purpose |
|---|---|
| `APP_MODE` | `local` or `cloud` — primary mode switch |
| `WORKER_BACKEND` | `local` or `github_actions` |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `PUBLIC_BASE_URL` | Public URL of the API |
| `FRONTEND_URL` | Public URL of the frontend |
| `GITHUB_TOKEN` | For workflow dispatch |
| `GITHUB_REPOSITORY` | `owner/repo` for dispatch |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2-specific access key |
| `R2_SECRET_ACCESS_KEY` | R2-specific secret |
| `R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_BASE_URL` | Public URL for R2 assets |
| `VIDEO_RETENTION_DAYS` | Storage lifecycle |
| `MAX_ACTIVE_JOBS_PER_USER` | Rate limiting |
| `MAX_DAILY_GENERATION_JOBS` | Rate limiting |

---

## DATABASE CHANGES

### Current Schema (12 tables)
`user_profiles`, `channels`, `ideas`, `scripts`, `scenes`, `assets`, `videos`, `publications`, `analytics`, `analytics_snapshots`, `jobs`, `daily_compute_spend`

### Planned Changes
- Add `users` table (or integrate with auth provider)
- Add `youtube_connections` table
- Change `tenant_id` → `user_id` FK on all models
- Add composite indexes
- Remove `create_all()` startup — Alembic-only

---

## MIGRATIONS

### Existing (6 migrations)
1. `61b87d7eb806` — Initial Neon PostgreSQL migration
2. `14c2e35df3a7` — Add Scene model
3. `1aa304cb059a` — Add tenant_id to all models
4. `7fc34cbfbd64` — Add render_stage to Video
5. `00378f081347` — Update Asset model for caching
6. `de47fccac0ec` — Lifecycle states

### Planned
- User model + FK migration
- YouTubeConnection model migration
- Index additions

---

## DEPLOYMENT STATUS

| Component | Status |
|---|---|
| Local development | ✅ Functional (single-user) |
| Docker Compose | ✅ Functional (includes unused Redis + n8n) |
| Render API | ⚠️ Partially configured (render.yaml exists, worker-in-API blocks rendering) |
| Render Frontend | ❌ Not configured |
| Neon PostgreSQL | ✅ Connected (in current .env) |
| Cloudflare R2 | ⚠️ Code exists, not tested |
| GitHub Actions Worker | ❌ Not implemented |
| Authentication | ❌ Not implemented |

---

## KNOWN ISSUES

1. **SECURITY:** `client_secret.json` committed with real Google OAuth credentials
2. **SECURITY:** CORS allows all origins
3. **SECURITY:** No authentication on any endpoint
4. **ARCHITECTURE:** Worker runs inside FastAPI process
5. **ARCHITECTURE:** Three overlapping worker/job systems
6. **DATA:** No tenant isolation — all users see all data
7. **DEPLOYMENT:** `create_all()` used instead of Alembic-only
8. **DEPLOYMENT:** Render would fail on video rendering (request timeout)

---

## TEST STATUS

### Existing Tests
| File | Purpose | Status |
|---|---|---|
| `tests/test_pipeline.py` | End-to-end pipeline test | Unknown |
| `tests/test_script_api.py` | Script API tests | Unknown |
| `tests/test_visual_router.py` | Visual routing tests | Unknown |
| `tests/test_worker.py` | Worker tests | Unknown |
| `tests/test_cloud_architecture.py` | Cloud architecture tests | Unknown |

Tests have not been run yet. They need to be validated before any code changes.

---

## CURRENT BLOCKER

Awaiting user approval on `docs/implementation/PLAN.md` before proceeding.

Key decisions needed:
1. Authentication provider (Supabase Auth recommended)
2. Custom domain availability
3. n8n usage (remove from default stack?)
4. ComfyUI placeholder (keep or remove?)

---

## EXACT NEXT STEPS

1. **Get user approval** on `docs/implementation/PLAN.md`
2. **Run existing tests** to establish baseline
3. **Phase 1:** Create `backend/core/config.py` with Pydantic Settings
4. **Phase 1:** Migrate all `os.getenv()` calls to centralized config
5. **Phase 1:** Add `APP_MODE`, `WORKER_BACKEND`, `STORAGE_BACKEND` config
6. **Phase 1:** Create `.env.local.example` and `.env.cloud.example`

---

## NEXT MODEL INSTRUCTION

> Read this file first, inspect the referenced files, verify the current state,
> then continue from the first incomplete step. Do not redo completed work.
>
> Start by reading:
> 1. `docs/implementation/HANDOFF.md` (this file)
> 2. `docs/implementation/PROGRESS.md`
> 3. `docs/implementation/PLAN.md`
> 4. `docs/implementation/DECISIONS.md`
> 5. `docs/architecture/CURRENT_STATE.md`
>
> Then inspect the files listed in "IMPORTANT FILES" above to verify the current state.
> Then continue from "EXACT NEXT STEPS".
