# AutoTube AI — Implementation Plan

> Created: 2026-09-11  
> Status: **Phase 0 Complete — Awaiting Approval for Phase 1**

---

## Goal

Transform AutoTube AI from a local-only, single-user video automation prototype into a production-grade dual-mode (local + cloud) application with:

- Proper authentication and multi-tenant isolation
- Separated API and worker processes
- Cloud storage (Cloudflare R2)
- Cloud worker execution (GitHub Actions)
- Zero-cost public beta deployment (Render + Neon + R2 + GitHub Actions)
- Clean abstractions enabling future migration to paid GPU workers

---

## User Review Required

> [!IMPORTANT]
> **Authentication Provider Choice:** The plan proposes Supabase Auth for the free tier (50K MAU free, JWT-based, works with both React and FastAPI). Alternative options: Auth0 (limited free tier), Clerk (more expensive), or custom JWT with email/password. Please confirm preference.

> [!IMPORTANT]
> **YouTube OAuth Redesign:** Currently uses a global `token.json` (pickle file). The plan proposes per-user encrypted credentials stored in PostgreSQL with a server-side OAuth callback endpoint. This means users will need to re-authenticate YouTube when switching to the new system.

> [!WARNING]
> **`client_secret.json` is committed to your repository** with real Google OAuth credentials (client ID: `953432166943-...`, client secret: `GOCSPX-...`). This should be rotated immediately in the Google Cloud Console and removed from git history.

> [!WARNING]
> **`.env` contains real credentials** committed or accessible — Neon PostgreSQL connection string and Pexels API key. Ensure `.env` is in `.gitignore` (it is) and these credentials haven't been pushed to a public branch.

---

## Open Questions

> [!IMPORTANT]
> 1. **Auth Provider:** Supabase Auth (recommended, free), Auth0, Clerk, or custom JWT?
> 2. **Domain:** Do you have a custom domain for the cloud deployment, or should we use Render's default `*.onrender.com`?
> 3. **YouTube OAuth:** Are you okay with users needing to re-authenticate YouTube connections after the migration?
> 4. **n8n:** The current `docker-compose.yml` includes n8n. Is this actively used, or can it be removed from the default stack?
> 5. **ComfyUI:** The ComfyUI integration is stubbed (`NotImplementedError`). Should it remain as a placeholder, or be removed to reduce complexity?
> 6. **Worker Agent (`worker_agent.py`):** This standalone daemon exists but doesn't actually render. Should it be preserved as the basis for the local worker, or replaced entirely?

---

## Proposed Changes

### Phase 1 — Configuration System

#### [NEW] `backend/core/__init__.py`
Empty init file for the core package.

#### [NEW] `backend/core/config.py`
Pydantic Settings-based centralized configuration replacing scattered `os.getenv()` calls.

Key variables:
- `APP_MODE`: `local` | `cloud`
- `DATABASE_URL`: SQLite (local) or PostgreSQL (cloud)
- `STORAGE_BACKEND`: `local` | `s3` | `r2`
- `WORKER_BACKEND`: `local` | `github_actions`
- All AI provider keys
- All stock footage keys
- YouTube OAuth config
- CORS origins (environment-driven)
- Rate limiting config

Validates required variables at startup. Fails fast with clear error messages.

#### [MODIFY] `backend/settings.py`
Deprecated in favor of `backend/core/config.py`. Import bridge for backward compatibility during migration.

#### [MODIFY] `backend/main.py`
- Replace `from backend.settings import ...` with config import
- Replace `allow_origins=["*"]` with environment-driven origins
- Remove `start_worker()` from lifespan (Phase 4)

#### [NEW] `.env.local.example`
Template for local development profile.

#### [NEW] `.env.cloud.example`
Template for cloud deployment profile.

---

### Phase 2 — Database & Migrations

#### [MODIFY] `backend/db/database.py`
- Remove `create_all()` from `init_db()`
- Add connection pool configuration for PostgreSQL
- Add startup connectivity validation
- Add graceful shutdown

