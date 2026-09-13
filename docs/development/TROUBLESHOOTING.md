# Troubleshooting Guide

## Common Issues & Resolutions

### 1. Database Connection Errors on Startup
- **Symptom**: `OperationalError: connection refused` or `asyncpg.exceptions.InvalidPasswordError`.
- **Cause**: Invalid `DATABASE_URL` or database service not running.
- **Fix**: Verify `.env` has valid PostgreSQL or SQLite connection string. Ensure Neon database is active and not sleeping.

### 2. FFmpeg / ffprobe Missing
- **Symptom**: `RuntimeError: FFmpeg is not installed or not in PATH`.
- **Fix**: Install FFmpeg:
  - Ubuntu/Debian: `sudo apt-get install -y ffmpeg`
  - macOS: `brew install ffmpeg`

### 3. Video Stuck in `queued` or `rendering`
- **Symptom**: Progress stays at 0% or `queued`.
- **Cause**: Standalone worker daemon is not running.
- **Fix**: Start the worker process:
  ```bash
  python -m backend.worker.main
  ```

### 4. YouTube OAuth Token Expired
- **Symptom**: `VideoStatus.publish_failed` with message `OAuth Token Expired`.
- **Fix**: Reconnect YouTube channel in Dashboard -> Profile -> Connect YouTube.
