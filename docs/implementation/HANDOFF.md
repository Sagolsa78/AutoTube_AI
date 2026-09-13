# AutoTube AI — Handoff Document

## PROJECT GOAL
Transform AutoTube AI into a robust, secure, dual-mode (Local + Cloud Zero-Cost Beta) YouTube Shorts automation platform with decoupled workers, atomic job claiming, unified storage, multi-tenant security, encrypted YouTube credentials, and zero mock data.

---

## ACTUAL CURRENT ARCHITECTURE
1. **API / Control Plane**: FastAPI application with native JWT authentication, route-level tenant validation, and durable Job persistence before dispatch.
2. **Worker / Compute Plane**: Standalone worker process (`python -m backend.worker.main`) supporting continuous queue polling with atomic `SELECT ... FOR UPDATE SKIP LOCKED` and single-shot execution (`--job-id <ID>`).
3. **Execution Routing**: `JobExecutor` abstraction routing either to `LocalJobExecutor` (local standalone worker) or `GitHubActionsJobExecutor` (ephemeral cloud runner via `workflow_dispatch`).
4. **Rendering Service**: Dedicated `RenderService` (`backend/services/rendering_service.py`) with stage-by-stage progress tracking (`tts`, `visuals`, `assembly`, `metadata`, `done`) and try/finally workspace cleanup.
5. **Storage**: Protocol-based `StorageBackend` supporting `LocalStorageBackend` and `S3StorageBackend` (Cloudflare R2) with user-scoped object keys (`users/<user_id>/...`).
6. **Security & OAuth**: Fernet encryption for YouTube tokens at rest, short-lived authenticated video previews, and tenant isolation across all endpoints.

---

## TARGET ARCHITECTURE
The codebase supports ONE unified codebase with TWO execution modes:
- **Local Mode**: Browser -> React/Vite -> FastAPI -> SQLite/PostgreSQL -> LocalJobExecutor -> Standalone Local Worker -> RenderService -> LocalStorage.
- **Cloud Zero-Cost Beta Mode**: Browser -> Render Static Site -> Render Free Web Service -> Neon PostgreSQL -> GitHubActionsJobExecutor -> GitHub Actions Ephemeral Runner -> RenderService -> Cloudflare R2.

---

## COMPLETED WORK
- Full repository audit and documentation of current and target architecture.
- P0: Fixed Python dependency conflicts and requirements.
- P0: Replaced in-process FastAPI rendering with dedicated `RenderService` and decoupled `Worker`.
- P0: Replaced legacy route-level execution with unified `JobExecutor` architecture.
- P0: Fixed job creation order to commit durable `Job` records to DB before dispatch.
- P0: Implemented atomic job claiming (`SELECT FOR UPDATE SKIP LOCKED`) in worker.
- P0: Implemented single-shot execution mode for GitHub Actions ephemeral cloud workers.
- P0: Unified `StorageBackend` (`put_file`, `get_file`, `delete_file`, `exists`, `get_public_url`, `generate_signed_url`) and eliminated legacy mismatches.
- P0: Implemented unconditional temporary workspace cleanup in `try/finally` blocks.
- P0: Implemented native multi-user JWT authentication and eliminated hardcoded `default-user` fallbacks in cloud mode.
- P0: Enforced tenant isolation across all database queries and API endpoints.
- P0: Implemented Fernet symmetric encryption for YouTube OAuth tokens and removed global `token.json`.
- P0: Fixed video preview endpoint to authenticate access and prevent unauthorized cross-tenant viewing.
- P1: Centralized configuration in `backend/core/config.py` using Pydantic Settings.
- P1: Verified database schema matches Alembic migrations at head `16ee20e4233a`.
- P1: Full automated test suite passing (36/36 tests in `pytest`).
- P1: End-to-end verification script (`tests/verify_all.py`) passing all 5 stages.
- P1: Complete architecture, development, and deployment documentation written.

---

## PARTIALLY COMPLETED WORK
- None. All P0 and P1 items are implemented, verified, and documented.

---

## KNOWN FAILURES
- None. Full test suite passes cleanly.

---

## FILES OF INTEREST
- `backend/core/config.py`: Authoritative Pydantic Settings model.
- `backend/services/rendering_service.py`: Pipeline execution service.
- `backend/worker/main.py`: Standalone worker daemon & one-shot CLI.
- `backend/jobs/local_executor.py`: Local job executor.
- `backend/jobs/github_executor.py`: GitHub Actions workflow dispatcher.
- `backend/storage/base.py`: Abstract storage interface.
- `backend/storage/local.py` & `backend/storage/s3.py`: Local and R2 storage adapters.
- `backend/api/routes/videos.py`: Video rendering and preview endpoints.
- `backend/api/routes/auth.py`: JWT authentication routes.
- `integrations/youtube/uploader.py`: Multi-tenant YouTube upload client.
- `.github/workflows/video-worker.yml`: Ephemeral GitHub worker workflow.

---

## DATABASE STATE & MIGRATION STATE
- Current Alembic Revision: `16ee20e4233a` (head).
- Fully compatible with PostgreSQL (Neon) and SQLite.

---

## ENVIRONMENT STATE
- Configured via `.env` and loaded by `backend.core.config.settings`.

---

## DEPLOYMENT STATE
- Production topology: Render Static Site (Frontend) + Render Web Service (FastAPI) + Neon (PostgreSQL) + Cloudflare R2 (Storage) + GitHub Actions (Ephemeral Worker).

---

## TEST STATE
- `pytest -v`: 36 / 36 tests PASSING.
- `tests/verify_all.py`: 5 / 5 verification stages PASSING.

---

## CURRENT BLOCKER
- None.

---

## EXACT NEXT TASK
- Ready for live video creation in local mode or cloud deployment following `docs/deployment/DEPLOYMENT_CHECKLIST.md`.

---

## EXACT COMMANDS TO REPRODUCE CURRENT STATE
```bash
# Run the full automated test suite
/mnt/Drive_01/AutoTube_Ai/venv/bin/python3 -m pytest -v

# Run the end-to-end multi-step verification runner
PYTHONPATH=. /mnt/Drive_01/AutoTube_Ai/venv/bin/python3 tests/verify_all.py
```

---

## LAST VERIFIED COMMIT/STATE
- All tests passing, migrations at head `16ee20e4233a`.

NEXT AI: Read HANDOFF.md, PROGRESS.md and DECISIONS.md first. Verify the current state against the repository, then continue from CURRENT NEXT TASK. Do not redo completed work.
