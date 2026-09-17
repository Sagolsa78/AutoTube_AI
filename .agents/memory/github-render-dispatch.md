---
name: GitHub render dispatch contract
description: Durable contract between the AutoTube control plane and its GitHub Actions render worker.
---

The control plane must persist a render job before dispatching it, send both the
job id and the worker git ref to the workflow-dispatch API, and treat GitHub's
HTTP 204 response as acceptance into the queued state.

**Why:** A missing executor or a mismatch between the API payload and workflow
inputs leaves videos stuck in rendering even though the UI submitted them.

**How to apply:** When changing `.github/workflows/video-worker.yml`,
`WORKER_GIT_REF`, or the render executor, update the dispatch URL, input names,
job state transitions, and checkout behavior together.