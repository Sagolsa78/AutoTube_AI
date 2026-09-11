import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';
import GridContainer from '../components/layout/GridContainer';
import PageHeader from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import { toast } from 'sonner';

const CustomPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
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
      videoRef.current?.parentElement?.requestFullscreen().catch(err => {
        console.error(`Fullscreen failed: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="relative w-full aspect-[9/16] max-h-[580px] sm:max-h-[640px] bg-black rounded-xl overflow-hidden shadow-2xl border border-border group select-none">
      <video 
        ref={videoRef} 
        src={src} 
        className="w-full h-full object-cover cursor-pointer"
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setPlaying(false)}
        muted={muted}
        onClick={togglePlay}
        playsInline
      />
      
      {/* Controls Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
        {/* Scrubber */}
        <div 
          className="w-full h-2 bg-white/20 hover:h-2.5 rounded-full cursor-pointer mb-3 relative transition-all"
          onClick={handleSeek}
        >
          <div 
            className="absolute top-0 left-0 h-full bg-brand-red rounded-full"
            style={{ width: `${progress}%` }} 
          />
        </div>

        {/* Action Controls */}
        <div className="flex justify-between items-center text-white">
          <button 
            type="button"
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={20} />
          </button>
          
          <div className="flex gap-2">
            <button 
              type="button"
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              onClick={() => setMuted(!muted)}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              <Icon name={muted ? 'volume-x' : 'volume-2'} size={20} />
            </button>
            <button 
              type="button"
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              onClick={toggleFullscreen}
              aria-label="Toggle Fullscreen"
            >
              <Icon name="maximize" size={20} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Centered Play Button when paused */}
      {!playing && (
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer pointer-events-none"
        >
          <div className="w-14 h-14 bg-brand-red text-white rounded-full flex items-center justify-center shadow-brand-glow backdrop-blur-sm">
            <Icon name="play" size={26} className="ml-1" />
          </div>
        </div>
      )}
    </div>
  );
};

export default function Videos({ filter }) {
  const [videos, setVideos] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadModal, setUploadModal] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [metaEdit, setMetaEdit] = useState(null);

  const load = async () => {
    try {
      const [data, allScripts, allIdeas] = await Promise.all([
        api.getVideos(),
        api.getScripts(),
        api.getIdeas()
      ]);
      
      let sorted = (data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      if (filter === 'best') {
        sorted = sorted.filter(v => v.status === 'approved' || v.status === 'uploaded');
      }

      setVideos(sorted);
      setScripts(allScripts || []);
      setIdeas(allIdeas || []);
      
      if (sorted.length > 0 && !activeVideoId) {
        setActiveVideoId(sorted[0].id);
      }
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

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
  
  // Keyboard Shortcuts (Arrow navigation, [A] Approve, [R] Reject)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (uploadModal || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
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
        toast.success("Video approved for publication.");
      } else {
        await api.rejectVideo(id);
        toast.error("Video rejected.");
      }
      
      const activeIndex = videos.findIndex(v => v.id === id);
      if (activeIndex !== -1 && activeIndex < videos.length - 1) {
        setActiveVideoId(videos[activeIndex + 1].id);
      }
      
      await load();
    } catch (e) { 
      console.error(e);
      toast.error(`Action failed: ${e.message}`);
    }
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
      toast.success('Successfully published to YouTube!');
      setUploadModal(null);
      await load();
    } catch (e) { 
      console.error(e); 
      toast.error(`Upload failed: ${e.message}`); 
    } finally { 
      setUploading(false); 
    }
  };

  if (loading && !videos.length) {
    return (
      <GridContainer>
        <div className="space-y-6">
          <Skeleton height="60px" rounded="rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5">
              <Skeleton height="500px" rounded="rounded-xl" />
            </div>
            <div className="lg:col-span-7 space-y-6">
              <Skeleton height="280px" rounded="rounded-xl" />
              <Skeleton height="160px" rounded="rounded-xl" />
            </div>
          </div>
        </div>
      </GridContainer>
    );
  }

  if (!videos.length) {
    return (
      <GridContainer>
        <PageHeader 
          title={filter === 'best' ? 'Best Content' : 'Review Queue'}
          description={filter === 'best' ? 'Curated highest-rated videos ready for YouTube.' : 'Review, approve, and upload your rendered Shorts.'}
        />
        <EmptyState
          icon="video"
          title={filter === 'best' ? 'No Approved Videos' : 'Review Queue Empty'}
          description={
            filter === 'best'
              ? 'You do not have any approved or published videos yet. Approve videos from the queue to showcase them here.'
              : 'There are no videos awaiting review. Open the Studio to storyboard and render a new Short.'
          }
        />
      </GridContainer>
    );
  }

  const activeVideo = videos.find(v => v.id === activeVideoId) || videos[0];
  const activeScript = activeVideo ? scripts.find(s => s.id === activeVideo.script_id) : null;
  const activeIdea = activeScript ? ideas.find(i => i.id === activeScript.idea_id) : null;

  return (
    <GridContainer>
      <div className="space-y-6">
        <PageHeader
          title={filter === 'best' ? 'Best Content' : 'Review Queue'}
          description={filter === 'best' ? 'Your highest-scoring videos approved and ready for YouTube publishing.' : 'Media-first creator inspection room with instant approve/reject controls.'}
          badge={
            <span className="text-xs font-mono font-semibold text-text-secondary bg-elevated px-2.5 py-1 rounded border border-border">
              {videos.length} Video{videos.length > 1 ? 's' : ''} in view
            </span>
          }
          actions={
            filter === 'best' && activeVideo && (
              <Button 
                variant="primary" 
                size="sm" 
                icon="upload" 
                onClick={() => setUploadModal(activeVideo)}
              >
                Publish Top Video
              </Button>
            )
          }
        />

        {/* Media-First Review Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT/TOP: 9:16 Video Player Surface (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4 w-full max-w-md mx-auto lg:max-w-none">
            {['ready', 'approved', 'uploaded'].includes(activeVideo.status) ? (
              <CustomPlayer src={`/api/videos/${activeVideo.id}/preview`} />
            ) : (
              <div className="w-full aspect-[9/16] max-h-[580px] bg-surface rounded-xl border border-border flex items-center justify-center p-6 shadow-card-subtle">
                {['rendering', 'paused'].includes(activeVideo.status) ? (
                  <div className="flex flex-col items-center text-center w-full max-w-[260px]">
                    <Icon name="loader" size={36} className="text-warning animate-spin mb-4" />
                    <span className="text-base font-bold text-warning mb-4">Rendering Video</span>
                    
                    <div className="w-full space-y-3 mb-6">
                      {['tts', 'visuals', 'assembly', 'metadata'].map((stageName, i) => {
                        const stages = ['tts', 'visuals', 'assembly', 'metadata'];
                        const currentIdx = stages.indexOf(activeVideo.render_stage || 'tts');
                        const isDone = i < currentIdx;
                        const isActive = i === currentIdx;
                        
                        return (
                          <div key={stageName} className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                              isDone ? 'bg-success text-canvas font-bold' : isActive ? 'bg-warning text-canvas font-bold animate-pulse' : 'bg-elevated text-text-muted border border-border'
                            }`}>
                              {isDone ? '✓' : i + 1}
                            </div>
                            <span className={`text-xs font-semibold ${isDone ? 'text-success' : isActive ? 'text-text-primary' : 'text-text-muted'}`}>
                              {stageName.toUpperCase()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="w-full bg-elevated rounded-full h-2 overflow-hidden mb-2">
                      <div className="bg-warning h-full transition-all duration-300" style={{ width: `${activeVideo.render_progress || 0}%` }} />
                    </div>
                    <span className="text-xs font-mono text-text-muted">{Math.round(activeVideo.render_progress || 0)}% Completed</span>
                    
                    <div className="flex gap-2 w-full mt-4">
                      {activeVideo.status === 'rendering' ? (
                        <button type="button" className="btn btn-secondary flex-1 py-2 text-xs flex items-center justify-center" onClick={() => api.pauseVideo(activeVideo.id).then(load)}>
                          <Icon name="pause" size={14} className="mr-1" /> Pause
                        </button>
                      ) : (
                        <button type="button" className="btn btn-primary flex-1 py-2 text-xs flex items-center justify-center" onClick={() => api.resumeVideo(activeVideo.id).then(load)}>
                          <Icon name="play" size={14} className="mr-1" /> Resume
                        </button>
                      )}
                      <button type="button" className="btn btn-danger flex-1 py-2 text-xs flex items-center justify-center" onClick={() => api.cancelVideo(activeVideo.id).then(load)}>
                        <Icon name="x" size={14} className="mr-1" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-text-muted gap-2">
                    <Icon name="alert-triangle" size={32} />
                    <span className="text-xs font-semibold">Preview Unavailable</span>
                  </div>
                )}
              </div>
            )}

            {/* Accessible Primary Action Buttons (§12 & §22) */}
            <div className="flex gap-3 w-full">
              {activeVideo.status === 'ready' && (
                <>
                  <button
                    type="button"
                    className="btn btn-success flex-1 py-3 text-sm font-bold shadow-md"
                    onClick={() => action(activeVideo.id, 'approve')}
                  >
                    <Icon name="check" size={16} /> Approve <span className="text-[11px] opacity-60 ml-1 hidden sm:inline">[A]</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger flex-1 py-3 text-sm font-bold shadow-md"
                    onClick={() => action(activeVideo.id, 'reject')}
                  >
                    <Icon name="x" size={16} /> Reject <span className="text-[11px] opacity-60 ml-1 hidden sm:inline">[R]</span>
                  </button>
                </>
              )}
              {activeVideo.status === 'approved' && (
                <button
                  type="button"
                  className="btn btn-primary w-full py-3 text-sm font-bold shadow-brand-glow"
                  onClick={() => setUploadModal(activeVideo)}
                >
                  <Icon name="upload" size={16} /> Publish to YouTube
                </button>
              )}
            </div>
          </div>

          {/* RIGHT/BOTTOM: Metadata Inspector & Filmstrip (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6 min-w-0">
            
            {/* Metadata Inspector Card */}
            <Card variant="surface">
              <CardHeader
                title={
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={activeVideo.status} />
                    <span className="text-xs font-mono text-text-muted bg-elevated px-2 py-0.5 rounded border border-border">
                      {activeVideo.id?.substring(0, 8)}
                    </span>
                    {activeVideo.duration && (
                      <span className="text-xs font-mono text-text-secondary bg-elevated px-2 py-0.5 rounded border border-border">
                        {activeVideo.duration.toFixed(1)}s
                      </span>
                    )}
                  </div>
                }
              />
              
              <CardContent className="space-y-5">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight break-words">
                    {activeIdea ? activeIdea.topic : (activeVideo.selected_title || `Render #${activeVideo.id?.substring(0, 8)}`)}
                  </h2>
                </div>

                {/* Video Info Grid */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-elevated p-3 rounded-lg border border-border">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-1">Style</span>
                    <span className="font-semibold text-text-primary">{activeVideo.caption_style || 'Default'}</span>
                  </div>
                  <div className="bg-elevated p-3 rounded-lg border border-border">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-1">Created</span>
                    <span className="font-semibold text-text-primary">{new Date(activeVideo.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="bg-elevated p-3 rounded-lg border border-border">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-1">AI Voice</span>
                    <span className="font-semibold text-text-primary">Edge-TTS</span>
                  </div>
                </div>

                {/* Editable Metadata when in Ready state */}
                {activeVideo.status === 'ready' && metaEdit && metaEdit.id === activeVideo.id && (
                  <div className="bg-elevated/70 p-4 rounded-xl border border-border space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
                      Editable YouTube Metadata
                    </span>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Title</label>
                      <input 
                        type="text" 
                        className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none"
                        value={metaEdit.selected_title} 
                        onChange={e => setMetaEdit({...metaEdit, selected_title: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
                      <textarea 
                        className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none min-h-[70px]"
                        value={metaEdit.description} 
                        onChange={e => setMetaEdit({...metaEdit, description: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Hashtags</label>
                      <input 
                        type="text" 
                        className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-info focus:border-brand-red focus:outline-none"
                        value={metaEdit.hashtags} 
                        onChange={e => setMetaEdit({...metaEdit, hashtags: e.target.value})} 
                      />
                    </div>
                  </div>
                )}

                {/* Read-Only Published/Approved Metadata */}
                {['approved', 'uploaded'].includes(activeVideo.status) && (
                  <div className="bg-elevated/50 p-4 rounded-xl border border-border space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
                      Published YouTube Metadata
                    </span>
                    <h4 className="font-bold text-sm text-text-primary">{activeVideo.selected_title || 'Untitled'}</h4>
                    <p className="text-xs text-text-secondary line-clamp-2">{activeVideo.description}</p>
                    <div className="text-xs font-mono text-info">
                      {(activeVideo.hashtags || []).map(t => `#${t}`).join(' ')}
                    </div>
                  </div>
                )}

                {/* Source Script Excerpt */}
                {activeScript && (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block mb-2">
                      Source Narration Script
                    </span>
                    <div className="bg-elevated/40 p-3.5 rounded-xl border border-border max-h-36 overflow-y-auto text-xs text-text-secondary leading-relaxed font-sans">
                      {activeScript.full_text || 'No script text available.'}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Filmstrip / Video Queue Scroller (§12 & §23) */}
            <Card variant="surface">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="film" size={16} className="text-brand-red" />}>
                    Review Queue Filmstrip
                  </CardTitle>
                }
                action={
                  <span className="text-xs font-mono text-text-muted">
                    {videos.findIndex(v => v.id === activeVideoId) + 1} of {videos.length}
                  </span>
                }
              />
              <CardContent>
                <div className="flex gap-3 overflow-x-auto pb-3 snap-x hide-scrollbar">
                  {videos.map((v) => {
                    const isActive = v.id === activeVideoId;
                    return (
                      <div
                        key={v.id}
                        onClick={() => setActiveVideoId(v.id)}
                        className={`relative shrink-0 w-24 sm:w-28 aspect-[9/16] rounded-xl overflow-hidden cursor-pointer snap-start transition-all border-2 select-none ${
                          isActive 
                            ? 'border-brand-red scale-105 shadow-brand-glow z-10' 
                            : 'border-border/80 opacity-70 hover:opacity-100 hover:border-border-strong'
                        }`}
                      >
                        {/* Poster / Preview representation */}
                        <div className="absolute inset-0 bg-elevated flex items-center justify-center">
                          {['rendering', 'paused'].includes(v.status) ? (
                            <Icon name="loader" size={20} className="text-warning animate-spin" />
                          ) : (
                            <Icon name="video" size={22} className={isActive ? 'text-brand-red' : 'text-text-muted'} />
                          )}
                        </div>

                        {/* Bottom Tag */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-white">
                            {v.id.substring(0, 4)}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${
                            v.status === 'ready' ? 'bg-success' :
                            v.status === 'rendering' ? 'bg-warning animate-pulse' :
                            v.status === 'paused' ? 'bg-warning' :
                            v.status === 'cancelled' ? 'bg-danger' :
                            v.status === 'uploaded' ? 'bg-info' : 'bg-text-muted'
                          }`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

          </div>

        </div>

        {/* YouTube Upload Modal (§18) */}
        {uploadModal && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => !uploading && setUploadModal(null)}
          >
            <div 
              className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" 
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-elevated/50">
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Icon name="youtube" size={18} className="text-brand-red" />
                  Publish Short to YouTube
                </h3>
                {!uploading && (
                  <button 
                    type="button" 
                    className="p-1.5 hover:bg-surface-hover rounded-lg text-text-secondary hover:text-text-primary transition-colors" 
                    onClick={() => setUploadModal(null)}
                  >
                    <Icon name="x" size={18} />
                  </button>
                )}
              </div>
              
              <form onSubmit={doUpload} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Title</label>
                  <input 
                    name="title" 
                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none" 
                    required 
                    defaultValue={uploadModal.selected_title || ''} 
                    maxLength={100} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
                  <textarea 
                    name="description" 
                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none min-h-[80px]" 
                    required 
                    defaultValue={uploadModal.description || ''} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Tags (comma-separated)</label>
                  <input 
                    name="tags" 
                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary focus:border-brand-red focus:outline-none" 
                    defaultValue={(uploadModal.hashtags || []).join(', ')} 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Privacy</label>
                    <select 
                      name="privacy" 
                      className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none" 
                      defaultValue="public"
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Made for Kids?</label>
                    <select 
                      name="kids" 
                      className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none" 
                      defaultValue="false"
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-border flex justify-end gap-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setUploadModal(null)} 
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    icon={uploading ? 'loader' : 'upload'} 
                    type="submit" 
                    disabled={uploading}
                    loading={uploading}
                  >
                    {uploading ? 'Publishing...' : 'Publish to YouTube'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </GridContainer>
  );
}
