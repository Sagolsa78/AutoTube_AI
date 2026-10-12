# AutoTube.AI Frontend & Backend Audit

## 1. Backend Endpoints (Live)

| Method | Path | Summary / Description |
|---|---|---|
| GET | `/` | Root |
| GET | `/health` | Health Check |
| POST | `/api/auth/register` | Register User |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get Current User |
| GET | `/api/auth/models` | List Available Models |
| PATCH | `/api/auth/ai-settings` | Update AI Settings |
| GET | `/api/profile/` | Get Profile |
| PATCH | `/api/profile/` | Update Profile |
| POST | `/api/profile/logo` | Upload Logo |
| DELETE | `/api/profile/logo` | Delete Logo |
| GET | `/api/profile/caption-styles` | Get Caption Styles |
| GET | `/api/channels/` | List Channels |
| POST | `/api/channels/` | Create Channel |
| GET | `/api/channels/{channel_id}` | Get Channel |
| PATCH | `/api/channels/{channel_id}` | Update Channel |
| DELETE | `/api/channels/{channel_id}` | Delete Channel |
| GET | `/api/ideas/` | List Ideas |
| POST | `/api/ideas/` | Create Idea |
| POST | `/api/ideas/generate` | Generate Ideas |
| POST | `/api/ideas/{idea_id}/discard` | Discard Idea |
| GET | `/api/ideas/recommend-next` | Recommend Next Idea |
| POST | `/api/ideas/{idea_id}/dismiss` | Dismiss Idea |
| POST | `/api/ideas/improve` | Improve Idea |
| POST | `/api/ideas/{idea_id}/hooks` | Generate Idea Hooks |
| GET | `/api/scripts/` | List Scripts |
| POST | `/api/scripts/generate/{idea_id}` | Generate Script For Idea |
| GET | `/api/scripts/{script_id}` | Get Script |
| PATCH | `/api/scripts/{script_id}` | Update Script |
| POST | `/api/scripts/{script_id}/regenerate` | Regenerate Script |
| POST | `/api/scripts/{script_id}/discard` | Discard Script |
| GET | `/api/videos/` | List Videos |
| GET | `/api/videos/{video_id}/progress` | Get Render Progress |
| POST | `/api/videos/render` | Render Video |
| GET | `/api/videos/{video_id}` | Get Video |
| PATCH | `/api/videos/{video_id}` | Update Video |
| POST | `/api/videos/{video_id}/generate-metadata` | Generate Metadata |
| GET | `/api/videos/{video_id}/preview` | Preview Video |
| GET | `/api/videos/{video_id}/preview-url` | Get Preview Url |
| GET | `/api/videos/{video_id}/download` | Download Video |
| PATCH | `/api/videos/{video_id}/approve` | Approve Video |
| PATCH | `/api/videos/{video_id}/reject` | Reject Video |
| POST | `/api/videos/{video_id}/upload` | Upload Video |
| POST | `/api/videos/{video_id}/cancel` | Cancel Video |
| POST | `/api/videos/{video_id}/pause` | Pause Video |
| POST | `/api/videos/{video_id}/resume` | Resume Video |
| GET | `/api/assets/search` | Search Assets |
| POST | `/api/assets/scenes/{scene_id}/assign` | Assign Asset To Scene |
| POST | `/api/assets/generate` | Generate Asset |
| GET | `/api/analytics/` | Get Dashboard Analytics |
| GET | `/api/analytics/summary/top-videos` | Get Top Videos |
| POST | `/api/analytics/cleanup` | Cleanup Storage |
| GET | `/api/analytics/logs` | Get System Logs |
| POST | `/api/jobs/` | Create Job |
| GET | `/api/jobs/` | List Jobs |
| GET | `/api/jobs/telemetry` | Get Telemetry |
| GET | `/api/jobs/{job_id}` | Get Job Status |
| POST | `/api/jobs/{job_id}/cancel` | Cancel Job |
| POST | `/api/jobs/worker/heartbeat` | Worker Heartbeat |
| GET | `/api/jobs/worker/poll` | Worker Poll |
| POST | `/api/jobs/{job_id}/complete` | Complete Job |
| POST | `/api/jobs/{job_id}/fail` | Fail Job |
| POST | `/api/youtube/upload-secrets` | Upload Client Secrets |
| GET | `/api/youtube/auth` | Youtube Auth Url |
| GET | `/api/youtube/callback` | Youtube Auth Callback |
| GET | `/api/youtube/config-status` | Youtube Config Status |
| GET | `/api/youtube/status` | Youtube Status |
| POST | `/api/youtube/refresh` | Refresh Youtube Token |
| DELETE | `/api/youtube/disconnect` | Disconnect Youtube |
| GET | `/api/voices/` | List Voices |
| GET | `/api/voices/preview/{voice_id}` | Preview Voice |
| GET | `/api/costs/summary` | Get Cost Summary |
| GET | `/api/costs/jobs/{job_id}` | Get Job Costs |
| GET | `/api/system/health/` | Get System Health |
| GET | `/api/system/runtime` | Get Runtime Diagnostics |
| POST | `/api/system/youtube-config` | Update Youtube Config |
| GET | `/api/integrations/{platform}/connect` | Connect Platform |
| GET | `/api/integrations/{platform}/callback` | Callback Platform |
| GET | `/api/integrations/{platform}/status` | Status Platform |
| POST | `/api/integrations/{platform}/disconnect` | Disconnect Platform |
| GET | `/api/calendar/` | Get Calendar |
| POST | `/api/calendar/schedule` | Schedule Video |
| POST | `/api/publishing/compose` | Universal Publish |

