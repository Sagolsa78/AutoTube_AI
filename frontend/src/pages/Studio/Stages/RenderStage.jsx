import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import Icon from '../../../components/Icon';
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
          setError(prog.notes || 'Unknown error');
          toast.error(`Render failed: ${prog.notes || 'Unknown error'}`);
        }
      } catch (e) { console.error(e); }
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
    } catch (e) {
      setRendering(false);
      setError(e.message);
      toast.error(`Render failed: ${e.message}`);
    }
  };

  if (rendering || renderProgress) {
    if (error) {
      return (
        <div className="create-stage">
          <div className="render-failure" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Icon name="alert-triangle" size={40} />
            <h3 style={{ margin: '16px 0 8px' }}>Render Failed</h3>
            <p className="text-muted" style={{ marginBottom: '24px' }}>{error}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="secondary" onClick={onBack}>Edit Storyboard</Button>
              <Button variant="primary" icon="refresh-cw" onClick={startRender}>Retry Render</Button>
            </div>
          </div>
        </div>
      );
    }

    if (!rendering && (renderProgress?.status === 'ready' || renderProgress?.status === 'approved' || renderProgress?.status === 'uploaded')) {
      return (
        <div className="create-stage">
          <div className="render-success" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Icon name="check-circle" size={48} style={{ color: 'var(--success)' }} />
            <h3 style={{ margin: '16px 0 8px' }}>Video Ready!</h3>
            <p className="text-muted" style={{ marginBottom: '24px' }}>Your Short has been rendered successfully.</p>
            <div className="flex gap-2 justify-center">
              <Button variant="primary" icon="video" onClick={() => navigate('/app/videos')}>
                Review in Studio
              </Button>
              <Button variant="secondary" onClick={() => navigate('/app/ideas')}>
                Create Another
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="create-stage">
        <h2 className="stage-title">Rendering</h2>
        
        <div className="render-progress-container">
          <div className="render-progress-visual">
            <div className="render-progress-bar-track">
              <div
                className="render-progress-bar-fill"
                style={{ width: `${renderProgress?.progress || 0}%` }}
              />
            </div>
            <div className="render-progress-label">
              {renderProgress?.stage_label || 'Queued'} — {Math.round(renderProgress?.progress || 0)}%
            </div>
          </div>

          <div className="render-stage-timeline">
            {['tts', 'visuals', 'assembly', 'metadata', 'done'].map(s => {
              const stageInfo = { tts: 'Voiceover', visuals: 'Visuals', assembly: 'Assembly', metadata: 'Metadata', done: 'Complete' };
              const currentStageIdx = ['queued', 'tts', 'visuals', 'assembly', 'metadata', 'done'].indexOf(renderProgress?.render_stage || 'queued');
              const thisIdx = ['queued', 'tts', 'visuals', 'assembly', 'metadata', 'done'].indexOf(s);
              const isDone = thisIdx < currentStageIdx;
              const isCurrent = thisIdx === currentStageIdx;
              return (
                <div key={s} className={`render-stage-step ${isDone ? 'done' : ''} ${isCurrent ? 'active' : ''}`}>
                  <div className="render-stage-dot">
                    {isDone ? <Icon name="check" size={12} /> : isCurrent ? <span className="spinner spinner-sm" /> : null}
                  </div>
                  <span>{stageInfo[s]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-stage">
      <h2 className="stage-title">Render Settings</h2>
      <p className="stage-desc">Configure the final visual style and voiceover for your video.</p>

      <div className="render-config" style={{ background: 'var(--surface-1)', padding: '24px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-1)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="render-config-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div className="field">
            <label className="label text-xs">Video Style</label>
            <select className="select" value={selectedStyle} onChange={e => setSelectedStyle(e.target.value)}>
              <option value="fast_facts">Fast Facts</option>
              <option value="documentary">Documentary</option>
              <option value="cinematic">Cinematic</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div className="field">
            <label className="label text-xs">Voice</label>
            <select className="select" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
              <option value="en-US-ChristopherNeural">Christopher (US Male)</option>
              <option value="en-US-GuyNeural">Guy (US Male)</option>
              <option value="en-US-EricNeural">Eric (US Male)</option>
              <option value="en-US-JennyNeural">Jenny (US Female)</option>
              <option value="en-US-AriaNeural">Aria (US Female)</option>
              <option value="en-GB-SoniaNeural">Sonia (UK Female)</option>
              <option value="en-GB-RyanNeural">Ryan (UK Male)</option>
            </select>
          </div>
          <div className="field">
            <label className="label text-xs">Caption Style</label>
            <select className="select" value={selectedCaption} onChange={e => setSelectedCaption(e.target.value)}>
              {captionStyles.map(cs => (
                <option key={cs.key} value={cs.key}>{cs.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button variant="secondary" onClick={onBack}>Back to Storyboard</Button>
        <Button variant="primary" icon="play" onClick={startRender} disabled={!script}>
          Render Video
        </Button>
      </div>
    </div>
  );
}
