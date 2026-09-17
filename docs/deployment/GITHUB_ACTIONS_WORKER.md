# GitHub Actions Ephemeral Cloud Worker

## 1. Workflow Architecture (`.github/workflows/video-worker.yml`)
When `WORKER_BACKEND=github_actions`, rendering jobs are submitted directly to GitHub Actions runners via `workflow_dispatch`.

```yaml
name: AutoTube Video Worker
on:
  workflow_dispatch:
    inputs:
      job_id:
        description: 'AutoTube Job UUID'
        required: true
      worker_git_ref:
        description: 'Git ref to checkout'
        required: false
        default: 'main'
```

---

## 2. GitHub Secrets Required
Add the following secrets to GitHub Repository Settings -> Secrets and variables -> Actions:

| Secret Name | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `ENCRYPTION_KEY` | Fernet 32-byte secret key |
| `S3_ENDPOINT_URL` | Cloudflare R2 endpoint |
| `S3_BUCKET_NAME` | Cloudflare R2 bucket name |
| `S3_ACCESS_KEY_ID` | Cloudflare R2 Access Key |
| `S3_SECRET_ACCESS_KEY` | Cloudflare R2 Secret Access Key |
| `GEMINI_API_KEY` | Google Gemini API Key |
| `PEXELS_API_KEY` | Pexels Stock Video API Key |

---

## 3. Worker Execution Flow on Runner
1. **Checkout Code**: `actions/checkout@v4` with `ref: ${{ inputs.worker_git_ref || 'main' }}`.
2. **Setup Python**: Python 3.12.
3. **Install FFmpeg**: `sudo apt-get update && sudo apt-get install -y ffmpeg`.
4. **Install Dependencies**: `pip install -r requirements.txt`.
5. **Run One-Shot Worker**:
   ```bash
   python -m backend.worker.main --job-id "${{ inputs.job_id }}"
   ```
6. **Output**: Assembled video is uploaded directly to Cloudflare R2, PostgreSQL status is updated to `ready`, and runner exits cleanly.

## 4. Backend GitHub token permissions

The backend calls the GitHub REST API endpoint
`POST /repos/{owner}/{repo}/actions/workflows/video-worker.yml/dispatches`.
`GITHUB_TOKEN` must be a classic PAT with the `workflow` scope, or a fine-grained
token with **Actions: Read and write** access to this repository. The API
returns HTTP 204 when the workflow has been accepted.
