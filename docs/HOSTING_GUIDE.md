# AutoTube AI — Production Hosting & Deployment Guide

This guide details how to deploy AutoTube AI to production in a robust, scalable cloud architecture with seamless switching between local execution and cloud execution.

---

## Architecture Overview

```
                        ┌──────────────────────────────┐
                        │   Vercel / Cloudflare Pages  │
                        │    (Frontend React SPA/PWA)  │
                        └──────────────┬───────────────┘
                                       │ HTTPS / API
                                       ▼
                        ┌──────────────────────────────┐
                        │   Railway / Render / VPS     │
                        │   (FastAPI Backend Server)   │
                        └──────┬───────┬───────┬───────┘
                               │       │       │
             ┌─────────────────┘       │       └──────────────────┐
             ▼                         ▼                          ▼
┌─────────────────────────┐ ┌────────────────────┐ ┌─────────────────────────┐
│     Neon PostgreSQL     │ │   Cloudflare R2    │ │   YouTube Data API v3   │
│   (Serverless Postgres) │ │   (Video Storage)  │ │   (Real Metrics/Upload) │
└─────────────────────────┘ └────────────────────┘ └─────────────────────────┘
```

---

## 1. Cloud Storage Setup (Cloudflare R2)

1. Go to your **Cloudflare Dashboard** → **R2** → **Create Bucket**:
   - Bucket name: `autoshorts-assets` (or your chosen name)
2. In the bucket **Settings**:
   - **CORS Policy**: Add this CORS configuration to allow preview video playback and uploading from your web domain:
     ```json
     [
       {
         "AllowedOrigins": [
           "https://your-domain.com",
           "https://*.vercel.app",
           "http://localhost:5173"
         ],
         "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
         "AllowedHeaders": ["*"],
         "ExposeHeaders": ["ETag", "Content-Range", "Accept-Ranges"],
         "MaxAgeSeconds": 3600
       }
     ]
     ```
3. Generate R2 API Tokens:
   - Permissions: **Object Read & Write**
   - Save your:
     - `S3_ENDPOINT_URL` (e.g. `https://<account-id>.r2.cloudflarestorage.com`)
     - `S3_ACCESS_KEY_ID`
     - `S3_SECRET_ACCESS_KEY`

---

## 2. Backend Hosting (Railway, Render, or VPS)

### Option A: Railway / Render (Recommended for Fast Deployment)
1. Push your AutoTube repository to GitHub.
2. In Railway or Render, create a **New Web Service** pointing to your repository.
3. Configure the build & start commands:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. Set the Environment Variables in the service settings:
   ```env
   APP_MODE=cloud
   APP_ENV=production
   STORAGE_PROVIDER=r2
   S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
   S3_BUCKET_NAME=autoshorts-assets
   S3_ACCESS_KEY_ID=<your-r2-access-key>
   S3_SECRET_ACCESS_KEY=<your-r2-secret-key>
   
   # Database (Neon Postgres)
   DATABASE_URL=postgresql+asyncpg://neondb_owner:<password>@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?ssl=require
   
   # AI Providers
   DEFAULT_AI_PROVIDER=gemini
   DEFAULT_AI_MODEL=gemini-2.5-flash
   SCRIPT_PROVIDER_ORDER=gemini,groq,openrouter
   GEMINI_API_KEY=<your-gemini-key>
   
   # Stock Footage
   PEXELS_API_KEY=<your-pexels-key>
   
   # Security & Multi-User JWT
   AUTH_DISABLED=false
   JWT_SECRET=<generate-a-random-64-char-secret>
   JWT_ALGORITHM=HS256
   
   # CORS (Allow your frontend domain)
   CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173
   ```

### Option B: VPS (Ubuntu 22.04 / 24.04 with Docker or Systemd)
1. Install FFmpeg with NVENC (or CPU x264):
   ```bash
   sudo apt update && sudo apt install -y ffmpeg python3-venv git
   ```
2. Clone repository & create virtual environment:
   ```bash
   git clone https://github.com/Sagolsa78/AutoTube_AI.git /opt/autotube
   cd /opt/autotube
   python3 -m venv venv
   ./venv/bin/pip install -r requirements.txt
   ```
3. Create systemd service (`/etc/systemd/system/autotube.service`):
   ```ini
   [Unit]
   Description=AutoTube AI Backend
   After=network.target

   [Service]
   User=ubuntu
   WorkingDirectory=/opt/autotube
   EnvironmentFile=/opt/autotube/.env
   ExecStart=/opt/autotube/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```
4. Start service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now autotube
   ```

---

## 3. Frontend Hosting (Vercel or Cloudflare Pages)

1. Connect your repository to **Vercel** or **Cloudflare Pages**.
2. Settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Environment Variables:
   - `VITE_API_BASE_URL`: URL of your deployed backend (e.g. `https://api.yourdomain.com` or `https://autotube-backend.up.railway.app`).
4. Click **Deploy**.

---

## 4. Google Cloud & YouTube OAuth Configuration

1. In the **Google Cloud Console**:
   - Enable **YouTube Data API v3**.
   - Create an **OAuth 2.0 Client ID** (Web application).
   - Add **Authorized JavaScript Origins**:
     - `https://your-frontend.vercel.app`
     - `http://localhost:5173`
   - Add **Authorized Redirect URIs**:
     - `https://api.yourdomain.com/api/youtube/callback`
     - `http://localhost:8000/api/youtube/callback`
2. Download the `client_secret.json` and place it in the backend root directory (or specify via `YOUTUBE_CLIENT_SECRETS`).

---

## 5. Remote Mobile Phone Control

- **On Local Network (LAN)**:
  - Vite is already configured with `host: true`. Open `http://<your-pc-ip>:5173` on your smartphone browser.
- **Over the Internet (Anywhere in the World)**:
  - Deploy frontend to Vercel and backend to Railway/Render/VPS.
  - Open your URL in Safari or Chrome on your phone.
  - Tap **Share → Add to Home Screen** to install AutoTube AI as a full-screen Native PWA app!
  - You now have complete remote touch control over idea generation, scripting, video previewing, approving, and publishing to YouTube.
