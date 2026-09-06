import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';
import Button from '../components/Button';
import Badge from '../components/Badge';
import { toast } from 'sonner';

const CustomPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    if (videoRef.current.paused) {
      videoRef.current.play();
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current.duration) {
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (videoRef.current && videoRef.current.duration) {
      videoRef.current.currentTime = pos * videoRef.current.duration;
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current.parentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="custom-player-wrapper" style={{ position: 'relative', width: '100%', aspectRatio: '9/16', background: '#000', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
      <video 
        ref={videoRef} 
        src={src} 
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setPlaying(false)}
        muted={muted}
        onClick={togglePlay}
        playsInline
      />
      <div className="custom-player-controls" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '30px 20px 20px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
        <div className="progress-bar" style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.3)', borderRadius: '3px', cursor: 'pointer', marginBottom: '16px' }}
             onClick={handleSeek}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.1s linear' }} />
        </div>
        <div className="flex justify-between items-center">
          <button className="btn btn-icon" onClick={togglePlay} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', border: 'none' }}>
            <Icon name={playing ? 'pause' : 'play'} size={20} />
          </button>
          <div className="flex gap-2">
            <button className="btn btn-icon" onClick={() => setMuted(!muted)} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', border: 'none' }}>
              <Icon name={muted ? 'volume-x' : 'volume-2'} size={20} />
            </button>
            <button className="btn btn-icon" onClick={toggleFullscreen} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', border: 'none' }}>
              <Icon name="maximize" size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Videos() {
  const [videos, setVideos] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadModal, setUploadModal] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState(null);
  
  const [metaEdit, setMetaEdit] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [data, allScripts, allIdeas] = await Promise.all([
        api.getVideos(),
        api.getScripts(),
        api.getIdeas()
      ]);
      const sorted = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setVideos(sorted);
      setScripts(allScripts);
      setIdeas(allIdeas);
      if (sorted.length > 0 && !activeVideoId) {
        setActiveVideoId(sorted[0].id);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const isRendering = videos.some(v => v.status === 'rendering');
    const iv = setInterval(load, isRendering ? 3000 : 6000);
    return () => clearInterval(iv);
  }, [videos]);

  useEffect(() => {
    const activeVideo = videos.find(v => v.id === activeVideoId) || videos[0];
    if (activeVideo && activeVideo.status === 'ready') {
      if (!metaEdit || metaEdit.id !== activeVideo.id) {
        setMetaEdit({
          id: activeVideo.id,
          selected_title: activeVideo.selected_title || (activeVideo.title_candidates || [])[0] || '',
          description: activeVideo.description || '',
          hashtags: (activeVideo.hashtags || []).join(', ')
        });
      }
    } else {
      setMetaEdit(null);
    }
  }, [activeVideoId, videos]);
  
  // Keyboard shortcuts for review mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (uploadModal) return;
      const activeIndex = videos.findIndex(v => v.id === activeVideoId);
      if (activeIndex === -1) return;
      
      const v = videos[activeIndex];
      
      if (e.key === 'ArrowRight' && activeIndex < videos.length - 1) {
        setActiveVideoId(videos[activeIndex + 1].id);
      } else if (e.key === 'ArrowLeft' && activeIndex > 0) {
        setActiveVideoId(videos[activeIndex - 1].id);
      } else if (e.key === 'a' && v.status === 'ready') {
        action(v.id, 'approve');
      } else if (e.key === 'r' && v.status === 'ready') {
        action(v.id, 'reject');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videos, activeVideoId, uploadModal]);

  const action = async (id, act) => {
    try {
      if (act === 'approve') {
        const payload = metaEdit && metaEdit.id === id ? {
          selected_title: metaEdit.selected_title,
          description: metaEdit.description,
          hashtags: metaEdit.hashtags.split(',').map(s => s.trim()).filter(Boolean)
        } : null;
        await api.approveVideo(id, payload);
      }
      else await api.rejectVideo(id);
      
      // Move to next video if available
      const activeIndex = videos.findIndex(v => v.id === id);
      if (activeIndex !== -1 && activeIndex < videos.length - 1) {
        setActiveVideoId(videos[activeIndex + 1].id);
      }
      
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
      toast.success('Upload completed successfully.');
      setUploadModal(null);
      await load();
    } catch (e) { console.error(e); toast.error(`Upload failed: ${e.message}`); }
    finally { setUploading(false); }
  };
  
  const activeVideo = videos.find(v => v.id === activeVideoId) || videos[0];
  const activeScript = activeVideo ? scripts.find(s => s.id === activeVideo.script_id) : null;
  const activeIdea = activeScript ? ideas.find(i => i.id === activeScript.idea_id) : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Review Studio</h1>
          <p>Review, approve, and upload your rendered Shorts.</p>
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
        <div className="review-mode-layout" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Main Stage */}
          {activeVideo && (
            <div className="main-stage" style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', background: 'var(--surface-3)', padding: '24px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-1)' }}>
              
              <div style={{ flex: '0 0 320px' }}>
                {['ready', 'approved', 'uploaded'].includes(activeVideo.status) ? (
                  <CustomPlayer src={`/api/videos/${activeVideo.id}/preview`} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '9/16', background: 'var(--surface-input)', display: 'grid', placeItems: 'center', borderRadius: 'var(--r-md)', border: '1px solid var(--border-2)' }}>
                    {activeVideo.status === 'rendering' ? (
                      <div className="flex-col items-center gap-3 w-full" style={{ padding: '0 24px' }}>
                        <span className="spinner spinner-lg badge-rendering" />
                        <span className="text-lg font-bold" style={{ color: 'var(--warning)' }}>Rendering...</span>
                        
                        <div className="render-stage-timeline mt-3 w-full justify-center">
                          {['tts', 'visuals', 'assembly', 'metadata'].map((stageName, i) => {
                            const stages = ['tts', 'visuals', 'assembly', 'metadata'];
                            const currentIdx = stages.indexOf(activeVideo.render_stage || 'tts');
                            const isDone = i < currentIdx;
                            const isActive = i === currentIdx;
                            
                            let icon = 'mic';
                            if (stageName === 'visuals') icon = 'image';
                            if (stageName === 'assembly') icon = 'film';
                            if (stageName === 'metadata') icon = 'fileText';
                            
                            return (
                              <div key={stageName} className={`render-stage-step ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                                <div className="render-stage-dot">
                                  {isActive ? <span className="spinner spinner-sm" /> : <Icon name={icon} size={12} />}
                                </div>
                                <span>{stageName.charAt(0).toUpperCase() + stageName.slice(1)}</span>
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className="render-progress-bar-track mt-2 w-full">
                          <div className="render-progress-bar-fill" style={{ width: `${activeVideo.render_progress || 0}%` }}></div>
                        </div>
                        <div className="text-xs text-muted font-mono mt-1">{Math.round(activeVideo.render_progress || 0)}% Complete</div>
                      </div>
                    ) : <span className="text-muted">—</span>}
                  </div>
                )}
              </div>
              
              <div className="video-metadata" style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 style={{ fontSize: '24px', marginBottom: '4px', color: 'var(--text-0)' }}>
                      {activeIdea ? activeIdea.topic : `Render #${activeVideo.id.substring(0, 8)}`}
                    </h2>
                    <p className="text-muted text-sm" style={{ marginBottom: '12px' }}>
                      Script ID: {activeVideo.script_id.substring(0, 8)}
                    </p>
                    <div className="flex gap-2 items-center">
                      <Badge variant={activeVideo.status} style={{ fontSize: '13px', padding: '6px 12px' }}>{activeVideo.status}</Badge>
                      <span className="text-muted mono">{activeVideo.duration ? `${activeVideo.duration.toFixed(1)}s` : '—'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="metadata-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--surface-input)', padding: '20px', borderRadius: 'var(--r-sm)' }}>
                  <div>
                    <div className="text-muted text-xs uppercase" style={{ letterSpacing: '0.05em', marginBottom: '4px' }}>Caption Style</div>
                    <div className="font-bold">{activeVideo.caption_style || 'Default'}</div>
                  </div>
                  <div>
                    <div className="text-muted text-xs uppercase" style={{ letterSpacing: '0.05em', marginBottom: '4px' }}>AI Generated</div>
                    <div className="font-bold">{activeVideo.ai_used ? 'Yes' : 'No'}</div>
                  </div>
                  <div>
                    <div className="text-muted text-xs uppercase" style={{ letterSpacing: '0.05em', marginBottom: '4px' }}>Created</div>
                    <div className="font-bold">{new Date(activeVideo.created_at).toLocaleString()}</div>
                  </div>
                </div>

                {activeVideo.notes && (
                  <div style={{ background: 'var(--error-muted)', color: 'var(--error)', padding: '16px', borderRadius: 'var(--r-sm)', border: '1px solid rgba(255, 77, 79, 0.2)' }}>
                    <strong>Error Notes:</strong> {activeVideo.notes}
                  </div>
                )}

                {activeScript && (
                  <div style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-1)', maxHeight: '180px', overflowY: 'auto' }}>
                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-2)', marginBottom: '8px' }}>Script Used</h4>
                    <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-1)' }}>{activeScript.full_text}</p>
                  </div>
                )}
                
                {activeVideo.status === 'ready' && metaEdit && metaEdit.id === activeVideo.id && (
                  <div style={{ background: 'var(--surface-input)', padding: '16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-1)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-2)' }}>YouTube Metadata (Editable)</h4>
                    
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label className="label" style={{ fontSize: '12px' }}>Title</label>
                      <div className="flex gap-2">
                        <select className="select" style={{ flex: 1 }} value={metaEdit.selected_title} onChange={e => setMetaEdit({...metaEdit, selected_title: e.target.value})}>
                          {(activeVideo.title_candidates || []).map((t, i) => <option key={i} value={t}>{t}</option>)}
                          {!activeVideo.title_candidates?.includes(metaEdit.selected_title) && <option value={metaEdit.selected_title}>Custom Title</option>}
                        </select>
                        <input className="input" style={{ flex: 1 }} value={metaEdit.selected_title} onChange={e => setMetaEdit({...metaEdit, selected_title: e.target.value})} placeholder="Or type a custom title..." />
                      </div>
                    </div>
                    
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label className="label" style={{ fontSize: '12px' }}>Description</label>
                      <textarea className="textarea" rows="2" style={{ resize: 'vertical' }} value={metaEdit.description} onChange={e => setMetaEdit({...metaEdit, description: e.target.value})} />
                    </div>
                    
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label className="label" style={{ fontSize: '12px' }}>Hashtags</label>
                      <input className="input" value={metaEdit.hashtags} onChange={e => setMetaEdit({...metaEdit, hashtags: e.target.value})} />
                    </div>
                  </div>
                )}
                
                {['approved', 'uploaded'].includes(activeVideo.status) && (
                  <div style={{ background: 'var(--surface-input)', padding: '16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-1)' }}>
                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-2)', marginBottom: '8px' }}>YouTube Metadata</h4>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-0)' }}>{activeVideo.selected_title || 'Untitled'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-1)', marginBottom: '8px', opacity: 0.8 }}>{activeVideo.description}</div>
                    <div style={{ fontSize: '12px', color: 'var(--accent)' }}>{(activeVideo.hashtags || []).map(t => `#${t}`).join(' ')}</div>
                  </div>
                )}

                <div className="actions" style={{ display: 'flex', gap: '16px', marginTop: 'auto' }}>
                  {activeVideo.status === 'ready' && (
                    <>
                      <Button variant="primary" style={{ flex: 1, padding: '16px', fontSize: '16px', fontWeight: 600, background: 'var(--success)', border: 'none' }} onClick={() => action(activeVideo.id, 'approve')}>
                        <Icon name="check" size={20} /> Approve <span className="mono" style={{ opacity: 0.5, fontSize: '12px', marginLeft: '8px' }}>[A]</span>
                      </Button>
                      <Button variant="primary" style={{ flex: 1, padding: '16px', fontSize: '16px', fontWeight: 600, background: 'var(--danger)', border: 'none' }} onClick={() => action(activeVideo.id, 'reject')}>
                        <Icon name="x" size={20} /> Reject <span className="mono" style={{ opacity: 0.5, fontSize: '12px', marginLeft: '8px' }}>[R]</span>
                      </Button>
                    </>
                  )}
                  {activeVideo.status === 'approved' && (
                    <Button variant="primary" style={{ flex: 1, padding: '16px', fontSize: '16px', fontWeight: 600 }} onClick={() => setUploadModal(activeVideo)}>
                      <Icon name="upload" size={20} /> Upload to YouTube
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Filmstrip */}
          <div>
            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-2)', marginBottom: '16px' }}>Bin / Up Next</h3>
            <div className="filmstrip" style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px' }}>
              {videos.map(v => (
                <div 
                  key={v.id} 
                  className={`filmstrip-item ${v.id === activeVideoId ? 'active' : ''}`}
                  onClick={() => setActiveVideoId(v.id)}
                  style={{ 
                    flex: '0 0 120px', 
                    cursor: 'pointer',
                    background: 'var(--surface-input)',
                    borderRadius: 'var(--r-sm)',
                    overflow: 'hidden',
                    border: v.id === activeVideoId ? '2px solid var(--accent)' : '1px solid var(--border-2)',
                    opacity: v.id === activeVideoId ? 1 : 0.6,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ aspectRatio: '9/16', background: v.status === 'rendering' ? 'var(--warning-muted)' : '#000', display: 'grid', placeItems: 'center' }}>
                    {v.status === 'rendering' ? <Icon name="loader" className="badge-rendering" style={{ color: 'var(--warning)' }} /> : 
                     ['ready', 'approved', 'uploaded'].includes(v.status) ? (
                        <video src={`/api/videos/${v.id}/preview`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                     ) : <Icon name="video" style={{ color: 'var(--text-3)' }} />}
                  </div>
                  <div style={{ padding: '8px', fontSize: '11px', borderTop: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between' }}>
                    <span className="mono">{v.id.substring(0, 4)}</span>
                    <Badge variant={v.status} style={{ padding: '2px 4px', fontSize: '9px' }}>{v.status.substring(0, 1).toUpperCase()}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
                <input id="upload-title" name="title" className="input" required defaultValue={uploadModal.selected_title || ''} maxLength={100} />
              </div>
              <div className="field">
                <label className="label" htmlFor="upload-desc">Description</label>
                <textarea id="upload-desc" name="description" className="textarea" required defaultValue={uploadModal.description || ''} />
              </div>
              <div className="field">
                <label className="label" htmlFor="upload-tags">Tags (comma separated)</label>
                <input id="upload-tags" name="tags" className="input" defaultValue={(uploadModal.hashtags || []).join(', ')} />
              </div>
              <div className="row-2">
                <div className="field">
                  <label className="label" htmlFor="upload-privacy">Privacy</label>
                  <select id="upload-privacy" name="privacy" className="select" defaultValue="public">
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
