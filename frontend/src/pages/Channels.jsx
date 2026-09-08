import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';
import GridContainer from '../components/layout/GridContainer';
import PageHeader from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import { toast } from 'sonner';

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
      setChannels(data || []);
    } catch (e) { 
      console.error(e); 
    } finally {
      setLoading(false);
    }
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
      toast.success('Channel audience created successfully!');
    } catch (e) { 
      console.error(e); 
      toast.error('Failed to create channel: ' + e.message);
    } finally {
      setCreating(false);
    }
  }

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
              onClick={() => setShowCreate(true)}
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
                onClick={() => setShowCreate(true)}
              >
                Create Channel
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {channels.map(ch => (
              <Card key={ch.id} variant="surface" className="flex flex-col justify-between hover:border-border-strong transition-all">
                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-elevated border border-border flex items-center justify-center text-brand-red shrink-0 shadow-inner">
                        <Icon name="hash" size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-text-primary truncate">
                          {ch.name}
                        </h3>
                        <span className="text-xs text-text-secondary">
                          {ch.niche || 'General YouTube Shorts'}
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 bg-success/10 border border-success/30 text-success text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded shrink-0">
                      Active
                    </span>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-border/70 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">Target Language</span>
                      <span className="font-mono font-bold uppercase text-text-primary bg-elevated px-2 py-0.5 rounded text-[11px] border border-border">
                        {ch.language || 'en'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">Created</span>
                      <span className="font-mono text-text-secondary">
                        {ch.created_at ? new Date(ch.created_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create Channel Modal */}
        {showCreate && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setShowCreate(false)}
          >
            <div 
              className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" 
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-elevated/50">
                <h3 className="font-bold text-sm sm:text-base text-text-primary flex items-center gap-2">
                  <Icon name="plus" size={16} className="text-brand-red" />
                  Create Target Channel
                </h3>
                <button 
                  type="button" 
                  className="p-1.5 hover:bg-surface-hover rounded-lg text-text-secondary hover:text-text-primary transition-colors" 
                  onClick={() => setShowCreate(false)}
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
              
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Channel Name</label>
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
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Target Niche / Topic</label>
                  <input
                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none"
                    placeholder="e.g. Science Facts, Astrophysics, Ancient History"
                    value={form.niche}
                    onChange={e => setForm({ ...form, niche: e.target.value })}
                    required
                  />
                  <p className="text-[11px] text-text-muted mt-1">Directly seeds the AI LLM prompt generator.</p>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Primary Language</label>
                  <select 
                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                    value={form.language} 
                    onChange={e => setForm({ ...form, language: e.target.value })}
                  >
                    <option value="en">English (en)</option>
                    <option value="hi">Hindi (hi)</option>
                    <option value="es">Spanish (es)</option>
                    <option value="fr">French (fr)</option>
                  </select>
                </div>
                
                <div className="pt-3 border-t border-border flex justify-end gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    icon={creating ? 'loader' : 'plus'} 
                    type="submit" 
                    disabled={creating || !form.name.trim()}
                    loading={creating}
                  >
                    {creating ? 'Creating...' : 'Create Channel'}
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
