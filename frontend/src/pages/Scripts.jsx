import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Icon from '../components/Icon';
import { toast } from 'sonner';

export default function Scripts() {
  const [ideas, setIdeas] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(null);
  const [renderModal, setRenderModal] = useState(null);
  const [captionStyles, setCaptionStyles] = useState([]);
  const [selectedCaption, setSelectedCaption] = useState('bold_centered');
  const [customCta, setCustomCta] = useState('');
  const [rendering, setRendering] = useState(false);
  const [profile, setProfile] = useState(null);
  const [videos, setVideos] = useState([]);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [allIdeas, allScripts, styles, prof, allVideos] = await Promise.all([
        api.getIdeas(), api.getScripts(), api.getCaptionStyles(), api.getProfile(), api.getVideos()
      ]);
      setIdeas(allIdeas);
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

  const generateScript = async (ideaId) => {
    setGenerating(ideaId);
    try { await api.generateScript(ideaId); await loadData(); toast.success('Script generated successfully!'); }
    catch (e) { toast.error(`Script generation failed: ${e.message}`); }
    finally { setGenerating(null); }
  };

  const openRender = (script) => {
    setRenderModal(script);
    setCustomCta(script.cta || profile?.default_cta || 'Follow for more!');
    setSelectedCaption(profile?.caption_style || 'bold_centered');
  };

  const doRender = async () => {
    if (!renderModal) return;
    setRendering(true);
    try {
      await api.renderVideo(renderModal.id, 'fast_facts', selectedCaption, customCta);
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
          <p>Generate scripts from approved ideas, review, and send to render.</p>
        </div>
      </div>

      <div className="grid-2">
        {/* Approved ideas waiting for scripts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Approved Ideas</h3>
            <span className="badge badge-approved">{ideas.filter(i => i.status === 'approved').length}</span>
          </div>
          {ideas.filter(i => i.status === 'approved').length === 0 ? (
            <p className="text-muted text-sm">No approved ideas waiting for scripts.</p>
          ) : (
            <div className="flex-col gap-1">
              {ideas.filter(i => i.status === 'approved').map(idea => (
                <div key={idea.id} className="flex items-center justify-between gap-2" style={{ padding: '10px 14px', background: 'var(--surface-input)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-1)' }}>
                  <span className="font-bold text-sm truncate" style={{ flex: 1 }}>{idea.topic}</span>
                  <button className="btn btn-sm btn-primary" onClick={() => generateScript(idea.id)} disabled={generating === idea.id}>
                    {generating === idea.id ? <span className="spinner" /> : <Icon name="sparkles" size={12} />}
                    {generating === idea.id ? 'Working…' : 'Generate'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Generated scripts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Generated Scripts</h3>
            <span className="badge badge-scripted">{scripts.length}</span>
          </div>
          {scripts.length === 0 ? (
            <p className="text-muted text-sm">No scripts yet. Generate one from an approved idea.</p>
          ) : (
            <div className="flex-col gap-1">
              {scripts.map(s => {
                const isRendering = videos.some(v => v.script_id === s.id && v.status === 'rendering');
                return (
                <div key={s.id} onClick={() => !isRendering && openRender(s)} role="button" tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && !isRendering && openRender(s)}
                  style={{ padding: '12px 14px', background: 'var(--surface-input)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-1)', cursor: isRendering ? 'not-allowed' : 'pointer', transition: 'border-color 0.15s', opacity: isRendering ? 0.6 : 1 }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: 'var(--text-0)' }}>
                        {ideas.find(i => i.id === s.idea_id)?.topic || `Script #${s.id.substring(0, 8)}`}
                      </span>
                      <span className="mono text-xs text-muted">({s.id.substring(0, 8)})</span>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {isRendering && <span className="badge badge-rendering">Rendering...</span>}
                      <span className="badge" style={{ background: 'var(--surface-3)', color: 'var(--text-1)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Icon name="sparkles" size={10} />
                        Generated by {s.provider_used || 'AI'}
                      </span>
                    </div>
                  </div>
                  <p className="truncate text-sm text-muted" style={{ lineHeight: 1.4 }}>{s.full_text}</p>
                </div>
              )})}
            </div>
          )}
        </div>
      </div>

      {/* ── Render Modal ─────────────────────────────────────────────── */}
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

            {/* Script preview */}
            <div className="script-block mb-3">
              <div><div className="script-label">Hook</div><div className="script-hook">{renderModal.hook}</div></div>
              <div><div className="script-label">Body</div>
                <div className="script-body">{renderModal.body?.map((p, i) => <p key={i}>{p}</p>)}</div>
              </div>
              <div><div className="script-label">Payoff</div><div className="script-payoff">{renderModal.payoff}</div></div>
              <div><div className="script-label">Visual Prompts</div>
                <div className="visual-tags">{renderModal.visual_prompts?.map((p, i) => <span key={i} className="visual-tag">{p}</span>)}</div>
              </div>
            </div>

            {/* Editable CTA */}
            <div className="field">
              <label className="label" htmlFor="cta-input">Call-to-Action</label>
              <input id="cta-input" className="input" value={customCta} onChange={e => setCustomCta(e.target.value)}
                placeholder="e.g. Follow for more amazing facts!" />
              <span className="hint">This text appears at the end of the voiceover. Edit it to match your brand.</span>
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
