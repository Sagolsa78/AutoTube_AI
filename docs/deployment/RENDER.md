# Deploying API & Frontend to Render

## 1. Web Service (FastAPI Control Plane)
- **Environment**: Python 3.12
- **Build Command**: `pip install -r requirements.txt && alembic upgrade head`
- **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path**: `/api/system/health`

### Environment Variables for Render Web Service
```env
APP_ENV=production
APP_MODE=cloud
STORAGE_BACKEND=r2
WORKER_BACKEND=github_actions
DATABASE_URL=postgresql+asyncpg://<user>:<password>@<neon_host>/<db>?ssl=require
JWT_SECRET=<strong-random-secret>
ENCRYPTION_KEY=<32-byte-fernet-key>
GITHUB_TOKEN=<github-pat-with-workflow-scope>
GITHUB_REPO=Sagolsa78/AutoTube_AI
WORKER_GIT_REF=main
S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
S3_BUCKET_NAME=<r2-bucket-name>
S3_ACCESS_KEY_ID=<r2-access-key-id>
S3_SECRET_ACCESS_KEY=<r2-secret-access-key>
```

---

## 2. Static Site (React Frontend)
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`

### Environment Variables for Render Static Site
```env
VITE_API_BASE_URL=https://<your-render-api-service>.onrender.com
```
