import React, { useState, useEffect } from 'react';
import { api } from '../../../../services/api';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';

export default function OutputView({ onPublish }) {
  const script = useStudioStore((s) => s.script);
  const editingScenes = useStudioStore((s) => s.editingScenes);
  const selectedStyle = useStudioStore((s) => s.selectedStyle);
  const selectedCaption = useStudioStore((s) => s.selectedCaption);
  const voiceSettings = useStudioStore((s) => s.voiceSettings);
  const selectedVisualStrategy = useStudioStore((s) => s.selectedVisualStrategy);

  const renderStore = useStudioStore((s) => s.render);
  const [rendering, setRendering] = useState(!!renderStore?.videoId);
  const [renderProgress, setRenderProgress] = useState(null);
  const [videoId, setVideoId] = useState(renderStore?.videoId || null);
  const [error, setError] = useState(null);

  const DONE_STATUSES = ['ready', 'approved', 'uploaded'];

  useEffect(() => {
    if (!videoId || !rendering) return;
    const iv = setInterval(async () => {
      try {
        const prog = await api.getVideoProgress(videoId);
        setRenderProgress(prog);

        if (DONE_STATUSES.includes(prog.status) || prog.render_stage === 'done') {
          setRendering(false);
          try {
             const previewData = await api.getVideoPreviewUrl(videoId);
             setRenderProgress(prev => ({ ...prev, url: previewData.url }));
          } catch (e) { console.error("Failed to fetch preview URL", e); }

          if (!DONE_STATUSES.includes(prog.status)) {
            setTimeout(async () => {
              try {
                const final = await api.getVideoProgress(videoId);
                const prev = await api.getVideoPreviewUrl(videoId);
                setRenderProgress({ ...final, url: prev.url });
              } catch (_) {}
            }, 1500);
          }
        } else if (prog.status === 'failed') {
          setRendering(false);
          setError(prog.notes || 'Unknown render error occurred during generation.');
        }
      } catch (e) {
        console.error(e);
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [videoId, rendering]);

  const startRender = async () => {
    if (!script) return;
    setRendering(true);
    setError(null);
    setRenderProgress(null);
    try {
      const opts = {
        script_id: script.id,
        style: selectedStyle,
        caption_style: selectedCaption,
        custom_cta: null,
        voice_override: voiceSettings?.voiceId,
        visual_strategy: selectedVisualStrategy,
        content_type: script.body?.content_type || 'short',
        target_duration_seconds: script.body?.target_duration || 30,
        orientation: script.body?.format_type || '9:16',
        quality: 'standard'
      };
      const video = await api.renderVideoFull(opts);
      setVideoId(video.id);
    } catch (e) {
      setRendering(false);
      setError(e.message || "Failed to start render");
    }
  };

  const isDone = renderProgress && (DONE_STATUSES.includes(renderProgress.status) || renderProgress.render_stage === 'done');

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

  // Production Checks Logic
  const checks = {
    script: script ? true : false,
    scenes: editingScenes?.length > 0 ? true : false,
    visuals: editingScenes?.every(s => s.asset_id || s.image_url || s.asset_url) ? true : false,
    voice: voiceSettings?.voiceId ? true : false,
    captions: selectedCaption ? true : false
  };

  const qualityScore = Object.values(checks).filter(Boolean).length * 20;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-canvas">

      {/* ── LEFT: Preview (40%) ──────────────────────────────────────── */}
      <div className="w-full md:w-[45%] border-r border-border/50 bg-surface/30 p-8 flex flex-col items-center justify-center relative md:overflow-hidden shrink-0 md:shrink min-h-[500px] md:min-h-0">
         {/* Subtle background glow when done */}
         {isDone && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-success/10 rounded-full blur-[100px] pointer-events-none"></div>}

         <div className="h-full max-h-[700px] aspect-[9/16] bg-canvas border border-border/50 rounded-[2rem] shadow-2xl relative flex items-center justify-center overflow-hidden z-10 group">

           {isDone && videoUrl ? (
             <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover" />
           ) : isDone && !videoUrl ? (
             <div className="text-center p-8">
               <Icon name="check-circle" size={48} className="text-success mx-auto mb-4" />
               <p className="text-lg font-bold text-text-primary mb-2">Video Rendered</p>
               <p className="text-xs text-text-muted">The video was created successfully, but the preview stream is unavailable.</p>
             </div>
           ) : rendering ? (
             <div className="text-center p-8 w-full flex flex-col items-center justify-center bg-surface/30 h-full">
                <div className="relative mb-6">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="4" fill="none" className="text-border" />
                    <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="4" fill="none" className="text-brand-red transition-all duration-300" strokeDasharray="276" strokeDashoffset={276 - (276 * (renderProgress?.progress || 0)) / 100} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-lg font-black text-text-primary">{renderProgress?.progress || 0}%</span>
                  </div>
                </div>
                <p className="text-sm font-bold uppercase tracking-widest text-brand-red animate-pulse">
                   {renderProgress?.render_stage || 'Initializing Engine...'}
                </p>
             </div>
           ) : error ? (
             <div className="text-center p-8 bg-danger/5 w-full h-full flex flex-col items-center justify-center">
               <div className="w-16 h-16 rounded-full bg-danger/20 flex items-center justify-center mb-4">
                 <Icon name="alert-triangle" size={32} className="text-danger" />
               </div>
               <p className="text-lg font-bold text-text-primary mb-2">Render Failed</p>
               <p className="text-xs text-text-secondary max-w-[200px] mx-auto">{error}</p>
             </div>
           ) : (
             <div className="text-center p-8 bg-surface/30 w-full h-full flex flex-col items-center justify-center opacity-60">
               <Icon name="film" size={48} className="text-border mb-4" />
               <p className="text-base font-bold text-text-primary mb-1">Final Output</p>
               <p className="text-xs text-text-muted">Your video will appear here.</p>
             </div>
           )}

         </div>
      </div>

      {/* ── RIGHT: Production Check (55%) ──────────────────────────────────────── */}
      <div className="w-full md:w-[55%] bg-surface p-8 lg:p-12 md:overflow-y-auto hide-scrollbar shrink-0 md:shrink min-h-[400px] md:min-h-0">
         <div className="max-w-xl mx-auto space-y-10">

            <div>
              <h2 className="text-3xl font-bold tracking-tight text-text-primary mb-2 uppercase">Final Review</h2>
              <p className="text-sm text-text-secondary">Verify production readiness before starting the render engine.</p>
            </div>

            <div className="bg-canvas border border-border/60 rounded-2xl overflow-hidden shadow-sm">
               <div className="p-5 border-b border-border/50 flex items-center justify-between bg-surface/30">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-text-primary">Production Check</h3>
                 <div className="flex items-center gap-3">
                   <span className="text-[10px] uppercase font-bold text-text-muted">Quality Score</span>
                   <span className={`text-sm font-black px-2 py-0.5 rounded ${qualityScore === 100 ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                     {qualityScore}
                   </span>
                 </div>
               </div>

               <div className="p-2">
                 <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-hover transition-colors">
                   <div className="flex items-center gap-3">
                     <Icon name={checks.script ? "check-circle" : "circle"} size={16} className={checks.script ? "text-success" : "text-border"} />
                     <span className="text-sm font-semibold text-text-primary">Script ready</span>
                   </div>
                 </div>
                 <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-hover transition-colors">
                   <div className="flex items-center gap-3">
                     <Icon name={checks.scenes ? "check-circle" : "circle"} size={16} className={checks.scenes ? "text-success" : "text-border"} />
                     <span className="text-sm font-semibold text-text-primary">{editingScenes?.length || 0} Scenes planned</span>
                   </div>
                 </div>
                 <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-hover transition-colors">
                   <div className="flex items-center gap-3">
                     <Icon name={checks.visuals ? "check-circle" : "alert-circle"} size={16} className={checks.visuals ? "text-success" : "text-warning"} />
                     <span className="text-sm font-semibold text-text-primary">Visuals assigned</span>
                   </div>
                   {!checks.visuals && <span className="text-[10px] bg-warning/10 text-warning px-2 py-1 rounded font-bold uppercase">Missing Assets</span>}
                 </div>
                 <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-hover transition-colors">
                   <div className="flex items-center gap-3">
                     <Icon name={checks.voice ? "check-circle" : "alert-circle"} size={16} className={checks.voice ? "text-success" : "text-warning"} />
                     <span className="text-sm font-semibold text-text-primary">Voice ready</span>
                   </div>
                   {!checks.voice && <span className="text-[10px] bg-warning/10 text-warning px-2 py-1 rounded font-bold uppercase">Default Voice</span>}
                 </div>
                 <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-hover transition-colors">
                   <div className="flex items-center gap-3">
                     <Icon name={checks.captions ? "check-circle" : "alert-circle"} size={16} className={checks.captions ? "text-success" : "text-warning"} />
                     <span className="text-sm font-semibold text-text-primary">Captions ready</span>
                   </div>
                 </div>
               </div>
            </div>

            {error && (
              <div className="bg-danger/5 border border-danger/20 rounded-xl p-5 flex flex-col items-start gap-4">
                 <p className="text-sm font-bold text-danger">Render couldn't finish</p>
                 <p className="text-xs text-text-secondary leading-relaxed">{error}</p>
                 <div className="flex flex-wrap gap-3">
                    <button onClick={startRender} className="bg-danger text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-danger/90">
                      Retry Render
                    </button>
                    <button className="bg-surface text-text-primary border border-border px-4 py-2 rounded-lg text-xs font-bold hover:bg-elevated transition-colors">
                      Edit Scene
                    </button>
                    <button className="bg-surface text-text-primary border border-border px-4 py-2 rounded-lg text-xs font-bold hover:bg-elevated transition-colors">
                      Use Fallback Visual
                    </button>
                 </div>
              </div>
            )}

            {!error && !rendering && !isDone && (
               <div className="pt-4">
                 <button
                   onClick={startRender}
                   className="w-full bg-brand-red text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-[0_4px_20px_0_rgba(230,57,47,0.4)] hover:-translate-y-1 hover:shadow-[0_6px_25px_rgba(230,57,47,0.5)] transition-all flex items-center justify-center gap-3"
                 >
                   Render Video <Icon name="zap" size={16} />
                 </button>
               </div>
            )}

            {isDone && (
               <div className="pt-4 space-y-4">
                 <div className="bg-success/10 border border-success/20 rounded-xl p-6 text-center">
                   <h3 className="text-lg font-bold text-success mb-2">Ready to Publish</h3>
                   <p className="text-xs text-text-secondary">This video meets production requirements and is ready for distribution.</p>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   <button
                     onClick={() => onPublish({ id: videoId, title: script?.topic, description: script?.topic })}
                     className="bg-brand-red text-white py-3.5 rounded-xl font-bold text-sm shadow-[0_4px_15px_0_rgba(230,57,47,0.3)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                   >
                     Publish Now <Icon name="arrow-up-right" size={16} />
                   </button>
                   <button
                     className="bg-surface text-text-primary border border-border py-3.5 rounded-xl font-bold text-sm hover:bg-elevated transition-all flex items-center justify-center gap-2"
                   >
                     Schedule <Icon name="calendar" size={16} />
                   </button>
                 </div>
               </div>
            )}

         </div>
      </div>

    </div>
  );
}
