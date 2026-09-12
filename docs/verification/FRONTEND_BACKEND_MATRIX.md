# AutoTube AI — Frontend/Backend Capability Matrix

This document maps all available backend capabilities to the current frontend consumption, highlighting missing endpoints and discrepancies.

## Authentication & User Profile
| Endpoint | Method | Required Auth | Resource Ownership | Frontend Consumer | Status |
|----------|--------|---------------|--------------------|-------------------|--------|
| `/api/profile/` | GET | Yes | User Profile | `api.getProfile` | Active |
| `/api/profile/` | PATCH | Yes | User Profile | `api.updateProfile` | Active |
| `/api/profile/logo` | POST | Yes | User Profile | `api.uploadLogo` | Active |
| `/api/profile/logo` | DELETE | Yes | User Profile | `api.deleteLogo` | Active |
| `/api/profile/caption-styles` | GET | No | System List | `api.getCaptionStyles` | Active |

## Channels
| Endpoint | Method | Required Auth | Resource Ownership | Frontend Consumer | Status |
|----------|--------|---------------|--------------------|-------------------|--------|
| `/api/channels/` | GET | Yes | User Channels | `api.getChannels` | Active |
| `/api/channels/` | POST | Yes | User Channels | `api.createChannel` | Active |
| `/api/channels/{id}` | GET | Yes | User Channel | **Missing** | Needs UI |
| `/api/channels/{id}` | PATCH | Yes | User Channel | **Missing** | Needs UI |
| `/api/channels/{id}` | DELETE | Yes | User Channel | **Missing** | Needs UI |

## Ideas & Generation
| Endpoint | Method | Required Auth | Resource Ownership | Frontend Consumer | Status |
|----------|--------|---------------|--------------------|-------------------|--------|
| `/api/ideas/` | GET | Yes | User Ideas | `api.getIdeas` | Active |
| `/api/ideas/generate` | POST | Yes | User Ideas (via Channel) | `api.generateIdeas` | Active |
| `/api/ideas/{id}/discard` | POST | Yes | User Idea | `api.discardIdea` | Active |

## Scripts
| Endpoint | Method | Required Auth | Resource Ownership | Frontend Consumer | Status |
|----------|--------|---------------|--------------------|-------------------|--------|
| `/api/scripts/` | GET | Yes | User Scripts | `api.getScripts` | Active |
| `/api/scripts/generate/{idea_id}` | POST | Yes | User Script | `api.generateScript`| Active |
| `/api/scripts/{id}` | GET | Yes | User Script | `api.getScript` | Active |
| `/api/scripts/{id}` | PATCH | Yes | User Script | `api.updateScript` | Active |
| `/api/scripts/{id}/regenerate`| POST | Yes | User Script | `api.regenerateScript`| Active |
| `/api/scripts/{id}/discard` | POST | Yes | User Script | `api.discardScript` | Active |

## Assets & Scenes
| Endpoint | Method | Required Auth | Resource Ownership | Frontend Consumer | Status |
|----------|--------|---------------|--------------------|-------------------|--------|
| `/api/assets/search` | GET | Yes | User Assets | `api.searchAssets` | Active |
| `/api/assets/scenes/{id}/assign`| POST | Yes | User Scene | `api.assignAssetToScene`| Active |

## Videos & Rendering
| Endpoint | Method | Required Auth | Resource Ownership | Frontend Consumer | Status |
|----------|--------|---------------|--------------------|-------------------|--------|
| `/api/videos/` | GET | Yes | User Videos | `api.getVideos` | Active |
| `/api/videos/{id}` | GET | Yes | User Video | `api.getVideo` | Active |
| `/api/videos/{id}` | PATCH | Yes | User Video | `api.updateVideo` | Active |
| `/api/videos/{id}/preview` | GET | Yes | User Video | **Missing** | Needs UI |
| `/api/videos/{id}/progress` | GET | Yes | User Video | `api.getVideoProgress`| Active |
| `/api/videos/render` | POST | Yes | User Video | `api.renderVideo` | Active |
| `/api/videos/{id}/approve` | PATCH | Yes | User Video | `api.approveVideo` | Active |
| `/api/videos/{id}/reject` | PATCH | Yes | User Video | `api.rejectVideo` | Active |
| `/api/videos/{id}/upload` | POST | Yes | User Video | `api.uploadVideo` | Active |
| `/api/videos/{id}/cancel` | POST | Yes | User Video | `api.cancelVideo` | Active |
| `/api/videos/{id}/pause` | POST | Yes | User Video | `api.pauseVideo` | Active |
| `/api/videos/{id}/resume` | POST | Yes | User Video | `api.resumeVideo` | Active |

## Jobs & Compute
| Endpoint | Method | Required Auth | Resource Ownership | Frontend Consumer | Status |
|----------|--------|---------------|--------------------|-------------------|--------|
| `/api/jobs/` | POST | Yes | User Jobs | **Missing** | Needs UI |
| `/api/jobs/telemetry` | GET | Yes | System / Admin | `api.getComputeTelemetry`| Active |
| `/api/jobs/{id}` | GET | Yes | User Job | **Missing** | Needs UI |
| `/api/jobs/{id}/cancel` | POST | Yes | User Job | **Missing** | Needs UI |
| `/api/jobs/worker/heartbeat` | POST | API Key | Worker Node | N/A | Worker-only |
| `/api/jobs/worker/poll` | GET | API Key | Worker Node | N/A | Worker-only |
| `/api/jobs/{id}/complete` | POST | API Key | Worker Node | N/A | Worker-only |
| `/api/jobs/{id}/fail` | POST | API Key | Worker Node | N/A | Worker-only |

## YouTube Integration
| Endpoint | Method | Required Auth | Resource Ownership | Frontend Consumer | Status |
|----------|--------|---------------|--------------------|-------------------|--------|
| `/api/youtube/auth` | GET | Yes | User Auth Config | `api.getYoutubeAuthUrl`| Active |
| `/api/youtube/callback` | GET | Yes | User Auth Config | **Missing** | Backend Redir |
| `/api/youtube/status` | GET | Yes | User Auth Config | `api.getYoutubeStatus`| Active |
| `/api/youtube/disconnect` | DELETE | Yes | User Auth Config | `api.disconnectYoutube`| Active |

## Analytics
| Endpoint | Method | Required Auth | Resource Ownership | Frontend Consumer | Status |
|----------|--------|---------------|--------------------|-------------------|--------|
| `/api/analytics/` | GET | Yes | User Analytics | `api.getDashboardAnalytics`| Active |
| `/api/analytics/cleanup` | POST | Yes | Admin / User | `api.analyticsCleanup`| Active |
| `/api/analytics/logs` | GET | Yes | Admin | `api.getSystemLogs` | Active |

## Summary of Missing Frontend Endpoints
- **Channels**: `getChannel(id)`, `updateChannel(id)`, `deleteChannel(id)`
- **Videos**: `previewVideo(id)`
- **Jobs**: `createJob`, `getJob(id)`, `cancelJob(id)` (Compute tracking UI)
