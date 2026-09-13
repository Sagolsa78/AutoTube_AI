# Local Worker Execution Guide

## Architecture
The local worker is a standalone Python daemon decoupled from the FastAPI web server.

## Execution Modes

### 1. Continuous Queue Polling (Daemon Mode)
```bash
python -m backend.worker.main
```
- Polls PostgreSQL / SQLite for jobs with `status IN ('queued', 'waiting_for_local_worker', 'dispatched')`.
- Claims jobs atomically using `SELECT ... FOR UPDATE SKIP LOCKED`.
- Executes `RenderService.run_job()` or `execute_asset_job()`.
- Runs a background watchdog recovering stale jobs after 15 minutes.
- Emits heartbeat pings to the API control plane.

### 2. Single-Shot Mode
```bash
python -m backend.worker.main --job-id <JOB_UUID>
```
- Fetches the specified `Job` by ID.
- Reconstructs `RenderJob` payload.
- Executes `RenderService.run_job()`.
- Updates Job status to `completed` or `failed`.
- Exits immediately with code 0 (success) or 1 (failure).
- This is the exact invocation used by the GitHub Actions ephemeral worker.