#### [MODIFY] `backend/models/models.py`
- Add `User` model (or integrate with auth provider's user)
- Change `tenant_id` to `user_id` with proper FK to User
- Add `YouTubeConnection` model for per-user OAuth
- Add `NOT NULL` constraints where appropriate
- Add composite indexes for `(user_id, status)` queries

#### [NEW] `migrations/versions/xxx_add_user_model.py`
Alembic migration for User model and FK changes.

#### [MODIFY] `alembic.ini`
Remove hardcoded placeholder URL.

#### [MODIFY] `migrations/env.py`
Ensure it reads from new config system.

---

### Phase 3 — Storage Abstraction

#### [NEW] `backend/storage/__init__.py`
Package init with factory function.

#### [NEW] `backend/storage/base.py`
`StorageBackend` Protocol/ABC defining:
- `put_file(local_path, remote_key) → url`
- `get_file(remote_key, local_path) → local_path`
- `delete_file(remote_key) → bool`
- `exists(remote_key) → bool`
- `generate_download_url(remote_key, expires) → url`
- `generate_upload_url(remote_key, expires) → url`

#### [NEW] `backend/storage/local.py`
`LocalStorageBackend` — file operations on local disk.

#### [NEW] `backend/storage/s3.py`
`S3StorageBackend` — R2/S3-compatible implementation using `aioboto3`.

#### [DELETE] `backend/cloud_storage.py`
Replaced by the new storage package.

#### [MODIFY] `backend/api/routes/videos.py`
Use storage abstraction instead of direct `cloud_storage.storage` import.

---

### Phase 4 — Worker Separation

#### [NEW] `backend/jobs/__init__.py`
Job system package.

#### [NEW] `backend/jobs/executor.py`
`JobExecutor` Protocol:
- `submit(job_id) → ExecutionHandle`
- `cancel(job_id) → None`
- `status(job_id) → JobExecutionStatus`

#### [NEW] `backend/jobs/local_executor.py`
`LocalJobExecutor` — submits job to separate local worker process via DB state.

#### [NEW] `backend/jobs/github_executor.py`
`GitHubActionsJobExecutor` — triggers `workflow_dispatch` via GitHub API.

#### [NEW] `backend/worker/__init__.py`
Worker package.

#### [NEW] `backend/worker/main.py`
Standalone worker entry point: `python -m backend.worker`
- Polls DB for pending jobs
- Executes rendering pipeline
- Updates job status
- Handles graceful shutdown

#### [MODIFY] `backend/main.py`
Remove `from backend.worker import start_worker` and `start_worker()` from lifespan.

#### [DELETE] `backend/worker.py`
Replaced by `backend/worker/main.py`.

#### [MODIFY] `worker_agent.py`
Either integrate into `backend/worker/main.py` or keep as a separate remote worker agent.

---

### Phase 5 — Cloud Worker (GitHub Actions)

#### [NEW] `.github/workflows/video-worker.yml`
GitHub Actions workflow:
- Triggered by `workflow_dispatch` with `job_id` input
- Sets up Python + FFmpeg
- Runs `python -m backend.worker --job-id $JOB_ID`
- Uses GitHub Secrets for DB, R2, AI keys
- Job-oriented: one workflow run = one video

#### [MODIFY] `backend/jobs/github_executor.py`
Implement actual GitHub API `workflow_dispatch` trigger.

---

### Phase 6 — Authentication + Tenant Isolation

#### [NEW] `backend/auth/__init__.py`
Auth package.

#### [NEW] `backend/auth/provider.py`
Auth provider abstraction — supports Supabase JWT verification, future providers.

#### [NEW] `backend/auth/dependencies.py`
FastAPI dependencies: `get_current_user()`, `require_auth()`.

#### [MODIFY] All API routes
- Add `user = Depends(get_current_user)` to every endpoint
- Filter queries by `user_id`
- Replace `DEFAULT_PROFILE_ID` with authenticated `user.id`

#### [MODIFY] `backend/security.py`
Integrate with new auth system or deprecate.

---

### Phase 7 — YouTube OAuth Redesign

#### [NEW] `backend/api/routes/youtube.py`
New router for YouTube OAuth:
- `GET /api/youtube/auth-url` — generate OAuth URL
- `GET /api/youtube/callback` — handle OAuth callback
- `GET /api/youtube/connections` — list user's connections
- `DELETE /api/youtube/connections/{id}` — disconnect
- `POST /api/youtube/connections/{id}/refresh` — refresh token

#### [MODIFY] `backend/models/models.py`
Add `YouTubeConnection` model with encrypted credentials.

#### [MODIFY] `integrations/youtube/uploader.py`
Accept credentials parameter instead of reading global `token.json`.

---

### Phase 8 — Frontend Cloud Compatibility

#### [MODIFY] `frontend/src/services/api.js`
- Ensure `VITE_API_URL` works for cloud (already partially done)
- Add auth token injection
- Add error handling for cloud-specific errors

#### [MODIFY] `frontend/vite.config.js`
Environment-driven API proxy.

#### [MODIFY] Frontend pages
- Job progress persists across refresh (already backed by DB)
- Add login/registration UI
- Add YouTube connection management UI
- Handle auth errors gracefully

---

### Phase 9 — Docker & Deployment

#### [MODIFY] `Dockerfile`
Rename or keep for API service. Ensure it does NOT start the worker.

#### [NEW] `worker.Dockerfile`
Separate Dockerfile for the worker with FFmpeg.

#### [MODIFY] `docker-compose.yml`
- Separate `api` and `worker` services
- Remove n8n (unless actively used)
- Remove Redis (not needed for MVP)
- Add health checks

#### [MODIFY] `render.yaml`
- API service only (no rendering)
- Frontend static site
- Environment variables for cloud profile

#### [NEW] `docs/deployment/DEPLOYMENT_CHECKLIST.md`

---

### Phase 10 — Testing & Hardening

#### [NEW/MODIFY] `tests/`
- `test_config.py` — configuration validation
- `test_storage.py` — storage backend tests
- `test_jobs.py` — job lifecycle, idempotency
- `test_auth.py` — authentication, tenant isolation
- `test_api.py` — endpoint tests with auth
- Update existing tests for new architecture

---

### Phase 11 — Documentation

#### [NEW] Full `docs/` structure
As specified in the requirements (architecture, development, deployment, operations, implementation docs).

---

## Verification Plan

### Automated Tests
```bash
# Unit tests
pytest tests/ -v

# Config validation
pytest tests/test_config.py -v

# Storage tests (local + mocked S3)
pytest tests/test_storage.py -v

# Job system tests
pytest tests/test_jobs.py -v

# API tests with auth
pytest tests/test_api.py -v
```

### Manual Verification
- Local: `docker compose up` → full pipeline works
- Cloud: Deploy to Render → API responds → Create job → GitHub Actions runs → R2 upload → job completes
- Auth: Login → create channel → generate video → only see own data
- YouTube: OAuth flow → callback → token stored → upload works
- Failure: Kill worker mid-render → job marked failed → retry works
