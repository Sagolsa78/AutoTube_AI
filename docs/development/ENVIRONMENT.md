# Environment Variables Reference

| Variable | Type | Default | Description |
|---|---|---|---|
| `APP_ENV` | `development` / `production` / `test` | `development` | Application environment mode |
| `APP_MODE` | `local` / `cloud` | `local` | Execution mode topology |
| `DATABASE_URL` | String | `sqlite+aiosqlite:///./storage/autoshorts.db` | Async database connection URL |
| `DB_POOL_SIZE` | Integer | `5` | PostgreSQL async connection pool size |
| `DB_MAX_OVERFLOW` | Integer | `10` | PostgreSQL async pool overflow connection count |
| `STORAGE_BACKEND` | `local` / `s3` / `r2` | `local` | Storage provider backend |
| `STORAGE_ROOT` | String | `storage` | Local directory for file storage |
| `S3_ENDPOINT_URL` | String | `None` | Cloudflare R2 or S3 API endpoint URL |
| `S3_BUCKET_NAME` | String | `autoshorts-assets` | Target bucket name |
| `S3_ACCESS_KEY_ID` | String | `None` | R2/S3 API Access Key ID |
| `S3_SECRET_ACCESS_KEY` | String | `None` | R2/S3 API Secret Access Key |
| `WORKER_BACKEND` | `local` / `github_actions` | `local` | Background worker dispatcher target |
| `GITHUB_TOKEN` | String | `None` | Personal Access Token with repo/workflow dispatch permissions |
| `GITHUB_REPO` | String | `Sagolsa78/AutoTube_AI` | GitHub owner/repo for workflow dispatches |
| `WORKER_GIT_REF` | String | `main` | Git commit SHA or branch ref for worker runner checkout |
| `JWT_SECRET` | String | Built-in secret | HMAC secret for JWT token issuance |
| `ENCRYPTION_KEY` | String | `None` | Fernet URL-safe 32-byte base64 encryption key |
| `GEMINI_API_KEY` | String | `None` | Google Gemini API key for cloud AI generation |
| `GROQ_API_KEY` | String | `None` | Groq API key for Llama AI fallback |
| `OPENROUTER_API_KEY` | String | `None` | OpenRouter API key |
| `PEXELS_API_KEY` | String | `None` | Pexels video search API key |
| `PIXABAY_API_KEY` | String | `None` | Pixabay stock footage API key |
