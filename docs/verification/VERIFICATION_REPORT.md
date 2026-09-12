# AutoTube AI — Full Verification Report

> **Date**: 2026-09-11
> **Phase**: 0
> **Scope**: Backend, Frontend, Infrastructure, and Security

## CURRENT STATE

The codebase has undergone a recent migration to implement multi-tenancy, database-backed jobs, and worker separation (including GitHub Actions). However, many "legacy" single-user assumptions remain tightly coupled, especially in the frontend and development authentication mechanisms.

---

### Backend Auth & Tenant Isolation: **PARTIAL**
- **Evidence**: `backend/auth/provider.py` can decode JWTs and verify static API keys. Endpoints like `videos.py` and `profile.py` now use `user = Depends(get_current_user)`.
- **Failures**: 
  - `DEFAULT_PROFILE_ID = "default-user"` is still hardcoded in `backend/models/models.py` and `videos.py`.
  - `get_current_user` falls back to provisioning a `"default-user"` if `AUTH_DISABLED` is true, bypassing real auth for local dev.
  - Queries in some routes filter by `user.id`, but there are gaps where `tenant_id` might have been assumed in the past.

### Frontend/Backend Integration: **FAIL**
- **Evidence**: The frontend passes a Bearer token from `localStorage` in `frontend/src/services/api.js`.
- **Failures**: 
  - There is no real login flow providing this token. 
  - The UI hardcodes assumptions like `channels[0]?.id` (e.g., in `frontend/src/pages/Ideas.jsx`), breaking if a user has 0 channels or breaking multi-channel support.
  - VITE_API URL fallbacks still rely on empty strings or `localhost` patterns.

### Worker Separation & Execution: **PARTIAL**
- **Evidence**: `backend/worker/main.py` is present and handles both local polling and single-shot execution (`--job-id`). A `.github/workflows/video-worker.yml` exists.
- **Failures**: 
  - It relies on `backend.services.rendering_service` which assumes `render_job` executes synchronously within the worker process. The worker decoupling is structurally there but not yet fully stress-tested against long-running FFmpeg.

### YouTube Integration: **FAIL**
- **Evidence**: `token.json` is still hardcoded in `backend/settings.py` for YouTube OAuth.
- **Failures**: This is per-machine, not per-user, breaking multi-tenant YouTube uploads. The `YouTubeConnection` model exists but is not replacing `token.json` functionally.

### Storage Abstraction: **PARTIAL**
- **Evidence**: `backend/cloud_storage.py` and `storage/` directory exist. S3/R2 settings are in config.
- **Failures**: The code still heavily relies on local temporary paths and default local storage for intermediate assets.

## SUMMARY

| Category | Status | Notes |
|----------|--------|-------|
| Authentication | PARTIAL | JWT provider exists but `default-user` is still active. |
| Tenant Isolation | PARTIAL | Database schema is updated, but API queries and fallback logic bypass it. |
| Channel Ownership | FAIL | Frontend uses `channels[0]`. |
| YouTube OAuth | FAIL | Still uses global `token.json`. |
| Worker Execution | PASS | Separated into `backend/worker/main.py` and GitHub Actions. |
| Storage | PARTIAL | R2 capable, but local paths dominate pipeline. |
