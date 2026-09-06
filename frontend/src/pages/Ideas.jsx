import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Icon from '../components/Icon';
import { toast } from 'sonner';

export default function Ideas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const navigate = useNavigate();
  const [showDiscarded, setShowDiscarded] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getIdeas();
      setIdeas(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const channels = await api.getChannels();
      const channelId = channels[0]?.id;
      if (!channelId) { toast.error('Create a channel first.'); return; }
      const prof = await api.getProfile();
      await api.generateIdeas(channelId, 5, prof.default_niche || 'science_wow');
      await load();
      toast.success('Ideas generated successfully!');
    } catch (e) { console.error(e); toast.error(`Generation failed: ${e.message}`); }
    finally { setGenerating(false); }
  };

  const actionDiscard = async (id) => {
    try {
      await api.discardIdea(id);
      await load();
      toast.success('Idea discarded.');
    } catch (e) { console.error(e); toast.error(`Discard failed: ${e.message}`); }
  };

  const developInStudio = (ideaId) => {
    navigate(`/app/create?idea=${ideaId}`);
  };

  const filteredIdeas = ideas.filter(i => {
    if (showDiscarded && i.status === 'discarded') return true;
    if (activeTab === 'pending' && i.status === 'pending') return true;
    if (activeTab === 'promoted' && i.status === 'promoted') return true;
    return false;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Content Ideas</h1>
          <p>Generate and curate topics before scripting.</p>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={generating}>
          {generating ? <span className="spinner" /> : <Icon name="sparkles" size={14} />}
          {generating ? 'Generating…' : 'Generate Ideas'}
        </button>
      </div>

      <div className="flex gap-2 mb-3" style={{ borderBottom: '1px solid var(--border-1)', paddingBottom: '10px' }}>
        <button className={`btn btn-sm ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('pending')}>
          Pending ({ideas.filter(i => i.status === 'pending').length})
        </button>
        <button className={`btn btn-sm ${activeTab === 'promoted' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('promoted')}>
          In Production ({ideas.filter(i => i.status === 'promoted').length})
        </button>
        <label className="flex items-center gap-1 ml-auto text-sm text-muted cursor-pointer">
          <input type="checkbox" checked={showDiscarded} onChange={e => setShowDiscarded(e.target.checked)} />
          Show Discarded ({ideas.filter(i => i.status === 'discarded').length})
        </label>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Topic</th>
                <th>Angle</th>
                <th>Status</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !filteredIdeas.length ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40 }}><span className="spinner spinner-lg" /></td></tr>
              ) : !filteredIdeas.length ? (
                <tr><td colSpan={4} className="text-muted" style={{ textAlign: 'center', padding: 40 }}>No ideas found for this view.</td></tr>
              ) : filteredIdeas.map(i => (
                <tr key={i.id} style={{ opacity: i.status === 'discarded' ? 0.6 : 1 }}>
                  <td className="font-bold" style={{ fontSize: '14px', color: 'var(--text-0)' }}>{i.topic}</td>
                  <td className="text-muted text-sm truncate" style={{ maxWidth: 280, fontStyle: 'italic', letterSpacing: '0.02em' }}>{i.angle || '—'}</td>
                  <td><span className={`badge badge-${i.status}`}>{i.status}</span></td>
                  <td>
                    {i.status === 'pending' && (
                      <div className="flex gap-1">
                        <button className="btn btn-sm btn-primary" onClick={() => developInStudio(i.id)}>
                          <Icon name="sparkles" size={12} /> Develop in Studio
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => actionDiscard(i.id)}><Icon name="trash" size={12} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
