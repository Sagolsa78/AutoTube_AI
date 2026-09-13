# Runtime Failure Analysis & Taxonomy

## Architecture Execution Trace

### 1. How rendering is currently triggered
Rendering is triggered via the `POST /videos/render` API endpoint (`backend/api/routes/videos.py`). It builds the `RenderJob` and calls `dispatch_job` via the `backend.worker_router`.

### 2. Which worker is selected
The `backend.worker_router` determines if a local worker is online. If so, the job is added to the database with `status="queued"` for the local worker to pick up. If no local worker is online, it may dispatch to GitHub Actions. However, currently, the FastAPI route has a problematic "Inline fallback" that directly executes `asyncio.create_task(_inline_render(...))` if `route_meta["status"] == "waiting_for_local_worker"`.

### 3. Where jobs are stored
Jobs are stored in the PostgreSQL database in the `jobs` table (model `Job`). Video states are stored in the `videos` table.

### 4. How the worker obtains them
The worker (`backend/worker/main.py`) runs an infinite loop `poll_jobs()` which polls the database for oldest jobs with `status IN ('queued', 'waiting_for_local_worker', 'dispatched')`.

### 5. How rendering starts
The worker invokes `backend.services.rendering_service.run_job`. The first action is creating a workspace inside `/tmp/autotube/<video_id>`. (This is problematic since jobs should be scoped to `job_id`, not `video_id`).

### 6. Where TTS occurs
TTS runs via `generate_voiceover` in `engine/tts/voiceover.py`. It uses `edge-tts`. The generated audio and subtitle file are saved to the workspace.

### 7. Where assets are downloaded
Assets are resolved via `VisualRouter` which relies on `async_fetch_clips` or `async_download_clip` from `engine/visuals/fetcher.py`. They are downloaded sequentially and stored in the workspace.

### 8. Where FFmpeg starts
FFmpeg is invoked via `assemble_job` -> `assemble_video` in `engine/rendering/assembler.py`. The `_build_filtergraph` creates the FFmpeg string.

### 9. Where output is stored
FFmpeg writes the output MP4 to the temp workspace. Then `storage.put_file` is called to upload it to the cloud (e.g., S3/R2). If it fails, the application silently falls back to keeping the video pointing to the temporary workspace file.

### 10. How the frontend receives status
The frontend uses the `GET /videos/{video_id}/progress` endpoint to poll the rendering progress.

### 11. Why requests can hang
In `api.js`, the `request` wrapper queries `supabase.auth.getSession()` unconditionally before every API request, causing a network chain delay. Additionally, the dashboard frontend uses `Promise.all` for critical and non-critical data. If the `getComputeTelemetry()` request (or another optional one) times out, the dashboard spins forever. There's no timeout handled within the frontend's fetch wrapper.

### 12. What causes jobs to remain stuck
- **Crash:** If the worker process dies midway, the database job remains in the `running` state forever. There is no lease expiry or watchdog heartbeat.
- **Frontend polling:** Frontend continues to poll the job blindly. Since the worker crashed, the progress is stuck at a certain percentage (e.g. 40%).
- **Creation race condition:** `videos.py` calls `dispatch_job` before committing the `DBJob` to the DB. If `dispatch_job` triggers the worker too fast, the worker might not find the job.

---

## Failure Taxonomy

| FAILURE | ROOT CAUSE | CURRENT BEHAVIOR | EXPECTED BEHAVIOR | FIX | TEST |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TTS failure** | `edge-tts` fails to respond or network issue. | Raises exception, crashes render, returns 500 or fails job silently. | Fail stage clearly, worker continues to handle failure. | Implement timeout/retry for TTS generation. | Test TTS timeout simulated delay. |
| **Missing word boundaries** | `edge-tts` responds with sentence boundaries. | Subtitle generation crashes in `assembler.py` (`_validate_subtitle_content`). | Degrade gracefully to sentence-level or no-caption fallback. | Add fallback strategies for missing boundaries. | Test TTS returning 0 word boundaries. |
| **Subtitle failure** | Scripts too short for >3 dialogue lines. | `_validate_subtitle_content` throws ValueError for <3 lines. | Valid short scripts succeed. | Make dialogue threshold proportional to script length. | Test 1-line script rendering. |
| **Missing/corrupt asset** | Stock provider returns 0 bytes or errors. | Pipeline continues, then FFmpeg fails because file is invalid. | Reject asset, retry/fallback, fail cleanly if exhausted. | Validate file size, ffprobe dimensions/duration post-download. | Test corrupt downloaded asset. |
| **Download timeout** | `requests.get(..., stream=True)` stalls. | Waits forever or 60s timeout causes render crash. | Retry download with exponential backoff. | Add connection/read timeout & retries in `fetcher.py`. | Simulate network timeout on Pexels. |
| **GPU encoder unavailable** | NVENC requested but driver missing or Docker lacks GPU. | `subprocess.run` fails when `h264_nvenc` fails test, falls back but inline code hardcodes NVENC in old versions. | Auto-detect capability and fallback to CPU without failure. | Build robust encoder selection logic (`VIDEO_ENCODER=auto`). | Test render on CPU-only runner. |
| **R2 upload failure** | Cloud storage bucket unreachable. | `video.path` falls back to `/tmp/...` but job marked "success". | Fail the job if cloud upload is required. | Make storage failure fatal in cloud environments. | Simulate R2 credential error. |
| **Dispatch race** | Dispatched before Job committed. | Worker might query for job and find nothing, exiting. | Worker finds job properly. | Wrap in single SQL transaction or commit before dispatch. | Stress test job creation. |
| **Worker crash/timeout** | Worker dies unexpectedly. | Job permanently stuck in `running` state. | Watchdog marks job as stale/failed. | Add worker heartbeat/lease tracking mechanism. | Kill worker midway, verify recovery. |
| **Request hangs** | Fetch lacks `AbortController`. | Indefinite UI spinner if network drops. | Timeout thrown after N seconds. | Add AbortController and configurable timeouts in `api.js`. | Add artificial delay to API, check UI. |
| **Auth session hangs** | `getSession()` called on every request. | UI stalls waiting for auth network request. | Fast token read from cache. | Use cached token/auth subscriber in `api.js`. | Monitor network tab for redundant requests. |
| **Dashboard infinite load** | `Promise.all` includes optional telemetry. | Dashboard blank if telemetry fails. | Dashboard loads critical data, ignores telemetry failure. | Use `Promise.allSettled` for optional metrics. | Break telemetry endpoint, dashboard loads. |
| **Stuck job UX** | Job hasn't advanced for minutes. | Infinite spinner on frontend. | Show "Render stalled" prompt. | Add idle timeout check in frontend polling. | Mock stuck progress, verify UI change. |
