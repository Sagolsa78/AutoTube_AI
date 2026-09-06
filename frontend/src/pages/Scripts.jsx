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
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const allScripts = await api.getScripts();
      setScripts(allScripts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
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

  const openInStudio = (scriptId) => {
    navigate(`/app/create?script=${scriptId}`);
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
              const isUsed = s.status === 'used_in_render';
              return (
                <div key={s.id} 
                  style={{ padding: '12px 14px', background: 'var(--surface-input)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-1)', cursor: (isUsed || s.status === 'discarded') ? 'default' : 'pointer', transition: 'border-color 0.15s', opacity: s.status === 'discarded' ? 0.6 : 1 }}>
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
                          <button className="btn btn-sm btn-primary" onClick={e => { e.stopPropagation(); openInStudio(s.id); }}>
                            <Icon name="edit" size={12} /> Open in Studio
                          </button>
                          <button className="btn btn-sm btn-secondary" onClick={e => regenerateScript(e, s.id)} disabled={regenerating === s.id}>
                            {regenerating === s.id ? <span className="spinner" /> : <Icon name="refresh-cw" size={12} />}
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={e => discardScript(e, s.id)}>
                            <Icon name="trash" size={12} />
                          </button>
                        </div>
                      )}
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
    </div>
  );
}
