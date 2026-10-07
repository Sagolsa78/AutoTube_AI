import React, { useState, useEffect } from 'react';
import Icon from '../../../components/Icon';
import { api } from '../../../services/api';
import { toast } from 'sonner';

const PLATFORM_CONFIG = [
  { id: 'youtube', name: 'YouTube', icon: 'youtube', color: 'bg-[#FF0000]' },
  { id: 'instagram', name: 'Instagram', icon: 'instagram', color: 'bg-[#E1306C]' },
  { id: 'facebook', name: 'Facebook', icon: 'facebook', color: 'bg-[#1877F2]' },
  { id: 'tiktok', name: 'TikTok', icon: 'tiktok', color: 'bg-[#000000]' },
];

export default function PublishComposer({ video, onClose }) {
  const [platforms, setPlatforms] = useState(PLATFORM_CONFIG.map(p => ({ ...p, connected: false })));
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [activePreview, setActivePreview] = useState('youtube');
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [formData, setFormData] = useState({
    title: video?.title || video?.description?.substring(0, 30) || '',
    caption: video?.description || '',
    hashtags: video?.hashtags || '#shorts #viral #ai',
    scheduleDate: '',
    scheduleTime: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchConnections = async () => {
      setLoadingConfig(true);
      try {
        const platformStates = await Promise.all(
          PLATFORM_CONFIG.map(async (p) => {
            try {
              let res;
              if (p.id === 'youtube') {
                res = await api.getYoutubeStatus();
              } else {
                res = await api.getIntegrationStatus(p.id);
              }
              return { ...p, connected: res?.connected || false };
            } catch (err) {
              return { ...p, connected: false };
            }
          })
        );
        setPlatforms(platformStates);

        // Auto-select connected ones
        const connected = platformStates.filter(p => p.connected).map(p => p.id);
        if (connected.length > 0) {
           setSelectedPlatforms(connected);
           setActivePreview(connected[0]);
        }
      } catch (err) {
        toast.error("Failed to load platform connections.");
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConnections();
  }, []);

  const togglePlatform = (id) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
    if (!selectedPlatforms.includes(id) && activePreview !== id) {
      setActivePreview(id);
    }
  };

  const handlePublish = async () => {
    if (!video || !video.id) {
       toast.error("Application Error: Missing video context.");
       return;
    }
    if (selectedPlatforms.length === 0) return;

    setIsSubmitting(true);
    try {
      let scheduled_at = null;
      if (formData.scheduleDate && formData.scheduleTime) {
         scheduled_at = new Date(`${formData.scheduleDate}T${formData.scheduleTime}`).toISOString();
      }

      await api.publishUniversal({
        video_id: video.id,
        platforms: selectedPlatforms,
        title: formData.title,
        caption: formData.caption,
        hashtags: formData.hashtags,
        scheduled_at
      });
      toast.success(scheduled_at ? 'Post scheduled successfully' : 'Publishing queued');
      onClose(); // close on success
    } catch (err) {
      console.error("Publishing failed", err);
      toast.error(err.message || 'Publishing failed. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in">
      <div className="bg-surface border border-border w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-dropdown flex overflow-hidden">

        {/* Left Column: Form & Validation */}
        <div className="w-1/2 flex flex-col bg-surface border-r border-border">
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
            <h2 className="text-lg font-bold text-text-primary">Universal Publisher</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-elevated">
              <Icon name="x" size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 hide-scrollbar">

            {/* Platform Selection */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Publish To</label>
              {loadingConfig ? (
                <div className="flex gap-3"><div className="h-10 bg-elevated rounded animate-pulse w-24"></div><div className="h-10 bg-elevated rounded animate-pulse w-24"></div></div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {platforms.map(p => {
                    const isSelected = selectedPlatforms.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => togglePlatform(p.id)}
                        disabled={!p.connected}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                          !p.connected ? 'opacity-50 cursor-not-allowed bg-canvas border-border/50' :
                          isSelected ? `border-transparent text-white ${p.color} shadow-sm` :
                          'bg-elevated border-border text-text-secondary hover:text-text-primary hover:border-border-strong'
                        }`}
                        title={!p.connected ? 'Platform not connected' : ''}
                      >
                        <Icon name={p.icon} size={16} />
                        <span className="text-xs font-bold">{p.name}</span>
                        {!p.connected && <Icon name="lock" size={12} className="ml-1 opacity-50" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Content Form */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Video Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-canvas border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-red"
                  placeholder="Catchy title..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Caption / Description</label>
                <textarea
                  value={formData.caption}
                  onChange={e => setFormData({...formData, caption: e.target.value})}
                  className="w-full bg-canvas border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-red h-24 resize-none"
                  placeholder="Engaging description..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Hashtags</label>
                <input
                  type="text"
                  value={formData.hashtags}
                  onChange={e => setFormData({...formData, hashtags: e.target.value})}
                  className="w-full bg-canvas border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-red font-mono"
                  placeholder="#shorts #trending"
                />
              </div>
            </div>

            {/* Platform Validation Warnings */}
            {selectedPlatforms.length > 0 && (
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Platform Validation</label>
                <div className="space-y-2">
                  {selectedPlatforms.map(pid => {
                    const platform = platforms.find(p => p.id === pid);
                    if (!platform) return null;

                    return (
                      <div key={pid} className="flex items-start gap-3 p-3 bg-canvas rounded-xl border border-border">
                        <Icon name={platform.icon} size={16} className={`mt-0.5 text-[${platform.color}]`} style={{ color: platform.color.replace('bg-[', '').replace(']', '') }} />
                        <div className="flex-1 space-y-1">
                          <p className="text-xs font-bold text-text-primary">{platform.name}</p>
                          <div className="flex flex-wrap gap-2 text-[10px] text-text-muted">
                            <span className="flex items-center gap-1 text-success"><Icon name="check" size={10} /> Caption valid</span>
                            <span className="flex items-center gap-1 text-success"><Icon name="check" size={10} /> Aspect ratio</span>
                            {pid === 'facebook' && <span className="flex items-center gap-1 text-warning"><Icon name="alert-triangle" size={10} /> Thumbnail recommended</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-border bg-canvas flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={formData.scheduleDate}
                onChange={e => setFormData({...formData, scheduleDate: e.target.value})}
                className="bg-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none"
              />
              <input
                type="time"
                value={formData.scheduleTime}
                onChange={e => setFormData({...formData, scheduleTime: e.target.value})}
                className="bg-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none"
              />
            </div>
            <button
              onClick={handlePublish}
              disabled={isSubmitting || selectedPlatforms.length === 0 || !video?.id}
              className="px-6 py-2.5 bg-brand-red text-white font-bold rounded-xl shadow-brand-glow hover:bg-brand-red-hover transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Scheduling...' : 'Schedule Post'}
            </button>
          </div>
        </div>

        {/* Right Column: Platform Previews */}
        <div className="w-1/2 bg-canvas flex flex-col">
           <div className="p-4 border-b border-border flex items-center gap-2 overflow-x-auto hide-scrollbar shrink-0">
             {selectedPlatforms.length === 0 && (
               <span className="text-xs text-text-muted">Select a platform to preview</span>
             )}
             {selectedPlatforms.map(pid => {
               const p = platforms.find(x => x.id === pid);
               return (
                 <button
                   key={pid}
                   onClick={() => setActivePreview(pid)}
                   className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                     activePreview === pid ? 'bg-surface text-text-primary shadow-sm border border-border' : 'text-text-muted hover:text-text-primary'
                   }`}
                 >
                   <Icon name={p.icon} size={14} style={{ color: activePreview === pid ? p.color.replace('bg-[', '').replace(']', '') : undefined }} /> {p.name}
                 </button>
               );
             })}
           </div>

           <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
             {/* Mobile Device Frame for Preview */}
             {selectedPlatforms.length > 0 && activePreview ? (
               <div className="w-[280px] h-[580px] bg-surface rounded-[32px] border-8 border-elevated overflow-hidden relative shadow-2xl shrink-0">
                 {/* Content */}
                 <div className="absolute inset-0 bg-black flex flex-col">
                    {/* Video Area */}
                    <div className="flex-1 relative">
                      {video?.final_video_url ? (
                        <video src={video.final_video_url} className="w-full h-full object-cover" loop autoPlay muted playsInline />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white">
                           <Icon name="video" size={32} className="opacity-50 mb-2" />
                           <span className="text-xs opacity-50">Preview unavailable</span>
                        </div>
                      )}
                    </div>
                    {/* Overlay UI based on platform */}
                    <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-12 text-white">
                      <div className="flex items-end justify-between">
                        <div className="space-y-2 flex-1 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-white/20" />
                            <span className="text-sm font-bold">@channel_name</span>
                            {activePreview === 'youtube' && <span className="px-2 py-0.5 bg-white text-black text-[10px] font-bold rounded">SUBSCRIBE</span>}
                          </div>
                          <p className="text-xs line-clamp-2">{formData.title}</p>
                          <p className="text-[10px] text-white/70 line-clamp-1">{formData.hashtags}</p>
                        </div>
                        <div className="flex flex-col items-center gap-4 pb-2">
                           <div className="flex flex-col items-center gap-1"><div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"><Icon name="heart" size={16} /></div><span className="text-[10px]">12K</span></div>
                           <div className="flex flex-col items-center gap-1"><div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"><Icon name="message-circle" size={16} /></div><span className="text-[10px]">34</span></div>
                           <div className="flex flex-col items-center gap-1"><div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"><Icon name="share" size={16} /></div><span className="text-[10px]">Share</span></div>
                        </div>
                      </div>
                    </div>
                 </div>
               </div>
             ) : (
               <div className="text-text-muted text-sm flex flex-col items-center gap-3">
                 <Icon name="eye-off" size={32} />
                 Preview not available
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
