import { useState, useEffect } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';

export default function Channels() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', niche: '', language: 'en' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadChannels();
  }, []);

  async function loadChannels() {
    try {
      const data = await api.getChannels();
      setChannels(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      await api.createChannel(form);
      setForm({ name: '', niche: '', language: 'en' });
      setShowCreate(false);
      await loadChannels();
    } catch (e) { console.error(e); }
    setCreating(false);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Channels & Niches</h1>
          <p>Manage your content channels. Each channel targets a specific niche and drives the idea generation pipeline.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={14} /> New Channel
        </button>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner spinner-lg"></div>
          <p>Loading channels…</p>
        </div>
      ) : channels.length === 0 ? (
        <div className="empty-state">
          <Icon name="hash" size={48} />
          <p>No channels yet. Create your first channel to start generating ideas for a niche.</p>
        </div>
      ) : (
        <div className="grid-3">
          {channels.map(ch => (
            <div key={ch.id} className="card" style={{ padding: '20px' }}>
              <div className="card-header">
                <div>
                  <h3 className="card-title">{ch.name}</h3>
                  <span className="text-xs text-muted">{ch.niche || 'No niche set'}</span>
                </div>
                <span className="status-badge status-online">
                  <span className="dot" style={{ width: '6px', height: '6px', display: 'inline-block', borderRadius: '50%', background: 'var(--success)', boxShadow: 'none', animation: 'none' }}></span>
                  Active
                </span>
              </div>
              <div className="provider-stat">
                <span>Language</span>
                <span className="provider-stat-value">{ch.language || 'en'}</span>
              </div>
              <div className="provider-stat">
                <span>Created</span>
                <span className="provider-stat-value" style={{ fontSize: '11px' }}>
                  {ch.created_at ? new Date(ch.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreate && (
        <div className="overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create Channel</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="field">
                <label className="label">Channel Name</label>
                <input
                  className="input"
                  placeholder="e.g. Tech Shorts, History Bits"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="field">
                <label className="label">Niche / Topic</label>
                <input
                  className="input"
                  placeholder="e.g. Artificial Intelligence, Space Exploration"
                  value={form.niche}
                  onChange={e => setForm({ ...form, niche: e.target.value })}
                />
                <span className="hint">This drives the AI idea generator. Be specific for better results.</span>
              </div>
              <div className="field">
                <label className="label">Language</label>
                <select className="select" value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating || !form.name.trim()}>
                  {creating ? <><div className="spinner"></div> Creating…</> : <><Icon name="plus" size={14} /> Create Channel</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
