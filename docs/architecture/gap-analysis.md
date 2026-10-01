# Gap Analysis

## 1. Job State & Queueing
**Current State**: In-memory `WorkerRegistry` in `backend/worker_router.py`. Polling-based fallback (`WorkerAgent` polls HTTP). Job and Video statuses overlap confusingly. `Job` statuses aren't robustly guarded against invalid transitions.
**Target State**: Redis Streams for durable queueing. PostgreSQL for authoritative state. Dedicated background worker processes with explicit lease and heartbeat mechanisms. Unified job state machine.
**Gap**:
- We lack Redis queue implementation.
- We lack a unified, strict Job State Machine (Phase 1).
- We lack lease, heartbeat, and reaper systems (Phase 3).

## 2. Rendering Execution
**Current State**: GitHub Actions is being used as a production render worker (`GitHubActionsJobExecutor` calling `.github/workflows/video-worker.yml`). The local worker agent is stubbed (`worker_agent.py` returns mocked output).
**Target State**: Dedicated long-running worker processes consuming from Redis, executing FFmpeg properly, handling failures, and cleaning up.
**Gap**:
- Need to delete GitHub Actions rendering and build a proper `LocalJobExecutor`/Remote worker that consumes from Redis (Phase 2).
- Need a robust rendering domain (`RenderPlan`) that safely wraps FFmpeg (Phase 6).

## 3. Contracts and Abstractions
**Current State**: Passing JSON dicts loosely. API routes are tightly coupled with Job building. Provider calls might be scattered.
**Target State**: `ContentSpec` for pipeline definitions. Formal Provider interfaces (LLM, TTS, Image, Video) via dependency injection or configuration.
**Gap**:
- Define `ContentSpec` using Pydantic (Phase 4).
- Introduce formal Provider interfaces (Phase 5).

## 4. Pipeline Stages & Idempotency
**Current State**: Monolithic render process (TTS -> Visuals -> FFmpeg assembly). No fine-grained idempotency. If assembly fails, TTS might run again.
**Target State**: Split into distinct observable stages (Research, Script, Asset collection, Voice, Timeline, Render, QA, Upload, Publish) that are idempotent.
**Gap**:
- Refactor the monolith into pipeline stages with input/output schemas (Phase 8).
- Implement logical idempotency (Phase 3).

## 5. Artifacts and Storage
**Current State**: Video `path` fields are self-healed, loosely coupled strings.
**Target State**: First-class `Artifact` models tracking checksum, version, size, type.
**Gap**:
- Introduce `Artifact` database models and storage logic (Phase 7).

## 6. QA and Observability
**Current State**: Missing automated QA. Telemetry is basic.
**Target State**: Strict automated QA blocking bad renders. OpenTelemetry.
**Gap**:
- Build Video/Audio/Script QA checks (Phase 10).
- Integrate OpenTelemetry (Phase 14).

## 7. Security and Authorization
**Current State**: Basic dependency injection for auth (`get_current_user`). Some object retrieval doesn't strictly scope to user early enough or guesses storage paths.
**Target State**: Consistent authorization middleware.
**Gap**:
- BOLA/OWASP review and enforcement across all ID-based endpoints (Phase 15).
