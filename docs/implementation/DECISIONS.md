# AutoTube AI — Architectural Decision Records

> Last Updated: 2026-09-11

This document tracks all significant architectural decisions made during the transformation to a production-grade dual-mode architecture.

---

## ADR-001: Separation of API and Worker Processes

**Date:** 2026-09-11  
**Status:** Accepted  
**Phase:** 4

### Context
The current prototype runs the video rendering worker (`backend/worker.py`) inside the FastAPI application process using `asyncio.create_task()`. 

### Problem
Cloud hosting providers (like Render) have strict request timeout limits (e.g., 30-100 seconds) for web services. Video rendering (TTS + Visuals + FFmpeg assembly) takes several minutes. The platform kills the web process before rendering can complete.

### Decision
We will completely separate the Control Plane (FastAPI web server) from the Compute Plane (worker). 
- The API will simply create a `Job` or `Video` record with `status=queued` and return immediately.
- A separate standalone worker process will poll the database (or queue), claim the job, process it, and upload the result.

### Consequences
- **Positive:** API response times remain fast. Render timeouts are avoided. Cloud scaling becomes possible.
- **Negative:** Increased deployment complexity (need to run two separate processes).

---

## ADR-002: Cloudflare R2 for Asset Storage

**Date:** 2026-09-11  
**Status:** Accepted  
**Phase:** 3

### Context
The current app writes audio, visuals, and rendered videos directly to local disk (`storage/`).

### Problem
Cloud application containers (like Render web services) have ephemeral filesystems. Any files written to disk are lost when the container restarts or redeploys. Renders must be persistent and served to users.

### Decision
We will implement an S3-compatible storage abstraction and use Cloudflare R2 as the primary cloud storage backend. 

### Consequences
- **Positive:** Zero egress fees (crucial for video platforms). Persistent storage. High availability.
- **Negative:** Requires R2 configuration. Requires signed URLs for secure access to private assets.

---

## ADR-003: GitHub Actions for Cloud Rendering Workloads

**Date:** 2026-09-11  
**Status:** Accepted  
**Phase:** 5

### Context
The project requires a "zero/near-zero-cost public beta deployment architecture" with an easy migration path to paid CPU/GPU workers later.

### Problem
Always-on worker instances on Render, AWS, or RunPod cost money, even when idle. For a public beta with unpredictable usage, this is financially risky.

### Decision
We will use GitHub Actions as the cloud worker execution engine for the public beta. The API will trigger a `workflow_dispatch` event on a GitHub repository for every video render job. The GitHub Action runner (which is free for public repos or has generous free minutes for private repos) will execute the worker script, upload to R2, and update the database.

### Consequences
- **Positive:** Zero idle cost. Automatic scaling (GitHub provides many concurrent runners). Free compute (up to 2000 mins/month for private repos, unlimited for public).
- **Negative:** Startup latency (10-30 seconds to provision a runner). Maximum execution time limits (though 6 hours is plenty for shorts). Requires managing secrets in GitHub Actions.

---

## ADR-004: Centralized Configuration Management

**Date:** 2026-09-11  
**Status:** Accepted  
**Phase:** 1

### Context
Configuration is currently managed via scattered `os.getenv()` calls in `backend/settings.py` and other files.

### Problem
No validation of required environment variables. Silent failures when keys are missing. Hard to know exactly what env vars are needed for a specific deployment mode (local vs. cloud).

### Decision
We will migrate to `pydantic-settings`. We will define a clear `Settings` class that validates all inputs on startup and fails fast if required credentials (like DB URLs or API keys) are missing.

### Consequences
- **Positive:** Type safety, validation, auto-generated `.env.example`, clear failure modes.
- **Negative:** Minor refactoring required across the codebase to use `config.settings` instead of `backend.settings`.

---

## ADR-005: PostgreSQL for Cloud, SQLite for Local

**Date:** 2026-09-11  
**Status:** Accepted  
**Phase:** 2

### Context
The app uses SQLAlchemy 2.0 with async engine support.

### Problem
We need a robust database for the cloud (PostgreSQL on Neon) but want to retain the simplicity of a local file (SQLite) for desktop development and local execution.

### Decision
We will design all models and migrations to be compatible with both PostgreSQL and SQLite. We will not use Postgres-specific features (like `JSONB` or `UUID` native types) unless absolutely necessary, opting for SQLAlchemy abstractions (`JSON`, `String`) that work on both.

### Consequences
- **Positive:** Developer experience remains frictionless for local usage. Cloud deployment is robust and concurrent.
- **Negative:** Cannot use advanced PostgreSQL features. Must be careful with Alembic migrations to ensure they apply cleanly to both dialects.
