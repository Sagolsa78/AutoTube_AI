# Local Development Setup

## Prerequisites
- Python 3.11 or 3.12
- Node.js 18+ & npm
- FFmpeg & ffprobe installed and available in PATH
- (Optional) Ollama with `qwen2.5-coder:7b` for local offline AI generation

---

## 1. Setup Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 2. Environment Configuration
Create a `.env` file in the repository root:
```env
APP_ENV=development
APP_MODE=local
STORAGE_BACKEND=local
WORKER_BACKEND=local
DATABASE_URL=sqlite+aiosqlite:///./storage/autoshorts.db
JWT_SECRET=dev-secret-jwt-key-2026
ENCRYPTION_KEY=gK7P5B-EXAMPLE-FERNET-KEY-32BYTES=
GEMINI_API_KEY=your_gemini_key_optional
```

---

## 3. Run Database Migrations
```bash
alembic upgrade head
```

---

## 4. Start Services (3 Separate Processes)

### Terminal 1: FastAPI Control Plane
```bash
uvicorn backend.main:app --reload --port 8000
```

### Terminal 2: Standalone Local Worker
```bash
python -m backend.worker.main
```

### Terminal 3: Vite React Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to start creating videos.
