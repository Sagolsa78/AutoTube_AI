import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Pause,
  Cpu,
  HardDrive,
  ShieldCheck,
  Zap,
  ArrowRight,
  Check,
  X,
  Star,
  Upload,
  Video,
  FileText,
  Mic,
  Layers,
  Sliders,
  Smartphone,
  Monitor,
  Clock,
  BarChart2,
  RefreshCw,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Radio,
  Share2,
  Volume2,
  SlidersHorizontal,
  Activity
} from 'lucide-react';
import './Landing.css';

// ── Pipeline Stages Data ───────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  {
    id: 'brief',
    step: '01',
    name: 'Brief',
    tagline: 'Topic & Angle',
    desc: 'Accepts or trends a high-retention angle with niche hook parameters.',
    badge: 'Niche Engine',
    details: {
      input: 'Topic: "Creatures surviving absolute zero"',
      output: 'Angle: Science/Mystery · Target Duration: 48s · Hook Type: Paradox',
      metric: 'Trend Strength: 96%',
    }
  },
  {
    id: 'script',
    step: '02',
    name: 'Script',
    tagline: 'Structured Narration',
    desc: 'Generates rhythmic 3-act narrative with precise 3-second hook boundaries.',
    badge: 'Ollama / Gemini',
    details: {
      input: 'Hook: "There is an animal that survived five days in open space."',
      output: '5 Scenes · 142 Words · Pacing: 2.9 words/sec · 3-Act Structure',
      metric: 'Hook Retention Score: 94/100',
    }
  },
  {
    id: 'storyboard',
    step: '03',
    name: 'Storyboard',
    tagline: 'Scene Visual Plan',
    desc: 'Maps every narration sentence to a cinematic visual intent and framing cue.',
    badge: 'Visual Router',
    details: {
      input: 'Scene 2: "Deep space vacuum simulation chamber"',
      output: 'Framing: Macro 9:16 · Motion: Slow Push-in · Lighting: Cold Cyan',
      metric: '5/5 Scenes Mapped',
    }
  },
  {
    id: 'voice',
    step: '04',
    name: 'Voice',
    tagline: 'Local Narration & Timings',
    desc: 'Synthesizes neural voiceover and extracts millisecond word boundary offsets.',
    badge: 'Edge-TTS ($0)',
    details: {
      input: 'Voice: en-US-ChristopherNeural · Speed: 1.05x · Pitch: Neutral',
      output: 'Audio: 24kHz Mono MP3 · 142 Word Timestamps · Duration: 47.4s',
      metric: 'Zero API Cost ($0.00)',
    }
  },
  {
    id: 'visuals',
    step: '05',
    name: 'Visuals',
    tagline: 'Sourced or Generated',
    desc: 'Retrieves 4K vertical footage matching scene mood with zero watermark.',
    badge: 'Pexels / ComfyUI',
    details: {
      input: 'Query: "microscopic organism tardigrade deep space"',
      output: '5 Cinematic Clips (1080x1920) · Color-matched & Normalized',
      metric: '100% Rights Cleared',
    }
  },
  {
    id: 'render',
    step: '06',
    name: 'Render',
    tagline: 'Assembly & Subtitles',
    desc: 'FFmpeg compiles footage, audio, karaoke ASS subtitles, and watermark in one pass.',
    badge: 'FFmpeg NVENC',
    details: {
      input: 'Profile: 1080x1920 @ 60fps · Codec: h264_nvenc · Preset: P5',
      output: 'File: tardigrade_space_master.mp4 · Size: 38.2 MB · CRF: 20',
      metric: 'Render Time: 18.4s (RTX 3050)',
    }
  },
  {
    id: 'review',
    step: '07',
    name: 'Review',
    tagline: 'Scoring & Selection',
    desc: 'Calculates viral pacing score and queues for one-touch creator decision.',
    badge: 'Review Gate',
    details: {
      input: 'Scoring: Hook Pacing (95) · Visual Density (92) · Audio Mix (96)',
      output: 'Overall Score: 94/100 · Verdict: BEST IN BATCH · Action Required',
      metric: 'Awaiting Creator Approval',
    }
  },
  {
    id: 'publish',
    step: '08',
    name: 'Publish',
    tagline: 'Direct YouTube Upload',
    desc: 'Pushes verified Shorts directly to your channel with optimized metadata.',
    badge: 'YouTube API v3',
    details: {
      input: 'Target: Connected Channel · Privacy: Public / Draft Schedule',
      output: 'Video ID: yt-dQw4w9WgXcQ · SEO Tags & Description Applied',
      metric: 'Live on YouTube Shorts',
    }
  },
];

// ── Hero Scene Presets ────────────────────────────────────────────────────────
const HERO_SCENES = [
  {
    idx: '01',
    label: 'Hook',
    title: 'The Deep Ocean Void',
    niche: 'Deep Sea Mystery · 1080p60',
    time: '0:47',
    score: 94,
    words: [
      { text: 'Deep', status: 'past' },
      { text: 'beneath', status: 'past' },
      { text: 'the ocean', status: 'active' },
      { text: 'trench,', status: 'next' },
      { text: 'pressure', status: 'next' },
      { text: 'crushes', status: 'next' },
      { text: 'steel.', status: 'next' },
    ],
    orbColor: 'rgba(92, 143, 232, 0.4)',
  },
  {
    idx: '02',
    label: 'Paradox',
    title: 'The Indestructible Specimen',
    niche: 'Extreme Biology · 1080p60',
    time: '0:52',
    score: 91,
    words: [
      { text: 'Yet', status: 'past' },
      { text: 'microscopic', status: 'active' },
      { text: 'tardigrades', status: 'next' },
      { text: 'swim', status: 'next' },
      { text: 'here', status: 'next' },
      { text: 'completely', status: 'next' },
      { text: 'unharmed.', status: 'next' },
    ],
    orbColor: 'rgba(50, 196, 141, 0.4)',
  },
  {
    idx: '03',
    label: 'Reveal',
    title: 'Cryo-Glass Protection',
    niche: 'Quantum Nature · 1080p60',
    time: '0:44',
    score: 96,
    words: [
      { text: 'Their', status: 'past' },
      { text: 'cells', status: 'past' },
      { text: 'produce', status: 'active' },
      { text: 'protective', status: 'next' },
      { text: 'glass-like', status: 'next' },
      { text: 'proteins.', status: 'next' },
    ],
    orbColor: 'rgba(232, 176, 75, 0.4)',
  }
];

