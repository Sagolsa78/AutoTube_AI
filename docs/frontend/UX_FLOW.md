# AutoTube AI — Creator UX Flow & User Journeys

This document models the core workflows and interaction patterns across the AutoTube AI studio.

---

## 1. Flow 1: New User Onboarding & Channel Setup

```mermaid
sequenceDiagram
    autonumber
    actor Creator
    participant Frontend as AutoTube Frontend
    participant Backend as AutoTube API
    participant DB as PostgreSQL
    
    Creator->>Frontend: Register / Login (/register)
    Frontend->>Backend: POST /api/auth/register
    Backend->>DB: Create User + Default Channel
    Backend-->>Frontend: Auth Token + User Profile
    Frontend->>Frontend: Redirect to /app (Dashboard)
    Frontend->>Frontend: Render 5-Step Guided Setup Card
    Note over Frontend: 1. Account (Done)<br/>2. Connect YouTube / Channel<br/>3. Choose Niche<br/>4. Create First Short<br/>5. Publish & Track
```

---

## 2. Flow 2: Daily Creator Command Center Triage

```mermaid
graph TD
    A[Open Dashboard /app] --> B{Any In-Flight Renders?}
    B -->|Yes| C[View Live Progress in Active Pipeline Bar & Job Center]
    B -->|No| D{Any Action Items in Queue?}
    D -->|Ready Videos| E[Click 'Review Video' -> Play Preview -> Approve/Publish]
    D -->|Pending Ideas| F[Click 'View Ideas' -> Select Winner -> Generate Script]
    D -->|Approved Scripts| G[Click 'Open Scripts' -> Review Scene Prompts -> Render]
    D -->|Queue Empty| H[Click '+ Create Video' to launch Creation Studio]
```

---

## 3. Flow 3: Long-Running Render & Durable Job Tracking

```mermaid
sequenceDiagram
    autonumber
    actor Creator
    participant Studio as Creation Studio
    participant API as Backend Control Plane
    participant Worker as Compute Worker (Local/Cloud)
    participant Header as Global Job Center
    
    Creator->>Studio: Click "Generate Video"
    Studio->>API: POST /api/videos/render
    API->>API: Create Video + Job in DB
    API-->>Studio: Video (status: rendering, stage: queued)
    Header->>Header: Badge Updates (Jobs: 1)
    Header->>API: Poll /api/videos/{id}/progress & /api/jobs
    Worker->>API: Report Stage: tts (15%) -> visuals (40%) -> assembly (65%)
    Header->>Header: Update Live Progress Bar
    Worker->>API: Report Stage: done (100%)
    Header->>Header: Toast notification: "Your Short has finished rendering!"
    Creator->>Header: Click Job Card -> Navigates to Video Review
```
