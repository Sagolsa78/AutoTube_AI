import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import Icon from '../../../components/Icon';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/Card';
import Button from '../../../components/Button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function RenderStage({ 
  script, 
  captionStyles, 
  selectedStyle, setSelectedStyle, 
  selectedCaption, setSelectedCaption, 
  selectedVoice, setSelectedVoice,
  onBack
}) {
  const navigate = useNavigate();
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!videoId || !rendering) return;
    const iv = setInterval(async () => {
      try {
        const prog = await api.getVideoProgress(videoId);
        setRenderProgress(prog);
        if (prog.status === 'ready' || prog.status === 'approved' || prog.status === 'uploaded') {
          setRendering(false);
          toast.success('Video rendered successfully!');
        } else if (prog.status === 'failed') {
          setRendering(false);
          setError(prog.notes || 'Unknown render error occurred');
          toast.error(`Render failed: ${prog.notes || 'Unknown error'}`);
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
      const video = await api.renderVideo(
        script.id, selectedStyle, selectedCaption, null, selectedVoice
      );
      setVideoId(video.id);
      toast.info('Rendering pipeline started...');
    } catch (e) {
      setRendering(false);
      setError(e.message);
      toast.error(`Render failed: ${e.message}`);
    }
  };

  // Rendering Active or Finished
  if (rendering || renderProgress) {
    if (error) {
      return (
        <Card variant="surface" className="max-w-md mx-auto text-center p-8 space-y-6 border-danger/40">
          <div className="w-16 h-16 bg-danger/10 text-danger rounded-2xl flex items-center justify-center mx-auto">
            <Icon name="alert-triangle" size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-text-primary">Render Failed</h3>
            <p className="text-xs text-text-secondary">An issue occurred during video assembly.</p>
          </div>
          <div className="bg-elevated p-3 rounded-lg text-xs font-mono text-danger text-left break-words border border-border">
            {error}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" className="flex-1" onClick={onBack}>
              Edit Storyboard
            </Button>
            <Button variant="primary" size="sm" icon="refresh-cw" className="flex-1" onClick={startRender}>
              Retry Render
            </Button>
          </div>
        </Card>
      );
    }

    if (!rendering && (renderProgress?.status === 'ready' || renderProgress?.status === 'approved' || renderProgress?.status === 'uploaded')) {
      return (
        <Card variant="surface" className="max-w-md mx-auto text-center p-8 space-y-6 border-success/40">
          <div className="w-16 h-16 bg-success/15 text-success rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <Icon name="check" size={36} />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-success">Short Rendered Successfully!</h3>
            <p className="text-xs text-text-secondary">
              Your final 9:16 video has been generated with subtitles and audio and is ready for review.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <Button 
              variant="primary" 
              size="md" 
              icon="play" 
              className="w-full shadow-brand-glow"
              onClick={() => navigate('/app/videos')}
            >
              Open in Review Queue
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              className="w-full"
              onClick={() => navigate('/app/create')}
            >
              Produce Another Short
            </Button>
          </div>
        </Card>
      );
    }

    // Active Rendering Pipeline
    return (
      <Card variant="surface" className="max-w-lg mx-auto text-center p-8 space-y-6">
        <div className="w-16 h-16 bg-elevated rounded-2xl flex items-center justify-center mx-auto text-brand-red border border-border shadow-inner">
          <Icon name="loader" size={32} className="animate-spin text-brand-red" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-text-primary tracking-tight">Rendering Video Pipeline</h2>
          <p className="text-xs text-text-secondary">
            Processing voiceover, synchronizing clips, burning subtitles, and muxing video...
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-elevated rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-brand-red h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(5, renderProgress?.progress || 10))}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-text-muted">{renderProgress?.stage_label || 'Executing worker pipeline...'}</span>
            <span className="text-brand-red font-bold">{Math.round(renderProgress?.progress || 10)}%</span>
          </div>
        </div>

        {/* Stage Timeline */}
        <div className="grid grid-cols-4 gap-2 pt-4 border-t border-border">
          {['tts', 'visuals', 'assembly', 'metadata'].map((st) => {
            const labels = { tts: 'Voice', visuals: 'Visuals', assembly: 'Assembly', metadata: 'Subtitles' };
            const order = ['queued', 'tts', 'visuals', 'assembly', 'metadata', 'done'];
            const curIdx = order.indexOf(renderProgress?.render_stage || 'queued');
            const thisIdx = order.indexOf(st);
            const isDone = thisIdx < curIdx;
            const isCurrent = thisIdx === curIdx;

            return (
              <div key={st} className="flex flex-col items-center gap-1.5 text-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isDone ? 'bg-success text-canvas' : isCurrent ? 'bg-warning text-canvas animate-pulse' : 'bg-elevated text-text-muted border border-border'
                }`}>
                  {isDone ? '✓' : ''}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  isDone ? 'text-success' : isCurrent ? 'text-warning font-extrabold' : 'text-text-muted'
                }`}>
                  {labels[st]}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  // Pre-render Configuration Form
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Stage 4: Voice & Render Settings</h2>
          <p className="text-xs text-text-secondary">Choose caption appearance, pacing style, and AI voice talent.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon="arrow-left" onClick={onBack}>
            Back
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            icon="play" 
            className="shadow-brand-glow"
            onClick={startRender} 
            disabled={!script}
          >
            Start Render Pipeline
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Visual Styling */}
        <Card variant="surface">
          <CardHeader
            title={
              <CardTitle icon={<Icon name="video" size={16} className="text-brand-red" />}>
                Visual & Caption Configuration
              </CardTitle>
            }
          />
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
                Video Pacing & Style
              </label>
              <select
                className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                value={selectedStyle}
                onChange={e => setSelectedStyle(e.target.value)}
              >
                <option value="fast_facts">Fast Facts (High Energy)</option>
                <option value="documentary">Documentary (Paced & Atmospheric)</option>
                <option value="cinematic">Cinematic (Widescreen to 9:16)</option>
                <option value="minimal">Minimal (Clean & Modern)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
                Subtitle / Caption Style
              </label>
              <select
                className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                value={selectedCaption}
                onChange={e => setSelectedCaption(e.target.value)}
              >
                {(captionStyles || []).map(cs => (
                  <option key={cs.key} value={cs.key}>{cs.name}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Audio / Voiceover */}
        <Card variant="surface">
          <CardHeader
            title={
              <CardTitle icon={<Icon name="mic" size={16} className="text-info" />}>
                Voiceover Engine (Edge-TTS)
              </CardTitle>
            }
          />
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
                Voice Actor Model
              </label>
              <select
                className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                value={selectedVoice}
                onChange={e => setSelectedVoice(e.target.value)}
              >
                <optgroup label="US English">
                  <option value="en-US-ChristopherNeural">Christopher (Male - Authoritative)</option>
                  <option value="en-US-GuyNeural">Guy (Male - Casual)</option>
                  <option value="en-US-EricNeural">Eric (Male - Energetic)</option>
                  <option value="en-US-JennyNeural">Jenny (Female - Clear)</option>
                  <option value="en-US-AriaNeural">Aria (Female - Narrative)</option>
                </optgroup>
                <optgroup label="UK English">
                  <option value="en-GB-SoniaNeural">Sonia (Female - Sophisticated)</option>
                  <option value="en-GB-RyanNeural">Ryan (Male - Crisp)</option>
                </optgroup>
              </select>
            </div>

            <div className="p-3 bg-elevated/70 rounded-lg border border-border text-xs text-text-secondary leading-relaxed">
              <span className="font-bold text-text-primary block mb-1">Audio Synthesis Note:</span>
              Voiceover is synthesized in real-time at ultra-low latency with burned-in word-level synchronization.
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
