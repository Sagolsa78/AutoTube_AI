# AutoTube Frontend Audit

## 1. Data Integrity and State Synchronization
**Root Cause:**
Currently, each view (Dashboard, Ideas, Scripts, Content Library) makes independent API calls for its data (`api.getIdeas`, `api.getScripts`, etc.) and performs localized status filtering. `Dashboard.jsx` fetches data directly and sets its own `metrics` state, which often conflicts with the numbers shown on individual list pages.
**Fix (Phase 1):**
Create shared data fetching hooks (using Zustand, React Context, or a query layer like SWR/React Query if available, or just centralizing in `useStudioStore`) for `ideas`, `scripts`, `videos`, and `publications`. Ensure a single source of truth for statuses (`draft`, `rendering`, `failed`, `review`, `scheduled`, `published`).

## 2. Content Library Infinite Loading
**Root Cause:**
The `Content.jsx` (which handles `/app/videos`) does fetch data inside a `useEffect` with a `finally { setLoading(false) }` block. However, if the API call hangs indefinitely due to network or backend latency, there's no UI timeout. Alternatively, an unhandled exception before the `try` block or an issue with how `activeChannelId` resolves from context could prevent the effect from finishing or executing properly. The empty state also does not handle the "failed to load" scenario properly.
**Fix (Phase 1):**
Add proper error state tracking (`error`, `setError`), a retry mechanism, and display an explicit error/empty state instead of leaving the loading skeleton/spinner up. Ensure a timeout is enforced on the fetch.

## 3. "Needs your attention" Widget Inaccuracies
**Root Cause:**
The `Dashboard.jsx` calculates "Review" items as `videos.filter(v => ['ready', 'failed'].includes(v.status))`. This conflates `failed` videos with `ready` (awaiting review) videos. Furthermore, it assumes "all caught up" if that combined count is 0, completely ignoring missing YouTube connections.
**Fix (Phase 1):**
Separate `failed` from `ready` (review). Update the widget logic to surface failed renders, pending reviews, and disconnected platforms separately.

## 4. Default "Untitled Project" Titles
**Root Cause:**
The backend might not be setting a title on videos automatically, or the frontend mapping is missing. The frontend defaults to `video.title || 'Untitled Project'`.
**Fix (Phase 1):**
Derive the title dynamically from the associated `script` or `idea` if `video.title` is falsy. Format as `Untitled · {date}` if completely unnamable, and support inline renaming.

## 5. Broken Icons ("?")
**Root Cause:**
The `Icon.jsx` component likely uses dynamic string matching to render `lucide-react` icons (e.g. `const IconComponent = Icons[name]`). If the exact export name has changed in newer versions of Lucide (e.g. `check-circle` vs `CheckCircle`), it falls back to a default `?` component silently. It's also missing brand icons (YouTube, etc.).
**Fix (Phase 2):**
Rebuild `Icon.jsx` with an explicit mapping dictionary. Add a strict fallback with `console.error` and include SVG primitives for social brand icons.

## 6. Fragmented Layout and Navigation
**Root Cause:**
Navigation routes are hardcoded in multiple places (`AppShell.jsx`, `TopBar.jsx`, `CommandPalette.jsx`). Active states do not match because they depend on exact URL string matches instead of route patterns.
**Fix (Phase 2):**
Centralize route definitions. Merge identical configuration panels and standardize page headers using a generic `PageHeader` layout component.

## 7. Create Wizard State
**Root Cause:**
The `ScriptView` and `OutputView` have been partially implemented but lack the full integration of features (like inline editing, step validation, and real preview panels).
**Fix (Phase 4):**
Overhaul the `Create Wizard` per the specifications, ensuring the 5-step flow maintains context and communicates directly with the APIs.

## Missing Backend Capabilities (Potential Gaps)
- Inline renaming of Videos: Need to verify if `PATCH /videos/{id}` supports `title` updates.
- Real views/likes on published content: May require an endpoint to sync latest analytics from YouTube API.
