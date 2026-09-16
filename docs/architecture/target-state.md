# Target State Architecture

## Concept
AutoTube AI will be a production-grade, cloud-native, multi-tenant AI content automation platform. It acts as an automated content operating system capable of researching topics, generating structured content, creating assets, rendering videos, performing QA, publishing to channels, and collecting analytics.

## Control Plane
- **Frontend**: Exposes Creator-facing concepts (Dashboard, Channels, Content Calendar, Studio, Jobs, Analytics) while hiding infrastructure complexity.
- **API**: FastAPI backend. Owns durable state. Handles authorization, rate limiting, provider routing, and job orchestration.
- **PostgreSQL**: The authoritative durable source of truth for all application and job state.
- **Redis**: Used *only* for queue/event transport, caching, ephemeral coordination, and worker communication. Must not be the single source of truth.
- **Object Storage**: Immutable storage for generated artifacts.

## Execution Plane
- **Dedicated Workers**: Long-running processes that consume work from Redis Streams. Horizontally scalable.
  - Research Workers
  - Script Workers
  - Asset Workers
  - Voice Workers
  - Render Workers
  - QA Workers
  - Publisher Workers
- **Worker Contract**: Register, heartbeat, claim work, renew lease, process, persist result, acknowledge message.

## Durable Job Model
- Strict separation between `JOB STATUS` (CREATED, QUEUED, CLAIMED, RUNNING, PAUSED, RETRYING, SUCCEEDED, FAILED, CANCELLED, DEAD_LETTER) and `PIPELINE STAGE` (RESEARCH, SCRIPT, ASSETS, VOICE, TIMELINE, RENDER, QA, UPLOAD, PUBLISH, ANALYTICS).
- Survives API restarts, worker restarts, duplicate deliveries, and process terminations.
- State-transition validation enforces legal state changes.
- Incorporates explicit leases, heartbeats, and reapers.

## Content & Contracts
- **ContentSpec**: A canonical, versioned, typed content representation used across the pipeline.
- **RenderPlan**: A clear rendering domain (Scene, Track, Asset, Transition) passed to the FFmpeg adapter.
- **Providers**: Config-driven, abstracted interfaces for LLM, TTS, Image, Video, and Publishing.

## Data & Analytics
- **Channel Domain**: Channels are first-class citizens with niche, audience, tone, schedule, and strategy.
- **Scheduler**: A durable component for timezone-aware, recurrent job creation.
- **Observability**: OpenTelemetry standard for correlating requests, jobs, and worker executions.
- **Cost Accounting**: Tracks provider operations, tokens, durations, and estimates cost per job/video.
