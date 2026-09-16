# Current State Architecture

## System Architecture
AutoTube AI currently operates as a multi-tenant web application.
- **Frontend**: React (Vite) single-page application using Tailwind CSS.
- **Backend**: FastAPI web application running in Python, utilizing asynchronous PostgreSQL (via SQLAlchemy/asyncpg).
- **Workers**: A mix of environments. There is an in-memory `WorkerRegistry` in the backend that decides where to route compute-heavy jobs (LLM, TTS, IMAGE, VIDEO, RENDER).
- **Storage**: Abstracted to support local disk or S3/Cloudflare R2 for storing video assets and rendered outputs.
- **Queueing/Eventing**: There is a mix of DB-backed polling and in-memory structures. The FastAPI backend holds an in-memory `self.job_queues` dictionary for routing to local workers, and publishes events to an `event_bus` (presumably Redis).

## Request Flow
1. User interacts with the React Frontend.
2. Requests hit the FastAPI Backend via standard REST JSON endpoints (e.g., `/api/videos/render`).
3. The API handles business logic, database mutations (via SQLAlchemy), and dispatches jobs to workers.

## Job & Rendering Flow
1. A render is triggered (`/api/videos/render`).
2. A `RenderJob` dataclass is constructed and serialized.
3. A `Job` record is created in PostgreSQL with `status='dispatching'`.
4. Based on the `WORKER_BACKEND` configuration, the backend uses either `GitHubActionsJobExecutor` (triggering `.github/workflows/video-worker.yml`) or a `LocalJobExecutor`.
5. The worker pulls the job ID, processes the render (TTS, visuals, assembly, metadata), and uploads artifacts.

## Current Technical Debt & Flaws
- **In-Memory Queueing**: `worker_router.py` maintains worker registries and job queues in memory. If the FastAPI process restarts, pending job queues and worker states are lost.
- **GitHub Actions as Render Queue**: GitHub Actions is actively being used to run production rendering workloads (`GitHubActionsJobExecutor`), violating the rule against using CI for heavy production rendering.
- **Mocked Local Worker**: The `worker_agent.py` file contains simulated ("mocked") execution handlers instead of full implementations.
- **State Machine Weakness**: Both `Video` and `Job` models have overlapping lifecycle statuses (`VideoStatus` vs `JobStatus`). There are no strict validations preventing illegal transitions (e.g., `completed` back to `queued`).
- **Coupling**: The FastAPI routes (e.g., `videos.py`) directly coordinate job construction, dispatching logic, and GitHub Action triggering.

## Security Risks
- Direct URL redirects are used for signed URLs, but some endpoints (`/preview`) have complex fallback mechanisms that guess storage paths.
- OAuth connections for YouTube (`YouTubeConnection`) are stored in the database but might lack proper application-level encryption at rest (relies on PostgreSQL security).

## Scalability Risks
- Relying on GitHub Actions for rendering is not horizontally scalable and violates GitHub's terms for heavy non-CI compute.
- The in-memory `WorkerRegistry` in `worker_router.py` prevents scaling the FastAPI backend to multiple workers/replicas (as they wouldn't share the same queue).
