import { useState, useEffect } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';

export default function Publications() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const all = await api.getVideos();
        // Only show uploaded (published) videos
        setVideos(all.filter(v => v.status === 'uploaded'));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Live Publications</h1>
          <p>Videos published to YouTube. Track upload dates and performance once analytics are wired.</p>
        </div>
        <span className="badge badge-uploaded">{videos.length} Published</span>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner spinner-lg"></div>
          <p>Loading publications…</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="empty-state">
          <Icon name="youtube" size={48} />
          <p>No published videos yet. Upload your first video from the Videos tab.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Niche</th>
                  <th>Uploaded</th>
                  <th>YouTube ID</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {videos.map(v => (
                  <tr key={v.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{v.title || v.idea_title || 'Untitled'}</div>
                      <div className="text-xs text-muted truncate" style={{ maxWidth: '320px' }}>{v.description || '—'}</div>
                    </td>
                    <td>
                      <span className="badge badge-scripted">{v.niche || '—'}</span>
                    </td>
                    <td className="text-sm text-muted">
                      {v.uploaded_at ? new Date(v.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td>
                      {v.youtube_id ? (
                        <a
                          href={`https://youtube.com/shorts/${v.youtube_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mono text-sm"
                          style={{ color: 'var(--accent-strong)' }}
                        >
                          {v.youtube_id}
                        </a>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-uploaded">
                        <Icon name="check" size={12} /> Live
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
