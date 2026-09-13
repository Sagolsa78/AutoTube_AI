# AutoTube AI — Job Execution Architecture

## 1. Authoritative Job Model
All asynchronous workloads (video rendering, image generation, visual fetching) are tracked as durable `Job` records in PostgreSQL/SQLite.

### Schema Fields
- `id` (String UUID / Primary Key)
- `user_id` (String / Foreign key to User)
- `capability` (`RENDER`, `IMAGE`, `VIDEO`, `TTS`, `LLM`)
- `status` (`queued`, `dispatching`, `waiting_for_local_worker`, `dispatched`, `running`, `completed`, `failed`, `cancelled`)
- `payload` (JSON Dictionary with fully self-contained parameters)
- `worker_id` (Identifier of executing worker)
- `worker_type` (`local`, `github_actions`, `cloud_gpu`)
- `cost_usd` (Float)
- `started_at` / `completed_at` (Timestamps)
- `error_message` (String)

---

## 2. Job Creation Order & Atomicity Invariant
```
[User Request]
       │
       ▼
1. Authenticate & validate ownership
2. Create Video row
3. Create Job row (status='dispatching', payload=RenderJob)
4. COMMIT TO DATABASE (Ensures DB durability before external dispatch)
5. Call Executor.submit(job_id)
6. Return HTTP 202 Accepted
```

If the executor submission fails, the job status is marked `failed` with `error_message` containing the failure detail, preventing silent crashes.

---

## 3. Executors

### LocalJobExecutor (`backend/jobs/local_executor.py`)
- Sets Job status to `queued`.
- Handled asynchronously by the separate standalone worker process (`python -m backend.worker.main`).

### GitHubActionsJobExecutor (`backend/jobs/github_executor.py`)
- Calls GitHub REST API `POST /repos/{owner}/{repo}/actions/workflows/video-worker.yml/dispatches`.
- Passes inputs: `job_id`, `worker_git_ref`, `app_env`.
- Spawns an ephemeral GitHub-hosted runner with 16GB RAM, dual-core CPU, and pre-installed FFmpeg.

---

## 4. Atomic Job Claiming
In multi-worker environments, workers prevent race conditions via atomic claim:
```sql
SELECT id FROM jobs
WHERE status IN ('queued', 'waiting_for_local_worker', 'dispatched')
AND capability IN ('RENDER', 'IMAGE', 'VIDEO')
ORDER BY created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;

UPDATE jobs SET status = 'running', started_at = NOW() WHERE id = :job_id;
```
For SQLite development, a transactional fallback is used.
