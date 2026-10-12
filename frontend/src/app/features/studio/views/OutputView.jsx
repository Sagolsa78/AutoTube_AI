import React, { useState, useEffect } from 'react';
import { api } from '../../../../services/api';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';
import { toast } from 'sonner';

export default function OutputView({ onPublish }) {
  const script = useStudioStore((s) => s.script);
  const editingScenes = useStudioStore((s) => s.editingScenes);
  const project = useStudioStore((s) => s.project);
  const audio = useStudioStore((s) => s.audio);
  const renderState = useStudioStore((s) => s.render);
  const setRender = useStudioStore((s) => s.setRender);
  const pipelineState = useStudioStore((s) => s.pipelineState) || {};

  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [error, setError] = useState(null);

  const DONE_STATUSES = ['ready', 'approved', 'uploaded'];

  // Initialize state correctly on mount from store
  useEffect(() => {
    if (renderState?.videoId && renderState?.status) {
      setVideoId(renderState.videoId);
      if (['in_progress', 'queued', 'generating', 'processing', 'rendering'].includes(renderState.status)) {
        setRendering(true);
      }
    }
  }, [renderState?.videoId, renderState?.status]);

  useEffect(() => {
    if (!videoId || !rendering) return;
    const iv = setInterval(async () => {
      try {
        const prog = await api.getVideoProgress(videoId);
        setRenderProgress(prog);

        if (DONE_STATUSES.includes(prog.status) || prog.render_stage === 'done') {
          setRendering(false);
          setRender({ status: prog.status, stage: 'done' });
          try {
            const previewData = await api.getVideoPreviewUrl(videoId);
            setRenderProgress(prev => ({ ...prev, url: previewData.url }));
          } catch (e) { console.error("Failed to fetch preview URL", e); }
        } else if (prog.status === 'failed' || prog.status === 'render_failed' || prog.status === 'publish_failed') {
          setRendering(false);
          setRender({ status: 'failed' });
          setError(prog.notes || 'Unknown render error occurred during generation.');
        }
      } catch (e) {
        console.error(e);
      }
    }, 2500);
    return () => clearInterval(iv);
  }, [videoId, rendering]);

  const startRender = async () => {
    if (!script) {
      toast.error("No script available. Generate a script first.");
      return;
    }
    setRendering(true);
    setError(null);
    setRenderProgress(null);
    try {
      const opts = {
        script_id: script.id,
        style: 'cinematic',
        caption_style: 'auto',
        custom_cta: null,
        voice_override: audio?.voice,
        visual_strategy: project?.visualStrategy || 'auto',
        content_type: project?.contentType || 'short',
        target_duration_seconds: project?.targetDuration || 30,
        orientation: project?.contentType === 'long' ? '16:9' : '9:16',
        quality: 'standard'
      };
      const video = await api.renderVideoFull(opts);
      setVideoId(video.id);
      setRender({ videoId: video.id, status: 'rendering' });
      toast.success("Render job started!");
    } catch (e) {
      setRendering(false);
      setError(e.message || "Failed to start render");
      toast.error("Render failed: " + e.message);
    }
  };

  const handleDownload = async () => {
    if (!videoId) return;
    try {
      toast.info("Preparing download...");
      const res = await api.downloadVideo(videoId);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${script?.topic || 'autotube-video'}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Download failed: " + err.message);
    }
  };

  // State Definitions
  const isDone = renderProgress && (DONE_STATUSES.includes(renderProgress.status) || renderProgress.render_stage === 'done');
  const hasError = !!error || renderProgress?.status === 'failed';
  const isStateA = !rendering && !isDone && !hasError;
  const isStateB = rendering;

  let videoUrl = renderProgress?.url;
  if (videoUrl && videoUrl.startsWith('/api')) {
    const token = localStorage.getItem('autotube_auth_token');
    if (token) {
      videoUrl = `${videoUrl}${videoUrl.includes('?') ? '&' : '?'}token=${token}`;
    }
    const baseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
    if (baseUrl) {
      videoUrl = `${baseUrl.replace(/\/$/, '')}${videoUrl}`;
    }
  }

  // Production Checks Logic based on pipelineState
  const blockingIssues = pipelineState.blockingIssues || [];
  const warnings = pipelineState.warnings || [];

  const checks = {
    script: !!script,
    scenes: editingScenes?.length > 0,
    visuals: !blockingIssues.includes('MISSING_ASSETS'),
    voice: !warnings.includes('DEFAULT_VOICE'),
    captions: true // default to true for simplicity
  };

  const qualityScore = Math.min(100, Object.values(checks).filter(Boolean).length * 20);

  const formatLabel = project?.contentType === 'long' ? '16:9 Landscape' : '9:16 Vertical';
  const resolutionLabel = project?.contentType === 'long' ? '1920×1080' : '1080×1920';
  const durationLabel = project?.targetDuration || 30;
  const languageLabel = audio?.language === 'hi' ? 'Hindi' : audio?.language === 'es' ? 'Spanish' : 'English';

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-canvas">

      {/* ── LEFT: Preview (45%) ──────────────────────────────────────── */}
      <div className="w-full md:w-[45%] border-r border-border/50 bg-surface/40 p-8 flex flex-col items-center justify-center relative md:overflow-hidden shrink-0 md:shrink min-h-[500px] md:min-h-0 isolate">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-ai/5 via-transparent to-transparent opacity-50 -z-10"></div>

        {/* Subtle background glow when done */}
        {isDone && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-red/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>}

        <div className="h-full max-h-[700px] aspect-[9/16] bg-canvas border border-border/50 rounded-[2rem] shadow-2xl relative flex items-center justify-center overflow-hidden z-10 group">

          {isDone && videoUrl ? (
            <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover" />
          ) : isDone && !videoUrl ? (
            <div className="text-center p-8 w-full flex flex-col items-center justify-center bg-surface/50 h-full backdrop-blur-sm animate-in">
              <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6 shadow-ai-glow border border-success/20">
                <Icon name="check" size={40} className="text-success" />
              </div>
              <p className="text-2xl font-black uppercase tracking-wider text-text-primary mb-2">Video Ready</p>
              <p className="text-xs text-text-muted max-w-[220px]">The video was created successfully. Check the controls on the right to download or publish.</p>
            </div>
          ) : isStateB ? (
            <div className="text-center p-8 w-full flex flex-col items-center justify-center bg-canvas/80 h-full backdrop-blur-md relative isolate">

              {/* Advanced Rendering Visuals */}
              <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none -z-10">
                <div className="w-64 h-64 border border-brand-red/20 rounded-full animate-[spin_10s_linear_infinite]" />
                <div className="w-48 h-48 border border-brand-red/40 rounded-full animate-[spin_7s_linear_infinite_reverse] absolute" />
              </div>

              <div className="relative mb-8">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="2" fill="none" className="text-border/40" />
                  <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="4" fill="none" className="text-brand-red transition-all duration-300 drop-shadow-[0_0_8px_rgba(230,57,47,0.8)]" strokeDasharray="377" strokeDashoffset={377 - (377 * (renderProgress?.progress || 0)) / 100} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-3xl font-black text-text-primary tracking-tighter">{renderProgress?.progress || 0}<span className="text-lg text-brand-red">%</span></span>
                </div>
              </div>

              <div className="w-full max-w-xs mt-8">
                <div className="flex flex-col gap-3">
                  {['Script', 'Voice', 'Visuals', 'Compositing', 'Encoding', 'Final QA'].map((step, idx) => {
                    let status = 'pending';
                    const stageLower = (renderProgress?.render_stage || '').toLowerCase();

                    if (['done', 'final qa'].includes(stageLower)) {
                      if (idx < 5) status = 'done';
                      else if (stageLower === 'final qa' && idx === 5) status = 'current';
                      else if (stageLower === 'done') status = 'done';
                    } else if (stageLower.includes('compositing') || stageLower.includes('render')) {
                      if (idx < 3) status = 'done';
                      else if (idx === 3) status = 'current';
                    } else if (stageLower.includes('encoding')) {
                      if (idx < 4) status = 'done';
                      else if (idx === 4) status = 'current';
                    } else if (stageLower.includes('voice') || stageLower.includes('tts')) {
                      if (idx < 1) status = 'done';
                      else if (idx === 1) status = 'current';
                    } else if (stageLower.includes('visual') || stageLower.includes('asset')) {
                      if (idx < 2) status = 'done';
                      else if (idx === 2) status = 'current';
                    } else {
                      // Default: assume script is done, compositing is current
                      if (idx < 1) status = 'done';
                      else if (idx === 0) status = 'current';
                    }

                    return (
                      <div key={step} className="flex items-center gap-3">
                        {status === 'done' && <Icon name="check-circle" size={16} className="text-success" />}
                        {status === 'current' && <Icon name="circle" size={16} className="text-brand-red fill-brand-red animate-pulse" />}
                        {status === 'pending' && <Icon name="circle" size={16} className="text-border" />}
                        <span className={`text-sm font-bold ${status === 'current' ? 'text-text-primary' : status === 'done' ? 'text-text-secondary' : 'text-text-muted'}`}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : hasError ? (
            <div className="text-center p-8 bg-danger/5 w-full h-full flex flex-col items-center justify-center border border-danger/10 animate-in">
              <div className="w-16 h-16 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center mb-4">
                <Icon name="alert-triangle" size={32} className="text-danger" />
              </div>
              <p className="text-lg font-bold text-text-primary mb-2">Render Failed</p>
              <p className="text-xs text-text-secondary max-w-[240px] mx-auto text-center">{error}</p>
            </div>
          ) : (
            <div className="text-center p-8 bg-surface/30 w-full h-full flex flex-col items-center justify-center">
              <div className="w-32 h-32 rounded-full border-4 border-dashed border-border flex items-center justify-center mb-6 group-hover:border-brand-red/30 transition-colors">
                <Icon name="play" size={48} className="text-border ml-2 group-hover:text-brand-red/50 transition-colors" />
              </div>
              <p className="text-2xl font-black uppercase tracking-wider text-text-primary mb-2">Ready to Render</p>
              <p className="text-sm text-text-secondary max-w-[280px]">Your project assets are queued up. Start the render engine when you're ready.</p>
            </div>
          )}

        </div>
      </div>

      {/* ── RIGHT: Production Check (55%) ──────────────────────────────────────── */}
      <div className="w-full md:w-[55%] bg-surface p-8 lg:p-12 md:overflow-y-auto hide-scrollbar shrink-0 md:shrink min-h-[400px] md:min-h-0">
        <div className="max-w-xl mx-auto space-y-10 animate-in">

          <div>
            <h2 className="text-3xl font-bold tracking-tight text-text-primary mb-2 uppercase">Final Review</h2>
            <p className="text-sm text-text-secondary">Verify production readiness before starting the render engine.</p>
          </div>

          <div className="bg-canvas border border-border/60 rounded-2xl overflow-hidden shadow-card-subtle">
            <div className="p-5 border-b border-border/50 flex items-center justify-between bg-surface/30">
              <h3 className="text-xs font-bold uppercase tracking-widest text-text-primary">Production Check</h3>
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold text-text-muted">Quality Score</span>
                <span className={`text-sm font-black px-2.5 py-0.5 rounded-lg ${qualityScore === 100 ? 'bg-success/20 text-success border border-success/20' : qualityScore >= 60 ? 'bg-warning/20 text-warning border border-warning/20' : 'bg-danger/20 text-danger border border-danger/20'}`}>
                  {qualityScore}
                </span>
              </div>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4 border-b border-border/50 bg-canvas/30">
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Format & Resolution</div>
                <div className="text-xs font-bold text-text-primary">{formatLabel} • {resolutionLabel}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Duration & Language</div>
                <div className="text-xs font-bold text-text-primary">~{durationLabel} sec • {languageLabel}</div>
              </div>
            </div>

            {isStateA && (
              <div className="p-2">
                {[
                  { label: 'Script ready', check: checks.script, icon: checks.script ? 'check-circle' : 'circle', color: checks.script ? 'text-success' : 'text-border' },
                  { label: `${editingScenes?.length || 0} Scenes planned`, check: checks.scenes, icon: checks.scenes ? 'check-circle' : 'circle', color: checks.scenes ? 'text-success' : 'text-border' },
                  { label: 'Visuals assigned', check: checks.visuals, icon: checks.visuals ? 'check-circle' : 'alert-circle', color: checks.visuals ? 'text-success' : 'text-danger', badge: !checks.visuals ? 'Missing Assets' : null, badgeColor: 'text-danger bg-danger/10' },
                  { label: 'Voice ready', check: checks.voice, icon: checks.voice ? 'check-circle' : 'alert-circle', color: checks.voice ? 'text-success' : 'text-warning', badge: !checks.voice ? 'Default Voice' : null, badgeColor: 'text-warning bg-warning/10' },
                  { label: 'Captions ready', check: checks.captions, icon: checks.captions ? 'check-circle' : 'alert-circle', color: checks.captions ? 'text-success' : 'text-warning' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-elevated transition-colors">
                    <div className="flex items-center gap-3">
                      <Icon name={item.icon} size={16} className={item.color} />
                      <span className="text-sm font-semibold text-text-primary">{item.label}</span>
                    </div>
                    {item.badge && <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${item.badgeColor}`}>{item.badge}</span>}
                  </div>
                ))}
              </div>
            )}

            {!isStateA && (
              <div className="p-8 text-center bg-surface/30 flex items-center justify-center">
                <p className="text-sm font-bold text-success flex items-center gap-2"><Icon name="check-circle" size={18} /> Production Checklist Completed</p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-danger/5 border border-danger/20 rounded-xl p-5 flex flex-col items-start gap-4 animate-in">
              <p className="text-sm font-bold text-danger">Render couldn't finish</p>
              <p className="text-xs text-text-secondary leading-relaxed">{error}</p>
              <div className="flex flex-wrap gap-3">
                <button onClick={startRender} className="bg-danger text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-danger/90 transition-colors">
                  Retry Render
                </button>
                <button onClick={() => { setError(null); setRendering(false); }} className="bg-surface text-text-primary border border-border px-4 py-2 rounded-lg text-xs font-bold hover:bg-elevated transition-colors">
                  Dismiss Error
                </button>
              </div>
            </div>
          )}

          {isStateA && (
            <div className="pt-4 space-y-3">
              <button
                onClick={startRender}
                disabled={blockingIssues.length > 0}
                className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
                  blockingIssues.length > 0
                  ? 'bg-surface border border-border text-text-muted cursor-not-allowed opacity-50'
                  : 'bg-brand-red text-white shadow-[0_4px_20px_0_rgba(230,57,47,0.4)] hover:-translate-y-1 hover:shadow-[0_6px_25px_rgba(230,57,47,0.5)]'
                }`}
              >
                Render Video <Icon name="zap" size={16} />
              </button>
              {blockingIssues.length > 0 && (
                <p className="text-[10px] text-danger text-center font-bold uppercase tracking-wider">Please resolve blocking issues to render.</p>
              )}
            </div>
          )}

          {isDone && (
            <div className="pt-2 space-y-6 animate-in">

              {/* Metadata */}
              <div className="bg-surface/50 border border-border/40 rounded-2xl p-6 shadow-sm space-y-4 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-brand-red transition-all group-hover:w-1.5" />

                <div className="space-y-1.5 pl-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Title</label>
                  <p className="text-sm font-semibold text-text-primary leading-snug">{script?.topic || 'Untitled Video'}</p>
                </div>

                <div className="space-y-1.5 pl-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Description</label>
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">Generated by AutoTube AI. A detailed exploration of {script?.topic || 'the topic'}.</p>
                </div>

                <div className="space-y-1.5 pl-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Tags</label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['AutoTube', 'AI', 'Generated'].map(tag => (
                      <span key={tag} className="text-[10px] font-bold bg-canvas border border-border/60 text-text-secondary px-2.5 py-1 rounded-full uppercase tracking-wider">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => onPublish({ id: videoId, title: script?.topic, description: script?.topic })}
                  className="sm:col-span-2 bg-brand-red text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-brand-glow hover:-translate-y-1 hover:shadow-lg transition-all flex items-center justify-center gap-3"
                >
                  Publish Video <Icon name="arrow-up-right" size={16} />
                </button>
                <button
                  onClick={handleDownload}
                  className="bg-surface text-text-primary border border-border py-3.5 rounded-xl font-bold text-xs hover:bg-elevated hover:border-text-muted transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Icon name="download" size={14} /> Download MP4
                </button>
                <button
                  onClick={startRender}
                  className="bg-surface text-text-primary border border-border py-3.5 rounded-xl font-bold text-xs hover:bg-elevated hover:border-text-muted transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Icon name="refresh-cw" size={14} /> Render Again
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
