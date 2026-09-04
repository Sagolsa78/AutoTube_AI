import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Icon from '../components/Icon';
import { toast } from 'sonner';

export default function Scripts() {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('draft');
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [regenerating, setRegenerating] = useState(null);
  const [renderModal, setRenderModal] = useState(null);
  const [captionStyles, setCaptionStyles] = useState([]);
  const [selectedCaption, setSelectedCaption] = useState('bold_centered');
  const [customCta, setCustomCta] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('en-US-ChristopherNeural');
  const [rendering, setRendering] = useState(false);
  const [profile, setProfile] = useState(null);
  const [videos, setVideos] = useState([]);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [allScripts, styles, prof, allVideos] = await Promise.all([
        api.getScripts(), api.getCaptionStyles(), api.getProfile(), api.getVideos()
      ]);
      setScripts(allScripts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      setCaptionStyles(styles);
      setProfile(prof);
      setSelectedCaption(prof.caption_style || 'bold_centered');
      setCustomCta(prof.default_cta || 'Follow for more!');
      setVideos(allVideos);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const discardScript = async (e, id) => {
    e.stopPropagation();
    try {
      await api.discardScript(id);
      await loadData();
      toast.success('Script discarded.');
    } catch (e) { toast.error(`Discard failed: ${e.message}`); }
  };

  const regenerateScript = async (e, id) => {
    e.stopPropagation();
    setRegenerating(id);
    try {
      await api.regenerateScript(id);
      await loadData();
      toast.success('Script regenerated successfully!');
    } catch (e) { toast.error(`Regeneration failed: ${e.message}`); }
    finally { setRegenerating(null); }
  };

  const filteredScripts = scripts.filter(s => {
    if (showDiscarded && s.status === 'discarded') return true;
    if (activeTab === 'draft' && s.status === 'draft') return true;
    if (activeTab === 'used' && s.status === 'used_in_render') return true;
    return false;
  });

  const openRender = (script) => {
    setRenderModal(script);
    setCustomCta(profile?.default_cta || 'Follow for more!');
    setSelectedCaption(profile?.caption_style || 'bold_centered');
    setSelectedVoice(profile?.default_voice_id || 'en-US-ChristopherNeural');
  };

  const doRender = async () => {
    if (!renderModal) return;
    setRendering(true);
    try {
      await api.renderVideo(renderModal.id, 'fast_facts', selectedCaption, customCta, selectedVoice);
      setRenderModal(null);
      toast.success('Render queued — check Videos for progress.');
      navigate('/app/videos');
    } catch (e) { toast.error(`Render failed: ${e.message}`); }
    finally { setRendering(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Scripts</h1>
          <p>Browse generated scripts. Use <strong>Create Short</strong> for the full production workflow.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-3" style={{ borderBottom: '1px solid var(--border-1)', paddingBottom: '10px' }}>
        <button className={`btn btn-sm ${activeTab === 'draft' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('draft')}>
          Drafts ({scripts.filter(s => s.status === 'draft').length})
        </button>
        <button className={`btn btn-sm ${activeTab === 'used' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('used')}>
          Used ({scripts.filter(s => s.status === 'used_in_render').length})
        </button>
        <label className="flex items-center gap-1 ml-auto text-sm text-muted cursor-pointer">
          <input type="checkbox" checked={showDiscarded} onChange={e => setShowDiscarded(e.target.checked)} />
          Show Discarded ({scripts.filter(s => s.status === 'discarded').length})
        </label>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Generated Scripts</h3>
        </div>
        {filteredScripts.length === 0 ? (
          <p className="text-muted text-sm">No scripts found for this view.</p>
        ) : (
          <div className="flex-col gap-2">
            {filteredScripts.map(s => {
              const isRendering = videos.some(v => v.script_id === s.id && v.status === 'rendering');
              const isUsed = s.status === 'used_in_render';
              return (
                <div key={s.id} onClick={() => !isRendering && !isUsed && s.status === 'draft' && openRender(s)} role="button" tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && !isRendering && !isUsed && s.status === 'draft' && openRender(s)}
                  style={{ padding: '12px 14px', background: 'var(--surface-input)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-1)', cursor: (isRendering || isUsed || s.status === 'discarded') ? 'default' : 'pointer', transition: 'border-color 0.15s', opacity: s.status === 'discarded' ? 0.6 : 1 }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: 'var(--text-0)' }}>
                        {`Script #${s.id.substring(0, 8)}`}
                      </span>
                      <span className="badge" style={{ background: 'var(--surface-3)', color: 'var(--text-1)', fontSize: '10px' }}>{s.status}</span>
                      {s.scenes?.length > 0 && (
                        <span className="badge" style={{ background: 'var(--info-muted)', color: 'var(--info)', fontSize: '10px' }}>
                          {s.scenes.length} scenes
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 items-center flex-wrap justify-end">
                      {s.status === 'draft' && (
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <button className="btn btn-sm btn-secondary" onClick={e => regenerateScript(e, s.id)} disabled={regenerating === s.id}>
                            {regenerating === s.id ? <span className="spinner" /> : <Icon name="refresh-cw" size={12} />}
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={e => discardScript(e, s.id)}>
                            <Icon name="trash" size={12} />
                          </button>
                        </div>
                      )}
                      {isRendering && <span className="badge badge-rendering">Rendering...</span>}
                    </div>
                  </div>

                  {/* Scene-based preview */}
                  {s.scenes?.length > 0 ? (
                    <div className="scene-list-preview" style={{ gap: '6px' }}>
                      {s.scenes.slice(0, 3).map((sc, i) => (
                        <div key={sc.id} style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                          <span className="scene-number" style={{ fontSize: '9px', flexShrink: 0 }}>S{sc.scene_number}</span>
                          <span className="text-sm text-muted" style={{ lineHeight: 1.4 }}>{sc.narration}</span>
                        </div>
                      ))}
                      {s.scenes.length > 3 && (
                        <span className="text-xs text-muted">+{s.scenes.length - 3} more scenes</span>
                      )}
                    </div>
                  ) : (
                    <p className="truncate text-sm text-muted" style={{ lineHeight: 1.4 }}>{s.full_text}</p>
                  )}
                </div>
              )})}
          </div>
        )}
      </div>

      {/* ── Render Modal — scene-based ────────────────────────────────────── */}
      {renderModal && (
        <div className="overlay" onClick={() => !rendering && setRenderModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Review & Render</h3>
              {!rendering && (
                <button className="modal-close" onClick={() => setRenderModal(null)} aria-label="Close">
                  <Icon name="x" size={18} />
                </button>
              )}
            </div>

            {/* Scene-based script preview */}
            <div className="script-block mb-3">
              {renderModal.scenes?.length > 0 ? (
                renderModal.scenes.map((sc, i) => (
                  <div key={sc.id || i}>
                    <div className="script-label">Scene {sc.scene_number}</div>
                    <div className="scene-narration">{sc.narration}</div>
                    <div className="scene-visual">
                      <Icon name="image" size={12} /> {sc.visual_description}
                    </div>
                  </div>
                ))
              ) : (
                <div>
                  <div className="script-label">Full Script</div>
                  <p className="text-sm" style={{ lineHeight: 1.7 }}>{renderModal.full_text}</p>
                </div>
              )}
            </div>

            {/* Voice Override */}
            <div className="field">
              <label className="label" htmlFor="voice-select">Voice Override</label>
              <select id="voice-select" className="select" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                <option value="en-US-ChristopherNeural">Christopher (US Male - Deep)</option>
                <option value="en-US-GuyNeural">Guy (US Male - Clear)</option>
                <option value="en-US-EricNeural">Eric (US Male - Energetic)</option>
                <option value="en-US-JennyNeural">Jenny (US Female - Clear)</option>
                <option value="en-US-AriaNeural">Aria (US Female - Expressive)</option>
                <option value="en-GB-SoniaNeural">Sonia (UK Female)</option>
                <option value="en-GB-RyanNeural">Ryan (UK Male)</option>
              </select>
            </div>

            {/* Caption style picker */}
            <div className="field">
              <label className="label">Caption Style</label>
              <div className="caption-grid">
                {captionStyles.map(cs => (
                  <div key={cs.key}
                    className={`caption-card${selectedCaption === cs.key ? ' selected' : ''}`}
                    onClick={() => setSelectedCaption(cs.key)}
                    onKeyDown={e => e.key === 'Enter' && setSelectedCaption(cs.key)}
                    role="radio" aria-checked={selectedCaption === cs.key} tabIndex={0}
                  >
                    <div className="caption-card-name">{cs.name}</div>
                    <div className="caption-card-desc">{cs.description}</div>
                    <div className="caption-card-preview">
                      <span style={cssToObj(cs.preview_css)}>Sample Text</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRenderModal(null)} disabled={rendering}>Cancel</button>
              <button className="btn btn-primary" onClick={doRender} disabled={rendering}>
                {rendering ? <span className="spinner" /> : <Icon name="play" size={14} />}
                {rendering ? 'Rendering…' : 'Render Video'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function cssToObj(css) {
  if (!css) return {};
  const obj = {};
  css.split(';').filter(Boolean).forEach(rule => {
    const [prop, ...v] = rule.split(':');
    if (!prop || !v.length) return;
    const camel = prop.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    obj[camel] = v.join(':').trim();
  });
  return obj;
}