## 2. Frontend Calls & UI Mapping

| UI Element / Feature | Mapped Endpoint / Call | Status |
|---|---|---|
| Dashboard: Workspace Switcher | None (currently hardcoded as "crazy01") | **BROKEN / DEAD** |
| Dashboard: Health Indicators | Disconnected / Contradictory | **BROKEN** |
| Dashboard: Sidebar Routes (Assets, Templates) | Non-existent frontend routes | **DEAD** |
| Dashboard: Performance Metrics | Hardcoded "0 views" vs "44 Published" | **MOCK** |
| Dashboard: Recommended Ideas | None | **MISSING** |
| Dashboard: Upcoming Pipeline | Contradictory data source vs. pipeline | **MOCK / BROKEN** |
| Studio (App/Create): Autosave | Client-side fake timeouts (`setTimeout`) | **MOCK** |
| Studio (App/Create): Stepper State | Local state only, disconnected from project ID | **BROKEN** |
| Step 1: Idea (Recent Ideas) | Hardcoded generic strings | **MOCK** |
| Step 1: Idea (Copilot) | Hardcoded cards / Unavailable | **MOCK / DEAD** |
| Step 2: Script (Suggestion) | Hardcoded "In a world where AI..." | **MOCK** |
| Step 2: Script (Quality Score) | Locked / Hardcoded | **MOCK / DEAD** |
| Step 2: Script (Timing) | Fake 5s per scene | **MOCK** |
| Step 3: Voice (List & Preview) | No play button, hardcoded data, wrong lang | **MOCK** |
| Step 3: Voice (Controls) | Locked ElevenLabs UI with different backend | **MOCK / DEAD** |
| Step 3: Voice (Sample Generation) | Quotes that aren't the script | **MOCK** |
| Step 3: Voice (Quality Analysis) | Hardcoded numbers (92, 97, 84) | **MOCK** |
| Step 4: Storyboard (Assets) | Random stock faces, not query-related | **MOCK** |
| Step 4: Storyboard (Actions) | Dead buttons for "Generate Visual", "Regenerate" | **DEAD** |
| Step 4: Storyboard (Timeline) | Fake V1-V5 visualization | **MOCK** |
| Step 5: Output (Render States) | Mismatch (0% vs Missing Assets), Fake Render pipeline | **MOCK / BROKEN** |
| Step 5: Output (Quality Score) | Hardcoded "40" | **MOCK** |
| Step 5: Output (Preview Phone) | Empty frame | **MOCK** |

## 3. Hardcoded, Placeholders, and Fake Data (Grep Audit)

*   `setTimeout` Fake Loaders in Frontend:
    *   `BriefView.jsx`: UI delays (`setTimeout` for 1000ms, 800ms).
    *   `ScriptView.jsx`: Save states simulated (`setTimeout(..., 1200)`, `setTimeout(..., 2000)`).
    *   `VoiceView.jsx`: Generation delays (`setTimeout(..., 1500)`, `setTimeout(..., 2000)`).
    *   `OutputView.jsx`: Rendering simulation (`setTimeout` inside rendering pipeline UI).
    *   `CommandPalette.jsx`: Focus delay.
    *   `Register.jsx`: Navigation delay.
*   Hardcoded / Placeholder Data:
    *   Brief / Script Views: Hardcoded prompt suggestions ("E.g., A video explaining why time behaves differently...", "Cinematic pan over a glowing nebula...").
    *   Output View: "Fake logic for the rendering pipeline UI".
    *   Dashboard: Fake channel / user data ("crazy01").
    *   Landing / Profile Views: "Phone Mockup", "Subtle video mock frame", "Three-Pane Studio Mockup", "Video Poster Placeholder".

## 4. Fix List Ordered by Severity

