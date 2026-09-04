import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Icon from '../components/Icon';
import { toast } from 'sonner';

const STAGES = ['idea', 'script', 'storyboard', 'render'];
const STAGE_LABELS = { idea: 'Pick Idea', script: 'Script', storyboard: 'Storyboard', render: 'Render' };

export default function CreateShort() {
  const navigate = useNavigate();
  const [stage, setStage] = useState('idea');
  const [ideas, setIdeas] = useState([]);
  const [channels, setChannels] = useState([]);
  const [profile, setProfile] = useState(null);
  const [captionStyles, setCaptionStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Selection state
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [script, setScript] = useState(null);
  const [editingScenes, setEditingScenes] = useState([]);

  // Render config
  const [selectedStyle, setSelectedStyle] = useState('fast_facts');
  const [selectedCaption, setSelectedCaption] = useState('bold_centered');
  const [selectedVoice, setSelectedVoice] = useState('en-US-ChristopherNeural');
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(null);
  const [videoId, setVideoId] = useState(null);

  // ── Load data ────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [allIdeas, allChannels, prof, styles] = await Promise.all([
          api.getIdeas(), api.getChannels(), api.getProfile(), api.getCaptionStyles()
        ]);
        setIdeas(allIdeas.filter(i => i.status === 'pending' || i.status === 'promoted'));
        setChannels(allChannels);
        setProfile(prof);
        setCaptionStyles(styles);
        setSelectedCaption(prof?.caption_style || 'bold_centered');
        setSelectedVoice(prof?.default_voice_id || 'en-US-ChristopherNeural');
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  // ── Poll render progress ─────────────────────────────────────────────────

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
          toast.error(`Render failed: ${prog.notes || 'Unknown error'}`);
        }
      } catch (e) { console.error(e); }
    }, 2000);
    return () => clearInterval(iv);
  }, [videoId, rendering]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const selectIdea = (idea) => {
    setSelectedIdea(idea);
    setStage('script');
  };

  const generateScript = async () => {
    if (!selectedIdea) return;
    setGenerating(true);
    try {
      const result = await api.generateScript(selectedIdea.id);
      setScript(result);
      setEditingScenes(result.scenes.map(s => ({ ...s })));
      setStage('storyboard');
    } catch (e) {
      toast.error(`Script generation failed: ${e.message}`);
    }
    setGenerating(false);
  };

  const updateScene = (idx, field, value) => {
    setEditingScenes(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const saveSceneEdits = async () => {
    if (!script) return;
    try {
      const patches = editingScenes.map(s => ({
        id: s.id,
        narration: s.narration,
        visual_description: s.visual_description,
      }));
      const updated = await api.updateScript(script.id, { scenes: patches });
      setScript(updated);
      toast.success('Scenes updated');
    } catch (e) {
      toast.error(`Save failed: ${e.message}`);
    }
  };

  const startRender = async () => {
    if (!script) return;
    setRendering(true);
    setRenderProgress(null);
    try {
      const video = await api.renderVideo(
        script.id, selectedStyle, selectedCaption, null, selectedVoice
      );
      setVideoId(video.id);
      setStage('render');
    } catch (e) {
      setRendering(false);
      toast.error(`Render failed: ${e.message}`);
    }
  };

  // ── Stepper ──────────────────────────────────────────────────────────────

  const currentIdx = STAGES.indexOf(stage);

  if (loading) {
    return (
      <div className="empty-state">
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Create Short</h1>
          <p>One workspace: idea → script → storyboard → render.</p>
        </div>
      </div>

      {/* ── Stage stepper ─────────────────────────────────────────────── */}
      <div className="create-stepper">
        {STAGES.map((s, i) => (
          <div key={s} className={`stepper-step ${i <= currentIdx ? 'active' : ''} ${i === currentIdx ? 'current' : ''}`}>
            <div className="stepper-dot">{i < currentIdx ? <Icon name="check" size={14} /> : i + 1}</div>
            <span className="stepper-label">{STAGE_LABELS[s]}</span>
            {i < STAGES.length - 1 && <div className="stepper-line" />}
          </div>
        ))}
      </div>

      {/* ── Stage: Pick Idea ──────────────────────────────────────────── */}
      {stage === 'idea' && (
        <div className="create-stage">
          <h2 className="stage-title">Choose a topic</h2>
          <p className="stage-desc">Select an idea to turn into a Short, or generate new ones from Ideas.</p>

          {ideas.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px' }}>
              <Icon name="layers" size={40} />
              <p>No ideas available. Generate some first on the Ideas page.</p>
              <button className="btn btn-primary" onClick={() => navigate('/app/ideas')}>
                <Icon name="plus" size={14} /> Generate Ideas
              </button>
            </div>
          ) : (
            <div className="idea-pick-grid">
              {ideas.map(idea => (
                <button
                  key={idea.id}
                  className={`idea-pick-card ${selectedIdea?.id === idea.id ? 'selected' : ''}`}
                  onClick={() => selectIdea(idea)}
                >
                  <div className="idea-pick-title">{idea.title}</div>
                  <div className="idea-pick-topic">{idea.topic}</div>
                  {idea.angle && <div className="idea-pick-angle">{idea.angle}</div>}
                  <div className="idea-pick-meta">
                    <span className={`badge badge-${idea.status}`}>{idea.status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Stage: Script Generation ──────────────────────────────────── */}
      {stage === 'script' && (
        <div className="create-stage">
          <h2 className="stage-title">Generate Script</h2>
          <div className="selected-idea-banner">
            <Icon name="layers" size={16} />
            <div>
              <strong>{selectedIdea?.title}</strong>
              <span className="text-muted"> — {selectedIdea?.topic}</span>
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => { setStage('idea'); setScript(null); }}>
              Change
            </button>
          </div>

          {!script ? (
            <div className="script-gen-action">
              <p>The AI will generate a scene-by-scene script with narration and visual descriptions for each beat.</p>
              <button className="btn btn-primary btn-lg" onClick={generateScript} disabled={generating}>
                {generating ? <><span className="spinner" /> Generating script...</> : <><Icon name="sparkles" size={16} /> Generate Script</>}
              </button>
            </div>
          ) : (
            <div className="script-preview">
              <div className="script-preview-header">
                <h3>Generated Script</h3>
                <div className="flex gap-2">
                  <span className="badge" style={{ background: script.quality_score >= 70 ? 'var(--success-muted)' : 'var(--warning-muted)', color: script.quality_score >= 70 ? 'var(--success)' : 'var(--warning)' }}>
                    QA: {script.quality_score}
                  </span>
                  <span className="text-muted text-sm">~{script.duration_est?.toFixed(0)}s</span>
                </div>
              </div>
              <div className="scene-list-preview">
                {script.scenes.map((sc, i) => (
                  <div key={sc.id} className="scene-preview-card">
                    <div className="scene-number">Scene {sc.scene_number}</div>
                    <div className="scene-narration">{sc.narration}</div>
                    <div className="scene-visual">
                      <Icon name="image" size={12} /> {sc.visual_description}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button className="btn btn-primary" onClick={() => setStage('storyboard')}>
                  <Icon name="layout" size={14} /> Edit Storyboard
                </button>
                <button className="btn btn-secondary" onClick={generateScript} disabled={generating}>
                  <Icon name="refresh-cw" size={14} /> Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Stage: Storyboard ─────────────────────────────────────────── */}
      {stage === 'storyboard' && script && (
        <div className="create-stage">
          <h2 className="stage-title">Storyboard</h2>
          <p className="stage-desc">Edit each scene's narration and visual description before rendering.</p>

          <div className="storyboard-grid">
            {editingScenes.map((sc, i) => (
              <div key={sc.id} className="storyboard-card">
                <div className="storyboard-card-header">
                  <span className="storyboard-scene-num">Scene {sc.scene_number}</span>
                </div>
                <div className="storyboard-field">
                  <label className="label text-xs">Narration</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={sc.narration}
                    onChange={e => updateScene(i, 'narration', e.target.value)}
                  />
                </div>
                <div className="storyboard-field">
                  <label className="label text-xs">
                    <Icon name="image" size={12} /> Visual Search Query
                  </label>
                  <input
                    className="input"
                    value={sc.visual_description}
                    onChange={e => updateScene(i, 'visual_description', e.target.value)}
                    placeholder="e.g. tardigrade electron microscope"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="storyboard-full-text">
            <label className="label text-xs">Full Script (auto-generated from scenes)</label>
            <div className="script-fulltext-preview">
              {editingScenes.map(s => s.narration).join(' ')}
            </div>
          </div>

          {/* ── Render config ──────────────────────────────────────────── */}
          <div className="render-config">
            <h3 className="render-config-title">Render Settings</h3>
            <div className="render-config-grid">
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

          <div className="flex gap-2 mt-3">
            <button className="btn btn-secondary" onClick={saveSceneEdits}>
              <Icon name="save" size={14} /> Save Edits
            </button>
            <button className="btn btn-primary btn-lg" onClick={startRender} disabled={rendering}>
              <Icon name="play" size={16} /> Render Video
            </button>
            <button className="btn btn-secondary" onClick={() => setStage('script')}>
              Back to Script
            </button>
          </div>
        </div>
      )}

      {/* ── Stage: Render Progress ────────────────────────────────────── */}
      {stage === 'render' && (
        <div className="create-stage">
          <h2 className="stage-title">Rendering</h2>

          {rendering ? (
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
          ) : renderProgress?.status === 'failed' ? (
            <div className="render-failure">
              <Icon name="alert-triangle" size={40} />
              <h3>Render Failed</h3>
              <p className="text-muted">{renderProgress?.notes}</p>
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={() => { setStage('storyboard'); setRendering(false); }}>
                  <Icon name="edit" size={14} /> Edit & Retry
                </button>
                <button className="btn btn-secondary" onClick={startRender}>
                  <Icon name="refresh-cw" size={14} /> Retry Render
                </button>
              </div>
            </div>
          ) : (
            <div className="render-success">
              <Icon name="check-circle" size={48} style={{ color: 'var(--success)' }} />
              <h3>Video Ready!</h3>
              <p className="text-muted">Your Short has been rendered successfully.</p>
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={() => navigate('/app/videos')}>
                  <Icon name="video" size={14} /> Review in Studio
                </button>
                <button className="btn btn-secondary" onClick={() => { setStage('idea'); setScript(null); setSelectedIdea(null); setVideoId(null); setRenderProgress(null); }}>
                  <Icon name="plus" size={14} /> Create Another
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
