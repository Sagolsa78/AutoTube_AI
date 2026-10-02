# AutoTube AI — Implementation Plan

> Last Updated: 2026-09-11  
> Status: **Phases 0-2 Complete. Ready for Phase 3**

---

## Goal

Transform AutoTube AI from a local-only, single-user video automation prototype into a production-grade dual-mode (local + cloud) application. The transformation prioritizes tenant isolation, separation of concerns (API vs. worker), robust multi-channel capabilities, and cloud deployments.

---

## Overall Implementation Order

This order is strictly enforced to build dependent systems linearly.

- **PHASE 0:** Audit + verification ✅
- **PHASE 1:** Backend/frontend contract matrix ✅
- **PHASE 2:** Fix backend security/integration blockers discovered by audit ✅
- **PHASE 3:** Channel/content-strategy data model ✅
- **PHASE 4:** API service + frontend data layer ✅
- **PHASE 5:** Authentication and route protection ✅
- **PHASE 6:** Global active-channel system ✅
- **PHASE 7:** Channel management UI ✅
- **PHASE 8:** Idea generation UI & pipeline integration ✅
- **PHASE 9:** Script editing UI (Studio) & real-time autosave ✅
- **PHASE 10:** Asset generation service & tracking ✅
- **PHASE 11:** Video rendering pipeline abstraction ✅
- **PHASE 12:** Local worker implementation ✅
- **PHASE 13:** Cloud worker (GitHub Actions) ✅
- **PHASE 14:** Storage abstraction (Local -> R2) ✅
- **PHASE 15:** Publishing UI & status monitoring ✅
- **PHASE 16:** YouTube integration (OAuth per-user + uploads) ✅
- **PHASE 17:** Analytics data model & tracking ✅
- **PHASE 18:** Dashboard & analytics UI ✅
- **PHASE 19:** Mobile responsiveness & PWA configuration ✅
- **PHASE 20:** Docker/Render cloud deployment configuration ✅
- **PHASE 21:** Testing, CI/CD, and monitoring ✅
- **PHASE 22:** Documentation + final verification ✅

---

## Detailed Phase Breakdown

### PHASE 0-2 (Completed)
- Completed full audit, fixed `DEFAULT_PROFILE_ID` vulnerability.
- Migrated global `os.getenv` to a unified `backend.core.config.settings` model.
- Eradicated hardcoded YouTube `token.json` configuration.
- Created Backend/Frontend Contract capability matrix.

### PHASE 3 — Channel/content-strategy data model
- Create/update `Channel` models to enforce `user_id` multi-tenancy.
- Support metadata for channel-specific niches, language, branding, and strategies.
- Create Alembic migrations for new schema definitions.

### PHASE 4 — API service + frontend data layer
- Refactor API routes to fully map to the capabilities identified in the contract matrix.
- Finish wiring up React Query / internal fetch wrappers on the frontend.
- Standardize all API error formats for clean frontend parsing.

### PHASE 5 — Authentication and route protection
- Wire up a real Auth system (e.g., Supabase JWT) in production mode.
- Add `Depends(get_current_user)` to all endpoints.
- Build frontend login flow that captures the JWT and protects internal `/app/*` routes.

### PHASE 6 — Global active-channel system
- Implement the "Global Workspace Switcher" logic.
- Ensure the selected channel ID persists and limits all data views (Ideas, Scripts, Videos).

### PHASE 7 — Channel management UI
- Implement CRUD UI for connecting channels, configuring niches, tone, and branding.

### PHASE 8 — Idea generation UI & pipeline integration
- Upgrade the Ideas UI to respect the active channel context.
- Polish generation mechanics and status badges.

### PHASE 9 — Script editing UI (Studio) & real-time autosave
- Overhaul the Studio layout with split panes (script left, visuals right).
- Implement background debounced autosaves.

### PHASE 10-14 — Pipeline, Workers, and Storage
- Separate FastAPI Control Plane from the rendering Compute Plane.
- Replace in-process asyncio task execution with a distinct Local Worker script.
- Build GitHub Actions YAML to run cloud jobs remotely.
- Implement Cloudflare R2 abstraction via `aioboto3`.

### PHASE 15-22 — Finalization
- Build out the YouTube OAuth per-user database flow.
- Add robust data visualization for metrics.
- Hardening, Docker Compose cleanup, and deployment to Render/Neon.
