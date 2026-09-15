# AutoTube AI — Frontend Architecture & Component Hierarchy

## 1. Core Principles

AutoTube AI is designed as a **YouTube Content Operating System** for creators. The mental model follows:
`IDEA → SCRIPT → VOICE → VISUALS → RENDER → REVIEW → PUBLISH → ANALYZE`

Key architectural tenets:
1. **Single Source of Truth**: All job progress, render states, metrics, and channel configuration originate from the PostgreSQL backend.
2. **Resilient Centralized Polling**: A single shared polling hook/service manages in-flight jobs, respects page visibility, and halts when all jobs reach terminal states (`completed`, `failed`, `cancelled`).
3. **Multi-Tenant Context**: Active channel and user session govern all data fetching requests automatically via `ChannelContext` and auth interceptors.
4. **Adaptive Responsive Design**: Fluid grid layouts on large screens (1440px+ / 1024px) that degrade gracefully into mobile bottom navigation and side-drawers on `< 768px`.

---

## 2. Component Hierarchy

```
App
├── Toaster (Sonner)
├── ErrorBoundary
└── Router
    ├── Landing (/)
    ├── Login (/login)
    ├── Register (/register)
    └── ProtectedRoute (/app/*)
        └── ChannelProvider
            └── AppShell (Sidebar + Header + MobileNav + JobCenterWidget)
                ├── Dashboard (/app)
                │   ├── Header + Time Greeting + Create CTA
                │   ├── KPI Stat Cards
                │   ├── Active Pipeline Progress
                │   ├── Action Required Queue
                │   └── Performance & Telemetry Cards
                ├── Studio (/app/create)
                │   └── StudioShell (Brief → Editor → Render)
                ├── Ideas (/app/ideas)
                ├── Scripts (/app/scripts)
                ├── Videos (/app/videos)
                ├── JobDetail (/app/jobs/:id)
                ├── Publications (/app/publications)
                ├── Analytics (/app/analytics)
                ├── Channels (/app/channels)
                ├── Logs (/app/logs)
                ├── Health (/app/health)
                └── Profile / Settings (/app/profile)
```

---

## 3. Global State & Contexts

- **`ChannelContext`**: Holds `channels`, `activeChannelId`, `activeChannel`, and `setActiveChannelId`. Persists active channel ID in `localStorage` (`autotube_active_channel`).
- **`useJobs` Hook**: Singleton-style hook polling `/api/jobs` and `/api/videos` for active rendering tasks, exposing active job count, stage tags, and progress to TopBar and Dashboard.
- **`api.js`**: Axios/Fetch abstraction with automatic bearer injection, 401 handling, structured error parsing, and timeout controls.
