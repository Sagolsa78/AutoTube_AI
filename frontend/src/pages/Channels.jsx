import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';
import GridContainer from '../components/layout/GridContainer';
import PageHeader from '../components/layout/PageHeader';
import { Card } from '../components/Card';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import { toast } from 'sonner';
import { useChannel } from '../contexts/ChannelContext';

const DEFAULT_FORM = {
  name: '',
  niche: '',
  language: 'en',
  target_audience: '',
  brand_color: '#E50914',
  watermark_position: 'bottom_right',
  watermark_scale: 0.12,
  default_voice_id: 'en-US-ChristopherNeural',
  content_tone: 'casual',
  title_style_preference: 'curiosity',
  auto_approve: false,
  niche_keywords: '',
  hashtag_set: 'shorts,viral'
};

export default function Channels() {
  const { channels, refreshChannels, activeChannelId, setActiveChannelId } = useChannel();
  const [loading, setLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null means "Create mode"
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
        setLoading(true);
        await refreshChannels();
        setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setModalOpen(true);
  };

  const openEditModal = (channel) => {
    setEditingId(channel.id);
    setForm({
        name: channel.name || '',
        niche: channel.niche || '',
        language: channel.language || 'en',
        target_audience: channel.target_audience || '',
        brand_color: channel.brand_color || '#E50914',
        watermark_position: channel.watermark_position || 'bottom_right',
        watermark_scale: channel.watermark_scale || 0.12,
        default_voice_id: channel.default_voice_id || 'en-US-ChristopherNeural',
        content_tone: channel.content_tone || 'casual',
        title_style_preference: channel.title_style_preference || 'curiosity',
        auto_approve: channel.auto_approve || false,
        niche_keywords: Array.isArray(channel.niche_keywords) ? channel.niche_keywords.join(', ') : '',
        hashtag_set: Array.isArray(channel.hashtag_set) ? channel.hashtag_set.join(', ') : ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    
    setSaving(true);
    
    const payload = {
        ...form,
        watermark_scale: parseFloat(form.watermark_scale),
        niche_keywords: form.niche_keywords.split(',').map(s => s.trim()).filter(Boolean),
        hashtag_set: form.hashtag_set.split(',').map(s => s.trim()).filter(Boolean)
    };

    try {
      if (editingId) {
          await api.updateChannel(editingId, payload);
          toast.success('Channel updated successfully!');
      } else {
          await api.createChannel(payload);
          toast.success('Channel created successfully!');
      }
      setModalOpen(false);
      await refreshChannels();
    } catch (e) { 
      console.error(e); 
      toast.error('Failed to save channel: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (channel) => {
      setChannelToDelete(channel);
      setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
      if (!channelToDelete) return;
      setDeleting(true);
      try {
          await api.deleteChannel(channelToDelete.id);
          toast.success('Channel deleted successfully.');
          
          if (activeChannelId === channelToDelete.id) {
              setActiveChannelId(null); // The Context will automatically pick the first available on reload
          }
          
          setDeleteConfirmOpen(false);
          setChannelToDelete(null);
          await refreshChannels();
      } catch (e) {
          toast.error('Failed to delete channel: ' + e.message);
      } finally {
          setDeleting(false);
      }
  };

  if (loading) {
    return (
      <GridContainer>
        <div className="space-y-6">
          <Skeleton height="60px" rounded="rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton height="160px" rounded="rounded-xl" />
            <Skeleton height="160px" rounded="rounded-xl" />
            <Skeleton height="160px" rounded="rounded-xl" />
          </div>
        </div>
      </GridContainer>
    );
  }

  return (
    <GridContainer>
      <div className="space-y-6">
        <PageHeader
          title="Channels & Niches"
          description="Manage your YouTube audience channels. Each channel establishes a specialized niche for idea brainstorming."
          actions={
            <Button
              variant="primary"
              size="sm"
              icon="plus"
              onClick={openCreateModal}
              className="shadow-brand-glow"
            >
              New Channel
            </Button>
          }
        />

        {channels.length === 0 ? (
          <EmptyState
            icon="hash"
            title="No Channels Configured"
            description="Create your first YouTube channel profile to configure audience niches and target languages."
            action={
              <Button
                variant="primary"
                size="sm"
                icon="plus"
                onClick={openCreateModal}
              >
                Create Channel
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {channels.map(ch => (
              <Card key={ch.id} variant="surface" className="flex flex-col justify-between hover:border-border-strong transition-all overflow-visible">
                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-elevated border border-border flex items-center justify-center text-brand-red shrink-0 shadow-inner">
                        <Icon name="hash" size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-text-primary truncate" title={ch.name}>
                          {ch.name}
                        </h3>
                        <span className="text-xs text-text-secondary truncate block">
                          {ch.niche || 'General YouTube Shorts'}
                        </span>
                      </div>
                    </div>
                    {activeChannelId === ch.id && (
                        <span className="inline-flex items-center gap-1 bg-success/10 border border-success/30 text-success text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded shrink-0">
                          Active
                        </span>
                    )}
                  </div>

                  <div className="space-y-2 pt-3 border-t border-border/70 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">Target Language</span>
                      <span className="font-mono font-bold uppercase text-text-primary bg-elevated px-2 py-0.5 rounded text-[11px] border border-border">
                        {ch.language || 'en'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">Brand Color</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-text-secondary">{ch.brand_color}</span>
                        <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: ch.brand_color }}></div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">Tone</span>
                      <span className="capitalize text-text-secondary">{ch.content_tone}</span>
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-border/70 flex items-center justify-end gap-2">
                      <Button variant="ghost" size="xs" icon="edit" onClick={() => openEditModal(ch)}>
                          Edit
                      </Button>
                      <button 
                        onClick={() => confirmDelete(ch)}
                        className="p-1.5 rounded text-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-colors"
                        title="Delete Channel"
                      >
                          <Icon name="trash" size={14} />
                      </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Channel Modal */}
        {modalOpen && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setModalOpen(false)}
          >
            <div 
              className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" 
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-elevated/50 shrink-0">
                <h3 className="font-bold text-sm sm:text-base text-text-primary flex items-center gap-2">
                  <Icon name={editingId ? "edit" : "plus"} size={16} className="text-brand-red" />
                  {editingId ? "Edit Channel" : "Create Target Channel"}
                </h3>
                <button 
                  type="button" 
                  className="p-1.5 hover:bg-surface-hover rounded-lg text-text-secondary hover:text-text-primary transition-colors" 
                  onClick={() => setModalOpen(false)}
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
              
              <div className="overflow-y-auto hide-scrollbar p-6">
                  <form id="channel-form" onSubmit={handleSave} className="space-y-8">
                    
                    {/* General section */}
                    <div>
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-border/50 pb-2">
                            <Icon name="info" size={14} className="text-brand-red" /> General Settings
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                            <label className="block text-xs font-semibold text-text-secondary mb-1">Channel Name *</label>
                            <input
                                className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none"
                                placeholder="e.g. Daily Tech Mysteries"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                autoFocus
                                required
                            />
                            </div>
                            
                            <div>
                            <label className="block text-xs font-semibold text-text-secondary mb-1">Primary Language</label>
                            <select 
                                className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none"
                                value={form.language} 
                                onChange={e => setForm({ ...form, language: e.target.value })}
                            >
                                <option value="en">English (en)</option>
                                <option value="hi">Hindi (hi)</option>
                                <option value="es">Spanish (es)</option>
                                <option value="fr">French (fr)</option>
                            </select>
                            </div>
                        </div>
                    </div>

                    {/* Content Strategy */}
                    <div>
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-border/50 pb-2">
                            <Icon name="target" size={14} className="text-brand-red" /> Content Strategy
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1">Target Niche / Topic</label>
                                <input
                                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none"
                                    placeholder="e.g. Science Facts, Astrophysics"
                                    value={form.niche}
                                    onChange={e => setForm({ ...form, niche: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1">Target Audience</label>
                                <input
                                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none"
                                    placeholder="e.g. Gen Z, Tech Enthusiasts"
                                    value={form.target_audience}
                                    onChange={e => setForm({ ...form, target_audience: e.target.value })}
                                />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1">Content Tone</label>
                                <select 
                                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none"
                                    value={form.content_tone} 
                                    onChange={e => setForm({ ...form, content_tone: e.target.value })}
                                >
                                    <option value="casual">Casual</option>
                                    <option value="professional">Professional</option>
                                    <option value="dramatic">Dramatic</option>
                                    <option value="funny">Funny</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1">Title Style Preference</label>
                                <select 
                                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none"
                                    value={form.title_style_preference} 
                                    onChange={e => setForm({ ...form, title_style_preference: e.target.value })}
                                >
                                    <option value="curiosity">Curiosity Gap</option>
                                    <option value="shocking">Shocking/Urgent</option>
                                    <option value="listicle">Listicle</option>
                                    <option value="story">Story-driven</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-text-secondary mb-1">Niche Keywords (comma separated)</label>
                            <input
                                className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none"
                                placeholder="e.g. space, universe, black holes"
                                value={form.niche_keywords}
                                onChange={e => setForm({ ...form, niche_keywords: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Branding */}
                    <div>
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-border/50 pb-2">
                            <Icon name="image" size={14} className="text-brand-red" /> Branding
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1">Brand Color</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        className="h-9 w-9 rounded border border-border bg-transparent shrink-0 cursor-pointer"
                                        value={form.brand_color}
                                        onChange={e => setForm({ ...form, brand_color: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none font-mono"
                                        value={form.brand_color}
                                        onChange={e => setForm({ ...form, brand_color: e.target.value })}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1">Watermark Position</label>
                                <select 
                                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none"
                                    value={form.watermark_position} 
                                    onChange={e => setForm({ ...form, watermark_position: e.target.value })}
                                >
                                    <option value="bottom_right">Bottom Right</option>
                                    <option value="top_right">Top Right</option>
                                    <option value="bottom_left">Bottom Left</option>
                                    <option value="top_left">Top Left</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1">Watermark Scale</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max="1.0"
                                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none"
                                    value={form.watermark_scale}
                                    onChange={e => setForm({ ...form, watermark_scale: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Automation */}
                    <div>
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-border/50 pb-2">
                            <Icon name="cpu" size={14} className="text-brand-red" /> Automation Defaults
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1">Default Voice ID</label>
                                <input
                                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none"
                                    placeholder="e.g. en-US-ChristopherNeural"
                                    value={form.default_voice_id}
                                    onChange={e => setForm({ ...form, default_voice_id: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1">Hashtags (comma separated)</label>
                                <input
                                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none"
                                    placeholder="e.g. shorts, viral, trending"
                                    value={form.hashtag_set}
                                    onChange={e => setForm({ ...form, hashtag_set: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-surface-input border border-border rounded-lg">
                            <div>
                                <p className="text-sm font-bold text-text-primary">Auto-Approve Videos</p>
                                <p className="text-xs text-text-muted">Automatically push rendering jobs to YouTube when ready.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={form.auto_approve}
                                onChange={e => setForm({ ...form, auto_approve: e.target.checked })}
                              />
                              <div className="w-11 h-6 bg-border rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-red"></div>
                            </label>
                        </div>
                    </div>

                  </form>
              </div>

              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-elevated/50 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    icon={saving ? 'loader' : 'save'} 
                    type="submit" 
                    form="channel-form"
                    disabled={saving || !form.name.trim()}
                    loading={saving}
                  >
                    {saving ? 'Saving...' : 'Save Channel'}
                  </Button>
              </div>

            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmOpen && channelToDelete && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setDeleteConfirmOpen(false)}
          >
            <div 
              className="bg-surface border border-border rounded-xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center mx-auto mb-4 border border-brand-red/20">
                <Icon name="alert-triangle" size={24} />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Delete Channel?</h3>
              <p className="text-sm text-text-muted mb-6">
                Are you sure you want to delete <strong className="text-text-primary">{channelToDelete.name}</strong>? This action will permanently remove all associated ideas, scripts, and video records. This cannot be undone.
              </p>
              
              <div className="flex gap-3 justify-center">
                <Button variant="ghost" className="flex-1 justify-center" onClick={() => setDeleteConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  className="flex-1 justify-center" 
                  onClick={handleDelete}
                  disabled={deleting}
                  loading={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </GridContainer>
  );
}
