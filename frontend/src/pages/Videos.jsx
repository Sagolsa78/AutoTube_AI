import { useState, useEffect } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';

export default function Videos() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadModal, setUploadModal] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getVideos();
      setVideos(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 6000);
    return () => clearInterval(iv);
  }, []);

  const action = async (id, act) => {
    try {
      if (act === 'approve') await api.approveVideo(id);
      else await api.rejectVideo(id);
      await load();
    } catch (e) { console.error(e); }
  };

  const doUpload = async (e) => {
    e.preventDefault();
    setUploading(true);
    const fd = new FormData(e.target);
    try {
      await api.uploadVideo(uploadModal.id, {
        title: fd.get('title'),
        description: fd.get('description'),
        tags: fd.get('tags').split(',').map(t => t.trim()).filter(Boolean),
        privacy_status: fd.get('privacy'),
        made_for_kids: fd.get('kids') === 'true',
      });
      alert('Upload completed successfully.');
      setUploadModal(null);
      await load();
    } catch (e) { console.error(e); alert(`Upload failed: ${e.message}`); }
    finally { setUploading(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Videos</h1>
          <p>Preview, approve, and upload your rendered Shorts.</p>
        </div>
      </div>

      {loading && !videos.length ? (
        <div className="empty-state">
          <span className="spinner spinner-lg" />
        </div>
      ) : !videos.length ? (
        <div className="empty-state">
          <Icon name="video" size={48} />
          <p>No videos yet. Go to the Scripts page and render your first Short.</p>
        </div>
      ) : (
        <div className="grid-3">
          {videos.map(v => (
            <div key={v.id} className="card flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="mono text-xs text-muted">{v.id.substring(0, 8)}</span>
                <span className={`badge badge-${v.status}`}>{v.status}</span>
              </div>

              {['ready', 'approved', 'uploaded'].includes(v.status) ? (
                <video src={`/api/videos/${v.id}/preview`} controls
                  style={{ width: '100%', borderRadius: 'var(--r-sm)', background: '#000', aspectRatio: '9/16' }} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '9/16', background: 'var(--surface-input)', display: 'grid', placeItems: 'center', borderRadius: 'var(--r-sm)' }}>
                  {v.status === 'rendering' ? <span className="spinner spinner-lg" /> : <span className="text-muted">—</span>}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted font-bold">{v.duration ? `${v.duration.toFixed(1)}s` : '—'}</span>
                  {v.caption_style && (
                    <span className="text-xs text-muted flex items-center gap-1" style={{ marginLeft: 8, display: 'inline-flex' }}>
                      <Icon name="sparkles" size={10} /> {v.caption_style}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {v.status === 'ready' && (
                    <>
                      <button className="btn btn-sm btn-success" onClick={() => action(v.id, 'approve')} aria-label="Approve">
                        <Icon name="check" size={12} />
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => action(v.id, 'reject')} aria-label="Reject">
                        <Icon name="x" size={12} />
                      </button>
                    </>
                  )}
                  {v.status === 'approved' && (
                    <button className="btn btn-sm btn-primary" onClick={() => setUploadModal(v)}>
                      <Icon name="upload" size={12} /> Upload
                    </button>
                  )}
                </div>
              </div>
              {v.notes && <div className="text-xs mt-1" style={{ color: 'var(--error)' }}>{v.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {uploadModal && (
        <div className="overlay" onClick={() => !uploading && setUploadModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Upload to YouTube</h3>
              {!uploading && (
                <button className="modal-close" onClick={() => setUploadModal(null)} aria-label="Close">
                  <Icon name="x" size={18} />
                </button>
              )}
            </div>
            <form onSubmit={doUpload}>
              <div className="field">
                <label className="label" htmlFor="upload-title">Title</label>
                <input id="upload-title" name="title" className="input" required defaultValue="Did You Know?" maxLength={100} />
              </div>
              <div className="field">
                <label className="label" htmlFor="upload-desc">Description</label>
                <textarea id="upload-desc" name="description" className="textarea" required defaultValue="#shorts #facts" />
              </div>
              <div className="field">
                <label className="label" htmlFor="upload-tags">Tags (comma separated)</label>
                <input id="upload-tags" name="tags" className="input" defaultValue="shorts, facts" />
              </div>
              <div className="row-2">
                <div className="field">
                  <label className="label" htmlFor="upload-privacy">Privacy</label>
                  <select id="upload-privacy" name="privacy" className="select">
                    <option value="private">Private</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="public">Public</option>
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="upload-kids">Made for Kids?</label>
                  <select id="upload-kids" name="kids" className="select">
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setUploadModal(null)} disabled={uploading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? <span className="spinner" /> : <Icon name="upload" size={14} />}
                  {uploading ? 'Uploading…' : 'Publish to YouTube'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
