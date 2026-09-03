import { useState, useEffect } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';
import { toast } from 'sonner';

export default function Ideas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

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

  const action = async (id, act) => {
    try {
      if (act === 'approve') await api.approveIdea(id);
      else await api.rejectIdea(id);
      await load();
    } catch (e) { console.error(e); }
  };

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

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Topic</th>
                <th>Angle</th>
                <th>Status</th>
                <th style={{ width: 170 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !ideas.length ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40 }}><span className="spinner spinner-lg" /></td></tr>
              ) : !ideas.length ? (
                <tr><td colSpan={4} className="text-muted" style={{ textAlign: 'center', padding: 40 }}>No ideas yet. Click &quot;Generate Ideas&quot; to begin.</td></tr>
              ) : ideas.map(i => (
                <tr key={i.id}>
                  <td className="font-bold" style={{ fontSize: '14px', color: 'var(--text-0)' }}>{i.topic}</td>
                  <td className="text-muted text-sm truncate" style={{ maxWidth: 280, fontStyle: 'italic', letterSpacing: '0.02em' }}>{i.angle || '—'}</td>
                  <td><span className={`badge badge-${i.status}`}>{i.status}</span></td>
                  <td>
                    {i.status === 'pending' && (
                      <div className="flex gap-1">
                        <button className="btn btn-sm btn-success" onClick={() => action(i.id, 'approve')}><Icon name="check" size={12} /> Approve</button>
                        <button className="btn btn-sm btn-danger" onClick={() => action(i.id, 'reject')}><Icon name="x" size={12} /></button>
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
