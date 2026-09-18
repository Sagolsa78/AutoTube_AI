# AutoTube AI v2 Render Fix

## Fixed

1. Added the missing `GitHubActionsJobExecutor` implementation required by `worker_router.py` and `videos.py`.
2. Aligned GitHub configuration with the existing Render variables: `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_WORKFLOW_FILE`, `WORKER_GIT_REF`.
3. Defaulted the cloud worker ref to `v2` instead of `main`.
4. Accepted both current GitHub workflow-dispatch response modes (`200` with run details and `204` without details).
5. Persisted the DB job as `dispatched` only after GitHub accepts the workflow dispatch.
6. Created asset `Job` rows before dispatching so a fast GitHub runner cannot race the database insert.
7. Changed video dispatch failures to mark both `Job` and `Video` failed and return HTTP 502 instead of leaving the video stuck in `rendering`.
8. Aligned GitHub Actions Python with the backend Docker runtime at Python 3.11.
9. Made the patch installer self-contained; it no longer references `/mnt/data/...`.

## Required Render secret

`GITHUB_TOKEN` must be a GitHub token with repository Actions write permission.

## Required Render values

```text
WORKER_BACKEND=github_actions
GITHUB_REPO=Sagolsa78/AutoTube_AI
GITHUB_WORKFLOW_FILE=video-worker.yml
WORKER_GIT_REF=v2
```
