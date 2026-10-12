# Changelog

## Phase 1: Design Tokens & Global Shell (feat/product-redesign)

### What Changed
- **Design System Tokens**: Replaced arbitrary colors in `index.css` with a strict set of tokens (`--bg-0`, `--bg-1`, `--brand`, `--ai-start`, etc.) matching the requested "pro creative tool" aesthetic (calm, dense, high-contrast, non-pure black).
- **Component CSS variables**: Updated `AppShell`, `TopBar`, and generic CSS classes to use the new tokens.
- **Global Shell Navigation (`AppShell.jsx`)**:
  - Moved the Channel (Workspace) Switcher out of the Sidebar.
  - Placed the Channel Switcher in the `TopBar.jsx` as a dropdown menu.
  - Consolidated the system health indicator: `JobCenterDropdown` now independently checks `/health` via `api.getSystemHealth()` every 15s and manages its own state instead of relying on contradictory sidebar props.
  - Sidebar now acts purely as navigation.
- **Routing & Dead Links**:
  - Removed non-existent paths under the "Assets" (Library, Templates) category in `navConfig.js`.
  - Implemented a real `NotFound.jsx` component and wired it to a catch-all route (`*`) in `App.jsx` to prevent users from hitting blank pages on dead links.

### What Was Removed and Why
- **Duplicate Health Indicators**: Removed contradictory health checks in `AppShell` in favor of a single unified check in `JobCenterDropdown`.
- **`assets` Nav Config**: Removed `Library` and `Templates` routes from the sidebar since they had no backend implementation or frontend routes, eliminating dead UI elements.
- **Redundant Props**: Removed `engineStatus` and `isEngineOnline` props from `JobCenterDropdown` to make it a self-contained health polling component.

### Environment Variables Needed
None new for this phase.

### Risky or Unfinished Items
- **Browser Verification Failed**: The automated browser agent was unable to load due to a missing upstream Playwright driver. I could not visually verify the layout, the collapsible sidebar tooltips, or capture screenshots of the dashboard.
