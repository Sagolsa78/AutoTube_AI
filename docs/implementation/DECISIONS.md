# AutoTube AI — Architectural Decisions

## 1. Local vs Cloud Configuration
- **Decision**: Single centralized `Settings` class in `backend/core/config.py` using Pydantic Settings with validated aliases.
- **Rationale**: Eliminates configuration drift between local `.env` and production environment variables on Render and GitHub Actions.

## 2. Storage Abstraction
- **Decision**: Formal `StorageBackend` abstract protocol in `backend/storage/base.py` with `LocalStorageBackend` and `S3StorageBackend` (Cloudflare R2).
- **Rationale**: Enables zero-code-change switching between local filesystem and S3/R2 cloud storage while strictly enforcing user-partitioned keys (`users/<user_id>/...`).

## 3. PostgreSQL as Durable Job Source
- **Decision**: All compute requests are written to the `jobs` table in PostgreSQL before dispatching to any executor.
- **Rationale**: Eliminates race conditions, allows frontend progress polling, enables crash recovery, and provides persistent audit trails.

## 4. GitHub Actions as $0 Cloud Execution Layer
- **Decision**: Use GitHub-hosted runners via `workflow_dispatch` instead of paid GPU VMs or Render background workers for the beta release.
- **Rationale**: Render's free tier has a 30-second request timeout and no background worker instances on the free plan. GitHub Actions provides 2,000 free minutes/month on ephemeral runners with full FFmpeg support.

## 5. Standalone Local Worker Process
- **Decision**: Local rendering runs in a separate process (`python -m backend.worker.main`) rather than inside FastAPI's event loop.
- **Rationale**: Prevents CPU-bound FFmpeg / TTS execution from blocking API request handling.

## 6. Authentication & Token Encryption
- **Decision**: Native JWT token issuance with HMAC-SHA256 and Fernet symmetric encryption for stored YouTube OAuth tokens.
- **Rationale**: Secures multi-tenant operations without relying on hardcoded defaults (`default-user` or `token.json`).