**Severity: Critical (Blocks Core Flow)**
1.  **Project State & Stepper (`/app/create`)**: Move from fake client-side stepping to a persistent server-side `ProjectPipelineState`. Implement real URL routing (`/app/create/:projectId/:step`).
2.  **Output / Render Flow (`Step 5`)**: Eliminate the contradictory two-state UI. Tie it to real render jobs (`/api/videos/render`, `/api/videos/{video_id}/progress`). Add the primary "Render video" button with a real checklist.
3.  **Voice Provider Integrity (`Step 3`)**: Drop the mock "Voice Quality Analysis" and locked ElevenLabs controls. Add a real play button that streams an audio sample. Connect generation to actual scripts.
4.  **Storyboard Canvas & Timeline (`Step 4`)**: Replace fake stock faces with actual asset searches/generation. Connect the timeline to real media so the user can preview Audio + Visuals together.

**Severity: High (Data Integrity & Missing Features)**
5.  **Dashboard Analytics & Pipeline Data**: Remove all hardcoded "0 views" or "Nothing scheduled" modules. Pull from `/api/analytics` and YouTube APIs.
6.  **Script Editor (`Step 2`)**: Remove hardcoded "In a world where..." suggestions. Implement contextual Copilot using the LLM backend endpoints. Correct scene timing calculations based on actual audio duration (feed back from Step 3).
7.  **Idea Auto-Pilot (`Step 1`)**: Make the Auto-Pilot actually run the entire pipeline through the backend job queue with live SSE/WebSocket progress, rather than being a fake button.

**Severity: Medium (UX & Polish)**
8.  **Global Shell Navigation**: Move the workspace switcher to the navbar. Fix the "Offline System Status" vs "Healthy" contradiction by implementing a unified health indicator via `/api/system/health/`.
9.  **Dead Links & 404s**: Remove or wire up sidebar links under Assets and Integrations. Add a proper 404 page.
10. **Design System Consolidation**: Implement the requested dark theme tokens (`--bg-0`, `--bg-1`, etc.) and typography (Inter + JetBrains Mono) across all `ui/` components, removing ad-hoc hardcoded colors.

## 5. AI Architecture & Prompt Audit

### C. LLM Call Sites
*   `engine/visuals/intelligence.py` (3 calls via `generate_with_fallback`)
*   `engine/story/planner.py` (1 call via `generate_with_fallback`)
*   `engine/research/verifier.py` (1 call via `generate_with_fallback`)
*   `engine/quality/relevance_guard.py` (1 call via `generate_with_fallback`)
*   `engine/script/agentic_generator.py` (4 calls via `generate_with_fallback`)
*   `backend/services/rendering_service.py` (2 calls via `generate_with_fallback`)
*   `backend/services/content_intelligence.py` (1 call via `generate_with_fallback`)
*   `backend/api/routes/ideas.py` (2 calls via `generate_with_fallback`)

### D. Prompt Locations
*   `backend/api/routes/ideas.py`: Hardcoded strings for ideas generation & hooks.
*   `backend/services/content_intelligence.py`: Hardcoded system prompt for content signals.
*   `backend/services/rendering_service.py`: Hardcoded SEO generation prompt.
*   `engine/visuals/intelligence.py`: Hardcoded prompt strings.
*   `engine/story/planner.py`: Hardcoded prompt strings.
*   `engine/research/verifier.py`: Hardcoded prompt strings.
*   `engine/quality/relevance_guard.py`: Hardcoded prompt strings.
*   `engine/script/agentic_generator.py`: Hardcoded prompts for script generation/refinement.

### E. Provider/Model Per Operation
*   Currently hardcoded fallback sequence via `generate_with_fallback` in `integrations.providers.ai_providers.py`.
*   Providers: Ollama, Gemini, Groq, OpenRouter.
*   Models are hardcoded in the providers (e.g., `gemini-3.5-flash-lite`, `llama-3.3-70b-versatile`, `deepseek-r1:free`).
*   There is no task-specific model routing.

### F. Structured-Output Status
*   **STATUS: NONE.** The codebase relies on raw string formatting and regex/JSON parsing (e.g., finding `{` and `}`).
*   No `with_structured_output` usage found anywhere.
*   No Pydantic schemas enforced at the LLM provider boundary.

### N. Incomplete Integrations
*   **LangChain / LangGraph:** Absent from actual execution flows. No `ChatPromptTemplate` usage.
*   **Providers:** Direct HTTP calls or generic provider clients are used.
*   **Publishing Providers:** YouTube placeholder integrations observed, missing robust error handling.

### O. Overall Assessment Severity
*   **P0 (Critical Blocker):** AI output parsing relies on regex. Must replace with `with_structured_output` and Pydantic schemas.
*   **P0 (Critical Blocker):** Prompts are scattered. Need a centralized `backend/ai/prompts` registry.
*   **P1:** Model routing is static. Needs dynamic selection based on task (Fast vs. Reasoning).
*   **P1:** LangGraph workflows need to be implemented for stateful retries instead of linear execution.
