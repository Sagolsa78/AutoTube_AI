# AutoTube AI — End-to-End Data Flow

## 1. Video Generation Pipeline Flow

```
1. Script & Story Creation
   User -> POST /api/scripts/generate -> AI Fallback Chain (Gemini/Groq/OpenRouter/Ollama)
   -> Script created in DB (status=draft) -> Scenes populated

2. Render Submission
   User -> POST /api/videos/render { script_id, style, caption_style, voice_override }
   -> Authenticated User verified
   -> Script & Channel ownership verified
   -> Video created (status=rendering, render_stage=queued, render_progress=0)
   -> Job created (id=UUID, capability="RENDER", status="dispatching", payload=RenderJobDict)
   -> DB Commit (Durable persistence guarantee)
   -> Executor.submit(job_id) dispatched:
        - Local mode: LocalJobExecutor marks job as 'queued'
        - Cloud mode: GitHubActionsJobExecutor triggers repository_dispatch / workflow_dispatch

3. Worker Execution
   Worker process loads Job from DB (Atomic SELECT FOR UPDATE SKIP LOCKED / get(Job, job_id))
   -> Worker marks Job status='running', started_at=NOW()
   -> Worker invokes RenderService.run_job(video_id, RenderJob)

4. RenderService Lifecycle
   a. Workspace Setup: /tmp/autotube/<job_id>/
   b. Stage 1 (TTS): generate_voiceover() -> audio/voice.mp3 + audio/subs.ass
      -> DB update: video.render_stage="tts", render_progress=10
   c. Stage 2 (Visuals): VisualRouter -> async_fetch_clips() or ComfyUI
      -> DB update: video.render_stage="visuals", render_progress=30..60
   d. Stage 3 (Assembly): async_assemble_job() -> FFmpeg 1080x1920 60fps MP4
      -> DB update: video.render_stage="assembly", render_progress=60
   e. Storage Upload: storage.put_file(local_mp4, "users/<user_id>/videos/<video_id>.mp4")
      -> Remote key stored in video.path
   f. Stage 4 (Metadata): AI metadata prompt generates title candidates, description, hashtags
      -> DB update: video.render_stage="metadata", render_progress=80
   g. Stage 5 (Done / Auto-Publish):
      - If channel.auto_approve=True: upload_video() to YouTube as private/live
      - Else: video.status=ready for user preview and approval
   h. Finally block: Workspace /tmp/autotube/<job_id>/ cleaned up unconditionally

5. User Preview & Publication
   User polls GET /api/videos/{id}/progress
   User watches preview via GET /api/videos/{id}/preview (Authenticated streaming / Signed URL)
   User clicks Approve -> PATCH /api/videos/{id}/approve -> YouTube status updated to public
```
