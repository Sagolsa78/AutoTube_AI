# Architecture & Product Decisions

## ADR-001: Implement Phases 1–3 First Before Creation Studio Overhaul
- **Context**: The user and product roadmap require creating a solid creator operating system without breaking existing local/cloud backend integrations.
- **Decision**: Deliver Application Shell, persistent Channel Switcher, Global Header Job Center, and Dashboard Command Center (Phases 1–3) first. Stop for verification before touching the multi-stage Creation Studio.
- **Rationale**: Validates the shell, data fetching, multi-channel state, and live compute polling against real backend endpoints early, preventing large regressive rewrites.

## ADR-002: Centralized Job State Hook vs Component-Level Polling
- **Context**: Multiple components (TopBar, JobCenterWidget, Dashboard, JobDetail, Videos) previously polled independently or lacked real job list endpoints.
- **Decision**: Create a single shared `useJobs` hook with tab visibility throttling (`document.hidden`), automatic cancellation when idle, and notification dispatching upon completion.
- **Rationale**: Dramatically reduces backend load, ensures persistent synchronization across header and dashboard, and guarantees seamless browser refresh recovery.

## ADR-003: Backend API List Jobs Support
- **Context**: `backend/api/routes/jobs.py` supported individual job lookup and dispatch, but lacked `GET /api/jobs/` for listing tenant jobs.
- **Decision**: Add `GET /api/jobs/` scoped strictly to `current_user.id`, returning ordered historical and active compute jobs.
- **Rationale**: Enables the Global Job Center and operator diagnostics to inspect real compute records alongside video rendering states.