// ── Ranked Best Content Data ───────────────────────────────────────────────────
const INITIAL_BEST_VIDEOS = [
  {
    id: 'vid-01',
    rank: '01',
    title: 'The animal that survives boiling water and space',
    niche: 'Science Mystery',
    score: 94,
    status: 'BEST',
    duration: '0:47',
    hookScore: '96%',
    renderTime: '18s',
    thumbnailColor: '#1A2332',
  },
  {
    id: 'vid-02',
    rank: '02',
    title: 'Scientists just found this beneath Antarctica',
    niche: 'Deep Earth',
    score: 91,
    status: 'READY',
    duration: '0:52',
    hookScore: '92%',
    renderTime: '21s',
    thumbnailColor: '#1C2720',
  },
  {
    id: 'vid-03',
    rank: '03',
    title: 'The ancient city no satellite map agrees on',
    niche: 'Lost History',
    score: 87,
    status: 'REVIEW',
    duration: '0:44',
    hookScore: '88%',
    renderTime: '17s',
    thumbnailColor: '#2B201A',
  },
];

export default function Landing() {
  const [activeStage, setActiveStage] = useState(0);
  const [heroStep, setHeroStep] = useState(0);
  const [heroSceneIndex, setHeroSceneIndex] = useState(0);
  const [captionStyle, setCaptionStyle] = useState('bold_yellow'); // 'bold_yellow', 'neon_glow', 'clean_white'
  const [isPlayingHero, setIsPlayingHero] = useState(true);
  
  // Local compute 3-state routing simulation ('local', 'burst', 'queue')
  const [computeMode, setComputeMode] = useState('local');
  
  // Mobile Triage State
  const [mobileDecision, setMobileDecision] = useState('pending');
  
  // Command Center Interactive Filters & Approval Simulation
  const [commandFilter, setCommandFilter] = useState('ALL');
  const [approvedVideoIds, setApprovedVideoIds] = useState(new Set());
  
  // Studio Interactive 3-Pane Workstation State
  const [selectedStudioScene, setSelectedStudioScene] = useState(0);
  const [studioScenes, setStudioScenes] = useState([
    {
      idx: '01 // HOOK',
      label: 'Scene 01',
      time: '0.0s - 3.2s',
      narration: 'Deep beneath the ocean trench, pressure crushes steel.',
      visual: 'Cinematic macro shot of deep abyss bioluminescence',
      voice: 'en-US-ChristopherNeural (Pacing: 1.05x)',
      style: 'Bold Centered · Neon Yellow Punch',
    },
    {
      idx: '02 // TENSION',
      label: 'Scene 02',
      time: '3.2s - 8.5s',
      narration: 'Steel submarines implode within milliseconds.',
      visual: 'Submarine hull buckling under extreme hydrostatic pressure',
      voice: 'en-US-ChristopherNeural (Pacing: 1.05x)',
      style: 'Karaoke Glow · Active Word Zoom',
    },
    {
      idx: '03 // REVEAL',
      label: 'Scene 03',
      time: '8.5s - 16.0s',
      narration: 'Yet microscopic tardigrades swim here undisturbed.',
      visual: 'Slow motion electron microscope capture of tardigrade',
      voice: 'en-US-ChristopherNeural (Pacing: 1.05x)',
      style: 'Clean Editorial · White Highlight',
    },
  ]);

  // Hero simulated pipeline cycle
  useEffect(() => {
    if (!isPlayingHero) return;
    const interval = setInterval(() => {
      setHeroStep((prev) => (prev + 1) % 5);
    }, 3800);
    return () => clearInterval(interval);
  }, [isPlayingHero]);

  const heroStates = [
    { phase: 'ANALYZING BRIEF', detail: 'Topic: "The Deep Ocean Void" · 5 Scenes', progress: 20 },
    { phase: 'SCRIPT & HOOK GENERATED', detail: '3-Act Hook Drafted · 142 Words', progress: 40 },
    { phase: 'NEURAL AUDIO SYNTHESIZED', detail: 'Edge-TTS en-US 24kHz · Timestamps synced', progress: 60 },
    { phase: 'FFMPEG HARNESS RENDERING', detail: '1080x1920 60fps · ASS Subtitles burned', progress: 85 },
    { phase: 'READY FOR REVIEW', detail: 'Scored 94/100 · Best in Batch', progress: 100 },
  ];

  const currentHeroState = heroStates[heroStep];
  const currentHeroScene = HERO_SCENES[heroSceneIndex];
  const activeSceneData = studioScenes[selectedStudioScene];

  const filteredVideos = INITIAL_BEST_VIDEOS.filter((v) => {
    if (commandFilter === 'READY') return v.status === 'READY' || v.status === 'BEST';
    if (commandFilter === 'BEST') return v.status === 'BEST';
    return true;
  });

  const toggleApproveVideo = (id) => {
    setApprovedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStudioNarrationChange = (text) => {
    setStudioScenes((prev) => {
      const copy = [...prev];
      copy[selectedStudioScene] = { ...copy[selectedStudioScene], narration: text };
      return copy;
    });
  };

  return (
    <div className="landing-page">
      {/* ── 1. Navigation Bar ───────────────────────────────────────────────── */}
      <header className="landing-navbar">
        <div className="nav-container">
          <div className="nav-brand-group">
            <Link to="/" className="nav-brand">
              <span className="brand-dot-pulse"></span>
              <span className="brand-title">AutoTube_AI</span>
            </Link>
            <div className="telemetry-pill desktop-only">
              <span className="status-dot online"></span>
              <span className="telemetry-text">LOCAL GPU WORKER READY</span>
            </div>
          </div>

          <nav className="nav-links" aria-label="Main Navigation">
            <a href="#pipeline" className="nav-link">Pipeline</a>
            <a href="#away-mode" className="nav-link">While Away</a>
            <a href="#command-center" className="nav-link">Command Center</a>
            <a href="#best-content" className="nav-link">Best Engine</a>
            <a href="#local-first" className="nav-link">Local Compute</a>
            <a href="#studio" className="nav-link">Studio</a>
          </nav>

          <div className="nav-actions">
            <Link to="/app" className="btn-cta-primary">
              <span>Open the Studio</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── 2. Hero Section ──────────────────────────────────────────────── */}
        <section className="hero-section">
          <div className="hero-container">
            {/* Left Hero Column: Value Proposition */}
            <div className="hero-copy-col">
              <div className="system-kicker">
                <span className="kicker-tag">AUTONOMOUS MEDIA PRODUCTION</span>
                <span className="kicker-div">/</span>
                <span className="kicker-sub">LOCAL-FIRST CORE</span>
              </div>

              <h1 className="hero-headline">
                Shorts, produced while you're somewhere else.
              </h1>

              <p className="hero-description">
                A topic goes in. A script, voice, visuals, and finished render come out — ready for your review. Run production on your own GPU by default, then approve and publish from wherever you are.
              </p>

              <div className="hero-cta-group">
                <Link to="/app" className="btn-hero-primary">
                  <span>Open the Studio</span>
                  <ArrowRight size={16} />
                </Link>
                <a href="#pipeline" className="btn-hero-secondary">
                  <span>See how it works</span>
                </a>
              </div>

              {/* Technical Specifications Strip */}
              <div className="hero-specs-strip">
                <div className="spec-item">
                  <span className="spec-label">DEFAULT COMPUTE</span>
                  <span className="spec-value">Local RTX GPU ($0)</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">RENDER PROFILE</span>
                  <span className="spec-value">1080×1920 60fps</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">EDITORIAL CONTROL</span>
                  <span className="spec-value">100% Creator Gated</span>
                </div>
              </div>
            </div>

            {/* Right Hero Column: Living Media Workstation Preview */}
            <div className="hero-preview-col">
              <div className="workstation-chassis">
                {/* Workstation Top Status Header */}
                <div className="chassis-header">
                  <div className="chassis-led-group">
                    <span className="chassis-led red"></span>
                    <span className="chassis-label">MONITOR 01 // 9:16 MASTER</span>
                  </div>
                  <div className="chassis-meta-right">
                    <span className="live-pill">
                      <Radio size={12} className="pulse-icon" />
                      LIVE QUEUE
                    </span>
                    <span className="timecode-mono">00:47:12</span>
                  </div>
                </div>

                {/* Interactive Scene Selector Toolbar inside Monitor */}
                <div className="hero-scene-toolbar">
                  <span className="tool-lbl">PREVIEW SCENE:</span>
                  <div className="tool-chips">
                    {HERO_SCENES.map((sc, i) => (
                      <button
                        key={sc.idx}
                        className={`tool-chip ${heroSceneIndex === i ? 'active' : ''}`}
                        onClick={() => setHeroSceneIndex(i)}
                      >
                        {sc.idx} {sc.label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="style-chip-toggle"
                    title="Toggle Caption Typography Style"
                    onClick={() => {
                      const styles = ['bold_yellow', 'neon_glow', 'clean_white'];
                      const next = styles[(styles.indexOf(captionStyle) + 1) % styles.length];
                      setCaptionStyle(next);
                    }}
                  >
                    <SlidersHorizontal size={12} />
                    <span>Style</span>
                  </button>
                </div>

                {/* 9:16 Video Frame Container */}
                <div className="video-viewport">
                  {/* Background Simulated Video Asset */}
                  <div className="video-background-layer">
                    <div className="ambient-depth-grid"></div>
                    <div className="simulated-motion-layer">
                      <div
                        className="ocean-abyss-orb"
                        style={{ background: `radial-gradient(circle, ${currentHeroScene.orbColor} 0%, transparent 75%)` }}
                      ></div>
                    </div>
                  </div>

                  {/* Overlaid Live Production Hud */}
                  <div className="viewport-hud-overlay">
                    <div className="hud-topbar">
                      <span className="hud-badge score">SCORE: {currentHeroScene.score} / 100</span>
                      <div className="waveform-bar-indicator">
                        <span className="wave-bar bar-1"></span>
                        <span className="wave-bar bar-2"></span>
                        <span className="wave-bar bar-3"></span>
                        <span className="wave-bar bar-4"></span>
                        <Volume2 size={11} className="text-secondary" />
                      </div>
                      <span className="hud-badge scene">SCENE {currentHeroScene.idx}/05</span>
                    </div>

                    {/* Dynamic Karaoke Captions with Active Style Class */}
                    <div className={`karaoke-captions-box ${captionStyle}`}>
                      {currentHeroScene.words.map((w, i) => (
                        <React.Fragment key={i}>
                          <span className={`word ${w.status}`}>{w.text}</span>{' '}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Bottom Video Metadata */}
                    <div className="hud-bottombar">
                      <div className="hud-info">
                        <span className="hud-title">{currentHeroScene.title}</span>
                        <span className="hud-sub">{currentHeroScene.niche}</span>
                      </div>
                      <button
                        className="hud-play-toggle"
                        onClick={() => setIsPlayingHero(!isPlayingHero)}
                        aria-label={isPlayingHero ? "Pause simulation" : "Play simulation"}
                      >
                        {isPlayingHero ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Process Tracker Bar */}
                <div className="chassis-footer">
                  <div className="process-header">
                    <span className="process-stage-name">{currentHeroState.phase}</span>
                    <span className="process-percent">{currentHeroState.progress}%</span>
                  </div>
                  <div className="process-progress-track">
                    <div
                      className="process-progress-fill"
                      style={{ width: `${currentHeroState.progress}%` }}
                    ></div>
                  </div>
                  <div className="process-detail-line">
                    <span className="mono-tiny">{currentHeroState.detail}</span>
                    <span className="mono-tiny status-ok">RTX 3050 NVENC</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. Product Proof Strip ───────────────────────────────────────── */}
        <section className="proof-strip-section" aria-label="Product Truths">
          <div className="section-container">
            <div className="proof-grid">
              <div className="proof-card">
                <div className="proof-icon-box">
                  <Cpu size={20} className="proof-icon" />
                </div>
                <div className="proof-text-box">
                  <h3 className="proof-title">Local-first</h3>
                  <p className="proof-desc">Your GPU handles LLM, voice, and rendering by default. Zero recurring API fees on standard runs.</p>
                </div>
              </div>

              <div className="proof-card">
                <div className="proof-icon-box">
                  <Zap size={20} className="proof-icon" />
                </div>
                <div className="proof-text-box">
                  <h3 className="proof-title">Budget-aware</h3>
                  <p className="proof-desc">Cloud burst triggers only when your laptop is offline, governed by strict daily spending limits.</p>
                </div>
              </div>

              <div className="proof-card">
                <div className="proof-icon-box">
                  <ShieldCheck size={20} className="proof-icon" />
                </div>
                <div className="proof-text-box">
                  <h3 className="proof-title">Review-first</h3>
                  <p className="proof-desc">Nothing goes live without your decision. You approve, reject, or crown the best Short from anywhere.</p>
                </div>
              </div>

              <div className="proof-card">
                <div className="proof-icon-box">
                  <Layers size={20} className="proof-icon" />
                </div>
                <div className="proof-text-box">
                  <h3 className="proof-title">End-to-end</h3>
                  <p className="proof-desc">One connected pipeline from raw concept to YouTube publication. No juggling disconnected tools.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. The Signature Living Production Timeline ──────────────────── */}
        <section id="pipeline" className="pipeline-section">
          <div className="section-container">
            <div className="section-header">
              <span className="section-eyebrow">THE LIVING PRODUCTION INSTRUMENT</span>
              <h2 className="section-headline">One production line. From idea to publish.</h2>
              <p className="section-description">
                AutoTube_AI is not an isolated clip generator. It is an automated media workstation orchestrating an entire eight-stage production lifecycle.
              </p>
            </div>

            {/* Connected Production Timeline Rail */}
            <div className="timeline-instrument">
              <div className="timeline-nodes-track">
                {PIPELINE_STAGES.map((st, idx) => {
                  const isActive = activeStage === idx;
                  return (
                    <button
                      key={st.id}
                      className={`timeline-node ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveStage(idx)}
                    >
                      <div className="node-top-bar">
                        <span className="node-step-mono">{st.step}</span>
                        <span className="node-signal-dot"></span>
                      </div>
                      <div className="node-name">{st.name}</div>
                      <div className="node-tagline">{st.tagline}</div>
                      <div className="node-badge-tag">{st.badge}</div>
                    </button>
                  );
                })}
              </div>

              {/* Active Stage Technical Telemetry Monitor */}
              <div className="stage-monitor-console">
                <div className="console-header">
                  <div className="console-title-group">
                    <span className="console-indicator"></span>
                    <span className="console-title">
                      STAGE {PIPELINE_STAGES[activeStage].step} // {PIPELINE_STAGES[activeStage].name.toUpperCase()} INSPECTOR
                    </span>
                  </div>
                  <span className="console-badge">{PIPELINE_STAGES[activeStage].badge}</span>
                </div>

                <div className="console-body-grid">
                  <div className="console-col">
                    <span className="console-label">STAGE PURPOSE</span>
                    <p className="console-desc">{PIPELINE_STAGES[activeStage].desc}</p>
                    <div className="console-metric-strip">
                      <span className="metric-tag">{PIPELINE_STAGES[activeStage].details.metric}</span>
                    </div>
                  </div>

                  <div className="console-col code-col">
                    <span className="console-label">INPUT SPECIFICATION</span>
                    <div className="console-code-block">
                      <code>{PIPELINE_STAGES[activeStage].details.input}</code>
                    </div>

                    <span className="console-label" style={{ marginTop: '12px' }}>OUTPUT ARTIFACT</span>
                    <div className="console-code-block output">
                      <code>{PIPELINE_STAGES[activeStage].details.output}</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. While You're Away (Desktop ↔ Mobile Split) ────────────────── */}
        <section id="away-mode" className="away-section">
          <div className="section-container">
            <div className="section-header">
              <span className="section-eyebrow">ASYMMETRIC CONTROL</span>
              <h2 className="section-headline">The queue doesn't wait for you to get home.</h2>
              <p className="section-description">
                Production happens silently on your local machine. Review and publishing decisions happen wherever you are, directly from your phone.
              </p>
            </div>

            <div className="away-duo-grid">
              {/* Left: Desktop Local Machine Running Silently */}
              <div className="away-workstation-panel">
                <div className="panel-chrome-bar">
                  <div className="panel-title">
                    <Monitor size={16} />
                    <span>WORKSTATION // LOCAL CORE (DESKTOP)</span>
                  </div>
                  <span className="badge-quiet-green">RUNNING IN BACKGROUND</span>
                </div>

                <div className="workstation-internal">
                  <div className="system-telemetry-block">
                    <div className="telemetry-row">
                      <span className="tel-name">HARDWARE TARGET</span>
                      <span className="tel-val mono">NVIDIA GeForce RTX 3050 (4GB VRAM)</span>
                    </div>
                    <div className="telemetry-row">
                      <span className="tel-name">PIPELINE DAEMON</span>
                      <span className="tel-val mono status-green">Active (0ms latency, $0.00/hr)</span>
                    </div>
                    <div className="telemetry-row">
                      <span className="tel-name">BATCH QUEUE</span>
                      <span className="tel-val mono">5 Jobs Inbound · 1 Rendering</span>
                    </div>
                  </div>

                  <div className="render-mini-terminal">
                    <div className="term-line">$ worker_agent.py --mode=local_first --poll=30s</div>
                    <div className="term-line text-muted">[2026-09-08 17:34:02] Heartbeat synchronized. 0 cloud burst spend.</div>
                    <div className="term-line text-muted">[2026-09-08 17:34:11] Assembling: "The animal that survives boiling" (18.4s)</div>
                    <div className="term-line text-green">[2026-09-08 17:34:30] MP4 created. Synced to review queue via R2.</div>
                  </div>

                  <div className="panel-footer-note">
                    <CheckCircle2 size={16} className="text-green" />
                    <span>Your machine processes jobs autonomously without keeping UI windows open.</span>
                  </div>
                </div>
              </div>

              {/* Right: Phone Review Mobile Station */}
              <div className="away-mobile-panel">
                <div className="panel-chrome-bar">
                  <div className="panel-title">
                    <Smartphone size={16} />
                    <span>MOBILE REMOTE // TRIAGE STATION</span>
                  </div>
                  <span className="badge-quiet-red">REVIEW GATE</span>
                </div>

                <div className="phone-mockup-wrapper">
                  <div className="phone-screen-frame">
                    <div className="phone-speaker-notch"></div>
                    <div className="phone-inner-content">
                      <div className="phone-top-status">
                        <span className="time">17:34</span>
                        <span className="pill-ready">READY FOR REVIEW</span>
                      </div>

                      <div className="phone-video-card">
                        <div className="phone-preview-aspect">
                          <div className="phone-overlay-title">The animal that survives boiling</div>
                          <div className="phone-score-tag">SCORE: 94</div>
                        </div>
                      </div>

                      {/* Thumb-Friendly Action Buttons */}
                      <div className="phone-thumb-actions">
                        <button
                          className={`thumb-btn reject ${mobileDecision === 'rejected' ? 'selected' : ''}`}
                          onClick={() => setMobileDecision('rejected')}
                        >
                          <X size={16} />
                          <span>Reject</span>
                        </button>
                        <button
                          className={`thumb-btn approve ${mobileDecision === 'approved' ? 'selected' : ''}`}
                          onClick={() => setMobileDecision('approved')}
                        >
                          <Check size={16} />
                          <span>Approve</span>
                        </button>
                        <button
                          className={`thumb-btn best ${mobileDecision === 'best' ? 'selected' : ''}`}
                          onClick={() => setMobileDecision('best')}
                        >
                          <Star size={16} />
                          <span>Best</span>
                        </button>
                        <button
                          className={`thumb-btn publish ${mobileDecision === 'published' ? 'selected' : ''}`}
                          onClick={() => setMobileDecision('published')}
                        >
                          <Upload size={16} />
                          <span>Publish</span>
                        </button>
                      </div>

                      {mobileDecision !== 'pending' && (
                        <div className="mobile-feedback-toast">
                          Action dispatched: <strong className="uppercase">{mobileDecision}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. Command Center Preview ────────────────────────────────────── */}
        <section id="command-center" className="command-center-section">
          <div className="section-container">
            <div className="section-header">
              <span className="section-eyebrow">UNIFIED CONTROL PLANE</span>
              <h2 className="section-headline">Everything that needs you. One screen.</h2>
              <p className="section-description">
                A single control surface designed like an editorial broadcast room. Zero card clutter, strict visual hierarchy, and real-time system observability.
              </p>
            </div>

            {/* Master Command Center Workstation UI */}
            <div className="command-workstation-chassis">
              <div className="command-top-bar">
                <div className="window-dots">
                  <span></span><span></span><span></span>
                </div>
                <div className="command-channel-select">
                  <span className="chan-title">Channel: Science Curiosity Shorts (EN)</span>
                </div>
                <div className="command-status-pills">
                  <span className="status-badge green">RTX 3050: ONLINE</span>
                  <span className="status-badge gray">TODAY'S SPEND: $0.00 / $2.00</span>
                </div>
              </div>

              <div className="command-grid-layout">
                {/* Main Queue Table with Interactive Filters */}
                <div className="command-main-panel">
                  <div className="panel-inner-header">
                    <div className="panel-tab-group">
                      <button
                        className={`panel-tab ${commandFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setCommandFilter('ALL')}
                      >
                        ALL QUEUE ({INITIAL_BEST_VIDEOS.length})
                      </button>
                      <button
                        className={`panel-tab ${commandFilter === 'READY' ? 'active' : ''}`}
                        onClick={() => setCommandFilter('READY')}
                      >
                        READY TO REVIEW (2)
                      </button>
                      <button
                        className={`panel-tab ${commandFilter === 'BEST' ? 'active' : ''}`}
                        onClick={() => setCommandFilter('BEST')}
                      >
                        TOP RANKED (1)
                      </button>
                    </div>
                    <span className="panel-count">{approvedVideoIds.size} APPROVED FOR RELEASE</span>
                  </div>

                  <div className="command-table-rows">
                    {filteredVideos.map((vid) => {
                      const isApproved = approvedVideoIds.has(vid.id);
                      return (
                        <div key={vid.id} className="command-row-item">
                          <span className="row-rank-mono">{vid.rank}</span>
                          <div className="row-thumb" style={{ backgroundColor: vid.thumbnailColor }}>
                            <Play size={12} className="row-play-icon" />
                          </div>
                          <div className="row-info-block">
                            <span className="row-title">{vid.title}</span>
                            <span className="row-sub">{vid.niche} · {vid.duration} · Hook Score: {vid.hookScore}</span>
                          </div>
                          <div className="row-score-badge">
                            <span className="score-num">{vid.score}</span>
                            <span className="score-denom">/100</span>
                          </div>
                          <div className="row-actions-group">
                            <span className={`status-tag-pill ${isApproved ? 'approved' : vid.status.toLowerCase()}`}>
                              {isApproved ? 'APPROVED' : vid.status}
                            </span>
                            <button
                              className={`btn-row-approve ${isApproved ? 'active' : ''}`}
                              onClick={() => toggleApproveVideo(vid.id)}
                              title={isApproved ? "Revoke Approval" : "1-Click Approve"}
                            >
                              <Check size={13} />
                              <span>{isApproved ? 'Approved' : 'Approve'}</span>
                            </button>
                            <Link to="/app/videos" className="btn-row-action">Inspect</Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Active Render Job Monitor */}
                <div className="command-side-panel">
                  <div className="panel-inner-header">
                    <span className="panel-heading">ACTIVE RENDERING ENGINES</span>
                    <span className="live-dot"></span>
                  </div>

                  <div className="render-job-card">
                    <div className="job-title-row">
                      <span className="job-title">The place no map agrees on</span>
                      <span className="job-stage">STAGE 06/08</span>
                    </div>
                    <div className="job-progress-bar">
                      <div className="job-fill" style={{ width: '68%' }}></div>
                    </div>
                    <div className="job-meta-row">
                      <span>FFmpeg Assembly: Scene 3 of 5</span>
                      <span className="mono">68%</span>
                    </div>
                    <div className="job-stat-strip">
                      <span className="stat-pill">NVENC h264</span>
                      <span className="stat-pill">Bitrate: 8.2M</span>
                      <span className="stat-pill">Est: 6s left</span>
                    </div>
                  </div>

                  <div className="system-health-mini">
                    <span className="health-title">INFRASTRUCTURE READOUT</span>
                    <div className="health-line">
                      <span>Database (PostgreSQL)</span>
                      <span className="val-ok">Connected</span>
                    </div>
                    <div className="health-line">
                      <span>Object Store (Cloudflare R2)</span>
                      <span className="val-ok">10GB Free Tier Active</span>
                    </div>
                    <div className="health-line">
                      <span>YouTube API Quota</span>
                      <span className="val-ok">10,000 Units Ready</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 7. Best Content Section ──────────────────────────────────────── */}
        <section id="best-content" className="best-content-section">
          <div className="section-container">
            <div className="section-header">
              <span className="section-eyebrow">QUALITY SELECTION</span>
              <h2 className="section-headline">It doesn't just make videos. It tells you which one is worth publishing.</h2>
              <p className="section-description">
                High-volume generation without quality triage creates fatigue. AutoTube_AI evaluates hook retention, spoken density, and visual pacing to rank and surface the standout video.
              </p>
            </div>

            <div className="best-cards-grid">
              {INITIAL_BEST_VIDEOS.map((item) => (
                <div key={item.rank} className={`best-card ${item.status === 'BEST' ? 'featured' : ''}`}>
                  <div className="best-card-header">
                    <span className="best-rank">#{item.rank}</span>
                    <span className={`best-status-tag ${item.status.toLowerCase()}`}>{item.status}</span>
                  </div>

                  <div className="best-thumb-frame" style={{ backgroundColor: item.thumbnailColor }}>
                    <div className="best-preview-overlay">
                      <div className="best-score-display">
                        <span className="score-big">{item.score}</span>
                        <span className="score-small">QUALITY INDEX</span>
                      </div>
                    </div>
                  </div>

                  <div className="best-card-content">
                    <h3 className="best-title">{item.title}</h3>
                    <div className="best-metrics-list">
                      <div className="b-metric">
                        <span className="b-lbl">HOOK RETENTION</span>
                        <span className="b-val">{item.hookScore}</span>
                      </div>
                      <div className="b-metric">
                        <span className="b-lbl">DURATION</span>
                        <span className="b-val">{item.duration}</span>
                      </div>
                      <div className="b-metric">
                        <span className="b-lbl">LOCAL RENDER</span>
                        <span className="b-val">{item.renderTime}</span>
                      </div>
                    </div>

                    <Link to="/app/best" className="btn-best-select">
                      <span>Select & Publish</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 8. Local-First Compute Routing ───────────────────────────────── */}
        <section id="local-first" className="compute-section">
          <div className="section-container">
            <div className="section-header">
              <span className="section-eyebrow">LOCAL-FIRST HARDWARE ROUTING</span>
              <h2 className="section-headline">Your GPU first. The cloud only when it needs to be.</h2>
              <p className="section-description">
                AutoTube_AI routes compute to your machine by default, avoiding metered cloud bills. When you leave home, cloud bursting is strictly governed by your budget cap.
              </p>
            </div>

            {/* Interactive 3-Way Simulation Switcher */}
            <div className="compute-interactive-box">
              <div className="sim-control-bar">
                <span className="sim-title">SIMULATE HARDWARE STATE:</span>
                <div className="sim-toggle-buttons">
                  <button
                    className={`sim-btn ${computeMode === 'local' ? 'active' : ''}`}
                    onClick={() => setComputeMode('local')}
                  >
                    <span>Local RTX 3050 Online ($0)</span>
                    <span className="dot green"></span>
                  </button>
                  <button
                    className={`sim-btn ${computeMode === 'burst' ? 'active' : ''}`}
                    onClick={() => setComputeMode('burst')}
                  >
                    <span>Local Offline / Cloud Burst ($0.35)</span>
                    <span className="dot orange"></span>
                  </button>
                  <button
                    className={`sim-btn ${computeMode === 'queue' ? 'active' : ''}`}
                    onClick={() => setComputeMode('queue')}
                  >
                    <span>Budget Cap Reached ($2.00 / Safety Queue)</span>
                    <span className="dot red"></span>
                  </button>
                </div>
              </div>

              {/* Dynamic Routing Visual Diagram */}
              <div className="routing-flow-diagram">
                {/* Node 1: Inbound Job */}
                <div className="routing-node entry">
                  <span className="node-kicker">INBOUND PIPELINE</span>
                  <span className="node-title">Render Job Queued</span>
                  <span className="mono-sub">UUID: job-9a1b // 1080x1920</span>
                </div>

                <div className="flow-arrow-down">↓</div>

                {/* Node 2: Worker Router Decision Engine */}
                <div className="routing-node decision">
                  <span className="node-kicker">CONTROL PLANE</span>
                  <span className="node-title">Router Decision Gate</span>
                  <span className="decision-result mono">
                    {computeMode === 'local' && 'LOCAL ONLINE -> ROUTING TO RTX 3050 ($0.00)'}
                    {computeMode === 'burst' && 'LOCAL OFFLINE -> CHECK BUDGET: $0.35 / $2.00 -> BURSTING'}
                    {computeMode === 'queue' && 'LOCAL OFFLINE -> BUDGET EXCEEDED: $2.00 / $2.00 -> HOLDING IN QUEUE'}
                  </span>
                </div>

                {/* Split Branches */}
                <div className="routing-branches-grid">
                  {/* Branch A: Local RTX 3050 */}
                  <div className={`routing-branch-card ${computeMode === 'local' ? 'active-path' : 'inactive-path'}`}>
                    <div className="branch-header">
                      <span className="branch-badge">$0 DEFAULT PATH</span>
                      {computeMode === 'local' && <span className="active-pill">ACTIVE DISPATCH</span>}
                    </div>
                    <h3 className="branch-name">Local RTX 3050 Worker</h3>
                    <p className="branch-desc">
                      Processes LLM, neural voice, and FFmpeg assembly entirely on your local silicon.
                    </p>
                    <div className="branch-stat">Cost: $0.00 · Latency: 0ms · API Bill: $0.00</div>
                  </div>

                  {/* Branch B: Cloud Burst Fallback */}
                  <div className={`routing-branch-card ${computeMode === 'burst' ? 'active-path' : 'inactive-path'}`}>
                    <div className="branch-header">
                      <span className="branch-badge">BUDGET PROTECTED</span>
                      {computeMode === 'burst' && <span className="active-pill">BURSTING TO CLOUD</span>}
                    </div>
                    <h3 className="branch-name">Cloud Burst Serverless</h3>
                    <p className="branch-desc">
                      Bursts to cloud container only while under today's $2.00 spend cap. Never overspends.
                    </p>
                    <div className="branch-stat">Daily Cap: $2.00 · Spent: $0.35 · Remaining: $1.65</div>
                  </div>

                  {/* Branch C: Safety Queue Gate */}
                  <div className={`routing-branch-card ${computeMode === 'queue' ? 'active-path' : 'inactive-path'}`}>
                    <div className="branch-header">
                      <span className="branch-badge">SAFETY SHIELD</span>
                      {computeMode === 'queue' && <span className="active-pill red">HOLDING IN QUEUE</span>}
                    </div>
                    <h3 className="branch-name">Zero-Cost Queue Guard</h3>
                    <p className="branch-desc">
                      Halts cloud metered jobs when the budget cap is reached. Safely holds jobs until your local PC wakes up.
                    </p>
                    <div className="branch-stat">Status: Queued · Cost Incurred: $0.00</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 9. Studio & Storyboard Workstation ───────────────────────────── */}
        <section id="studio" className="studio-section">
          <div className="section-container">
            <div className="section-header">
              <span className="section-eyebrow">CREATIVE WORKSTATION</span>
              <h2 className="section-headline">A genuine production workstation.</h2>
              <p className="section-description">
                Not a form. A three-pane creative studio that gives you frame-by-frame control over scene boundaries, narration scripts, and typography.
              </p>
            </div>

            {/* Three-Pane Studio Mockup */}
            <div className="studio-suite-chassis">
              {/* Top Navigation Bar */}
              <div className="studio-topbar">
                <div className="studio-tabs">
                  <div className="st-tab active">
                    <Sliders size={14} />
                    <span>Interactive Storyboard Inspector (Live Editing)</span>
                  </div>
                </div>
                <div className="studio-controls">
                  <span className="aspect-pill">9:16 VERTICAL SHORT</span>
                  <Link to="/app/create" className="btn-studio-run">Launch Project</Link>
                </div>
              </div>

              {/* Three-Pane Main Workspace */}
              <div className="studio-three-pane">
                {/* Left Pane: Scenes & Stages Rail */}
                <div className="studio-rail-pane">
                  <span className="pane-title">STORY SCENES ({studioScenes.length})</span>
                  <div className="scene-rail-list">
                    {studioScenes.map((sc, i) => (
                      <div
                        key={sc.idx}
                        className={`scene-rail-item ${selectedStudioScene === i ? 'active' : ''}`}
                        onClick={() => setSelectedStudioScene(i)}
                      >
                        <div className="s-header">
                          <span className="s-idx">{sc.idx}</span>
                          <span className="s-dur">{sc.time}</span>
                        </div>
                        <p className="s-snip">{sc.narration}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Center Pane: 9:16 Canvas with Subtitle Positioning */}
                <div className="studio-canvas-pane">
                  <div className="canvas-frame-outer">
                    <div className="canvas-frame-inner">
                      <div className="canvas-video-sim">
                        <div className="canvas-watermark">AUTOTUBE_AI // LIVE PREVIEW</div>
                        <div className="canvas-karaoke-sub bold-centered">
                          <span>{activeSceneData.narration}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Pane: Scene Inspector */}
                <div className="studio-inspector-pane">
                  <span className="pane-title">{activeSceneData.idx} INSPECTOR</span>
                  <div className="inspector-fields">
                    <div className="field-group">
                      <label className="field-lbl">NARRATION SCRIPT (EDITABLE LIVE)</label>
                      <textarea
                        className="field-textarea"
                        rows={3}
                        value={activeSceneData.narration}
                        onChange={(e) => handleStudioNarrationChange(e.target.value)}
                        placeholder="Type narration to see subtitle update on canvas..."
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-lbl">VISUAL INTENT & MOOD</label>
                      <input
                        readOnly
                        className="field-input"
                        value={activeSceneData.visual}
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-lbl">VOICE PROFILE</label>
                      <div className="field-val-pill">{activeSceneData.voice}</div>
                    </div>
                    <div className="field-group">
                      <label className="field-lbl">CAPTION STYLE</label>
                      <div className="field-val-pill">{activeSceneData.style}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 10. Final Call to Action ─────────────────────────────────────── */}
        <section className="final-cta-section">
          <div className="section-container">
            <div className="cta-box-card">
              <span className="cta-eyebrow">READY FOR AUTONOMOUS PRODUCTION</span>
              <h2 className="cta-headline">The queue doesn't wait for you to get home.</h2>
              <p className="cta-description">
                Open the studio, configure your niche, and let your production pipeline do the heavy lifting.
              </p>
              <div className="cta-action-wrap">
                <Link to="/app" className="btn-cta-giant">
                  <span>Open the Studio</span>
                  <ArrowRight size={18} />
                </Link>
              </div>
              <div className="cta-foot-metadata">
                <span>Free & Open-Source Core</span>
                <span>·</span>
                <span>Local RTX 3050 Optimized</span>
                <span>·</span>
                <span>Zero Subscription Lock-in</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── 11. Minimal Editorial Footer ─────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-top-row">
            <div className="footer-brand-block">
              <div className="brand-lockup">
                <span className="brand-dot"></span>
                <span className="brand-title">AutoTube_AI</span>
              </div>
              <p className="footer-tagline">
                Autonomous local-first YouTube Shorts production studio.
              </p>
            </div>

            <div className="footer-links-grid">
              <div className="footer-col">
                <span className="footer-col-title">SYSTEM</span>
                <a href="#pipeline">Production Pipeline</a>
                <a href="#away-mode">While You're Away</a>
                <a href="#command-center">Command Center</a>
              </div>
              <div className="footer-col">
                <span className="footer-col-title">COMPUTE</span>
                <a href="#local-first">Local GPU Routing</a>
                <a href="#best-content">Best Selection Engine</a>
                <a href="#studio">Studio Workstation</a>
              </div>
              <div className="footer-col">
                <span className="footer-col-title">WORKSPACE</span>
                <Link to="/app">Studio Dashboard</Link>
                <Link to="/app/create">Generate Short</Link>
                <Link to="/app/videos">Review Queue</Link>
              </div>
            </div>
          </div>

          <div className="footer-bottom-row">
            <span className="footer-copy">
              &copy; {new Date().getFullYear()} AutoTube_AI. Built for creators who refuse to sacrifice control.
            </span>
            <span className="footer-status-pill">
              <span className="dot green"></span>
              ALL SYSTEMS OPERATIONAL
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
