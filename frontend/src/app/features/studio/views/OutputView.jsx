import React, { useState, useEffect } from 'react';
import { api } from '../../../../services/api';
import Icon from '../../../../components/Icon';
import Button from '../../../../components/Button';
import useStudioStore from '../../../../store/studioStore';

export default function OutputView({ onPublish }) {
  const script = useStudioStore((s) => s.script);
  const selectedStyle = useStudioStore((s) => s.selectedStyle);
  const selectedCaption = useStudioStore((s) => s.selectedCaption);
  const selectedVoice = useStudioStore((s) => s.selectedVoice);
  const selectedVisualStrategy = useStudioStore((s) => s.selectedVisualStrategy);

  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(null);
  const [videoId, setVideoId] = useState(null);
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
          setError(prog.notes || 'Unknown render error occurred');
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
        voice_override: selectedVoice,
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
      setError(e.message);
    }
  };

  const isDone = renderProgress && (DONE_STATUSES.includes(renderProgress.status) || renderProgress.render_stage === 'done');
  let videoUrl = renderProgress?.url;
  if (videoUrl && videoUrl.startsWith('/api')) {
      const token = localStorage.getItem('autotube_auth_token');
      if (token) {
          videoUrl = `${videoUrl}${videoUrl.includes('?') ? '&' : '?'}token=${token}`;
      }
      // Apply base api url if it's a relative /api route, otherwise it might not proxy properly depending on `<video>` usage
      const baseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
      if (baseUrl) {
          videoUrl = `${baseUrl.replace(/\/$/, '')}${videoUrl}`;
      }
  }

  return (
    <div className="flex-1 p-6 lg:p-10 overflow-y-auto hide-scrollbar space-y-8 bg-surface">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Final Output</h2>
          <p className="text-sm text-text-secondary">Render and preview your video.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8">
        <div className="flex-1 space-y-6">
          <div className="bg-canvas border border-border rounded-xl p-6">
            <h3 className="text-sm font-bold mb-4">Rendering Settings</h3>
            <p className="text-xs text-text-secondary mb-4">Settings are populated from your pipeline preferences.</p>
            <div className="space-y-3">
               <div className="flex justify-between border-b border-border/50 pb-2">
                 <span className="text-xs text-text-muted">Style</span>
                 <span className="text-xs font-mono">{selectedStyle}</span>
               </div>
               <div className="flex justify-between border-b border-border/50 pb-2">
                 <span className="text-xs text-text-muted">Voice</span>
                 <span className="text-xs font-mono">{selectedVoice}</span>
               </div>
            </div>

            <div className="mt-6">
              {!rendering && !isDone && (
                <Button variant="primary" onClick={startRender} className="w-full">
                  Start Rendering
                </Button>
              )}
              {rendering && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-brand-red">
                    <span>{renderProgress?.render_stage || 'Initializing...'}</span>
                    <span>{renderProgress?.progress_percent || 0}%</span>
                  </div>
                  <div className="h-2 bg-surface-input rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-red transition-all duration-300"
                      style={{ width: `${renderProgress?.progress_percent || 5}%` }}
                    />
                  </div>
                </div>
              )}
              {error && (
                <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger">
                  Error: {error}
                </div>
              )}
              {isDone && (
                <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-lg text-xs text-success flex items-center justify-between">
                  <span>Render Complete!</span>
                  <Button variant="primary" size="sm" onClick={onPublish}>Publish</Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-[300px] shrink-0">
          <div className="aspect-[9/16] bg-canvas border border-border rounded-2xl overflow-hidden shadow-card relative flex items-center justify-center">
            {isDone && videoUrl ? (
              <video src={videoUrl} controls className="w-full h-full object-cover" />
            ) : isDone && !videoUrl ? (
               <div className="text-center p-4">
                 <Icon name="check-circle" size={48} className="text-success mx-auto mb-2" />
                 <p className="text-xs text-text-muted">Video rendered successfully but no preview URL found.</p>
               </div>
            ) : rendering ? (
              <div className="text-center">
                <Icon name="loader" size={32} className="text-brand-red animate-spin mx-auto mb-2" />
                <p className="text-xs text-text-muted">Rendering...</p>
              </div>
            ) : (
              <div className="text-center">
                <Icon name="video" size={32} className="text-text-muted mx-auto mb-2" />
                <p className="text-xs text-text-muted">Preview will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
