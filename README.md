# AutoShorts Studio 🎬🤖

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.103-009688.svg)

AutoShorts Studio is a professional-grade, faceless YouTube Shorts automation pipeline. Built with a focus on **$0 billing operations**, high-fidelity aesthetics, and seamless local hardware utilization, it orchestrates everything from topic generation to YouTube upload entirely on autopilot.

## ✨ Features

- **$0 Billing Mode:** Fully operational using local LLMs (via Ollama) and free-tier APIs (Google Gemini, Groq, OpenRouter, Pexels, Edge TTS).
- **Premium UI/UX:** A bespoke, enterprise-grade React dashboard built on "Pro Max" design principles (glassmorphism, accessible keyboard navigation, dynamic SVG iconography).
- **Dynamic Caption Engine:** 7 highly polished burnt-in subtitle styles (e.g., Neon Glow, Karaoke Pop, Minimalist) using advanced FFmpeg ASS filtergraphs.
- **Intelligent Video Assembly:** Automatically normalizes color/exposure across fetched stock clips and applies smooth 0.3s crossfades for professional-feeling cuts.
- **Custom Watermarking:** Upload your channel logo, adjust opacity/scale/position, and have it composited natively into every render.
- **Smart Visual Prompts:** LLM actively generates 3-4 word, highly concrete visual search prompts ensuring hyper-relevant stock footage matching.
- **Provider Fallback:** Never fail a generation. If Ollama is down, it seamlessly cascades to Gemini, then Groq, then OpenRouter.
- **Direct YouTube Upload:** Publish straight to your channel (Private, Unlisted, Public) using Google OAuth2.

## 🚀 Getting Started

### Prerequisites
- [Python 3.12+](https://www.python.org/)
- [Node.js 18+](https://nodejs.org/)
- [FFmpeg](https://ffmpeg.org/download.html) (Must be installed and in your system PATH)
- *(Optional but recommended)* [Ollama](https://ollama.ai/) running locally with a model like `qwen2.5` or `llama3`.

### 1. Backend Setup

```bash
# Clone the repository
git clone https://github.com/Sagolsa78/AutoTube_AI.git
cd AutoTube_AI

# Create virtual environment and install dependencies
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the root directory (use `.env.example` as a template):
```env
# AI Providers
OLLAMA_BASE_URL=http://localhost:11434
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key

# Stock Footage
PEXELS_API_KEY=your_pexels_key

# Script Fallback Priority
SCRIPT_PROVIDER_ORDER=ollama,gemini,groq
```

Start the FastAPI server:
```bash
uvicorn backend.main:app --reload --port 8000
```

### 2. Frontend Setup

In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:5173` to access the AutoShorts Studio dashboard.

## 🛠️ Architecture

- **Backend:** `FastAPI` serves as the orchestration engine, handling asynchronous tasks, database state (SQLite via `SQLAlchemy`), and FFmpeg subprocess management.
- **Frontend:** `React` with `Vite` provides a snappy, SPA experience with custom styling (`index.css`) avoiding heavy framework bloat.
- **Database:** Local SQLite (`storage/autoshorts.db`) containing `UserProfile`, `Idea`, `Script`, `Video`, and `Channel` models.
- **Rendering Engine:** `assembler.py` handles complex FFmpeg filtergraphs, performing scale/crop, color matching (`eq`), cascading crossfades (`xfade`), and subtitle overlay (`subtitles`).

## 🔑 YouTube API Integration (Optional)

To enable direct uploading:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and enable the **YouTube Data API v3**.
3. Create OAuth 2.0 Client IDs (Desktop App type).
4. Download the JSON and save it as `client_secret.json` in the root directory.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, development process, and pull request guidelines. 

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

## 🙏 Acknowledgements

- [Edge TTS](https://github.com/rany2/edge-tts) for high-quality free voice generation.
- [FFmpeg](https://ffmpeg.org/) for the heavy lifting in video assembly.
- [Pexels API](https://www.pexels.com/api/) for high-quality stock footage.
