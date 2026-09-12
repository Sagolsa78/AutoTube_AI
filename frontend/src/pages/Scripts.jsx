import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Icon from '../components/Icon';
import GridContainer from '../components/layout/GridContainer';
import PageHeader from '../components/layout/PageHeader';
import FilterBar from '../components/FilterBar';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import Button from '../components/Button';
import ScoreBadge from '../components/ScoreBadge';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import { toast } from 'sonner';
import { useChannel } from '../contexts/ChannelContext';

export default function Scripts() {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('draft');
  const [regenerating, setRegenerating] = useState(null);
  const navigate = useNavigate();
  const { activeChannelId } = useChannel();

  const loadData = async () => {
    try {
      setLoading(true);
      const allScripts = await api.getScripts(activeChannelId);
      setScripts((allScripts || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
      if (activeChannelId) {
          loadData(); 
      } else {
          setScripts([]);
          setLoading(false);
      }
  }, [activeChannelId]);

  const discardScript = async (e, id) => {
    e.stopPropagation();
    try {
      await api.discardScript(id);
      await loadData();
      toast.success('Script discarded');
    } catch (e) { 
      toast.error(`Discard failed: ${e.message}`); 
    }
  };

  const regenerateScript = async (e, id) => {
    e.stopPropagation();
    setRegenerating(id);
    try {
      await api.regenerateScript(id);
      await loadData();
      toast.success('Script regenerated successfully!');
    } catch (e) { 
      toast.error(`Regeneration failed: ${e.message}`); 
    } finally { 
      setRegenerating(null); 
    }
  };

  const openInStudio = (scriptId) => {
    navigate(`/app/create?script=${scriptId}`);
  };

  const filteredScripts = scripts.filter(s => s.status === activeTab);
  const draftCount = scripts.filter(s => s.status === 'draft').length;
  const usedCount = scripts.filter(s => s.status === 'used_in_render').length;
  const discardedCount = scripts.filter(s => s.status === 'discarded').length;

  const tabs = [
    { id: 'draft', label: 'Drafts', count: draftCount, icon: 'fileText' },
    { id: 'used_in_render', label: 'Used in Render', count: usedCount, icon: 'film' },
    { id: 'discarded', label: 'Discarded', count: discardedCount, icon: 'trash' }
  ];

  if (loading) {
    return (
      <GridContainer>
        <div className="space-y-6">
          <Skeleton height="60px" rounded="rounded-xl" />
          <div className="space-y-4">
            <Skeleton height="200px" rounded="rounded-xl" />
            <Skeleton height="200px" rounded="rounded-xl" />
          </div>
        </div>
      </GridContainer>
    );
  }

  return (
    <GridContainer>
      <div className="space-y-6">
        <PageHeader
          title="Script Library"
          description="Browse AI-generated video scripts. Open any draft in Studio to curate scenes and render."
          actions={
            <Button
              variant="primary"
              size="sm"
              icon="plus"
              onClick={() => navigate('/app/create')}
              className="shadow-brand-glow"
            >
              Draft New Script
            </Button>
          }
        />

        {/* Tab Strip */}
        <FilterBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Script Cards List */}
        {filteredScripts.length === 0 ? (
          <EmptyState
            icon="fileText"
            title={`No ${activeTab} scripts`}
            description={
              activeTab === 'draft'
                ? 'Generate a script from an Idea in the Studio to see it here.'
                : activeTab === 'used_in_render'
                ? 'Scripts that have already been rendered into videos appear here.'
                : 'You have not discarded any scripts.'
            }
            action={
              activeTab === 'draft' && (
                <Button 
                  variant="primary" 
                  size="sm" 
                  icon="sparkles" 
                  onClick={() => navigate('/app/ideas')}
                >
                  Browse Concepts
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-4">
            {filteredScripts.map(s => {
              const isDiscarded = s.status === 'discarded';
              return (
                <Card 
                  key={s.id} 
                  variant="surface" 
                  className={`overflow-hidden p-0 flex flex-col md:flex-row transition-all ${
                    isDiscarded ? 'opacity-60' : 'hover:border-border-strong'
                  }`}
                >
                  {/* Left Column: Script Metadata & Controls */}
                  <div className="p-5 md:w-[260px] lg:w-[280px] shrink-0 border-b md:border-b-0 md:border-r border-border bg-elevated/40 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-canvas border border-border flex items-center justify-center text-brand-red shrink-0">
                          <Icon name="fileText" size={14} />
                        </span>
                        <span className="font-mono font-bold text-xs text-text-primary">
                          #{s.id.substring(0, 8)}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {s.scenes?.length > 0 && (
                          <span className="bg-canvas border border-border px-2 py-0.5 rounded text-[10px] font-mono font-semibold text-text-secondary">
                            {s.scenes.length} Scenes
                          </span>
                        )}
                        {s.quality_score && (
                          <ScoreBadge score={s.quality_score} label="QA" />
                        )}
                        {s.duration_est && (
                          <span className="bg-canvas border border-border px-2 py-0.5 rounded text-[10px] font-mono text-text-muted">
                            ~{Math.round(s.duration_est)}s
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-text-muted">
                        Created {new Date(s.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {s.status === 'draft' || s.status === 'used_in_render' ? (
                      <div className="space-y-2 pt-3 border-t border-border/80">
                        {s.latest_video_status === 'failed' && s.latest_video_error && (
                          <div className="text-[10px] text-brand-red bg-brand-red/10 border border-brand-red/20 rounded p-2 mb-2 line-clamp-3" title={s.latest_video_error}>
                            <span className="font-bold">Render Failed:</span> {s.latest_video_error}
                          </div>
                        )}
                        <Button
                          variant="primary"
                          size="sm"
                          icon={s.status === 'used_in_render' ? 'copy' : 'film'}
                          className="w-full shadow-brand-glow"
                          onClick={() => openInStudio(s.id)}
                        >
                          {s.status === 'used_in_render' ? 'Reuse in Studio' : 'Open in Studio'}
                        </Button>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={regenerating === s.id ? 'loader' : 'refresh-cw'}
                            className="flex-1 text-xs"
                            onClick={e => regenerateScript(e, s.id)}
                            disabled={regenerating === s.id}
                            loading={regenerating === s.id}
                          >
                            Regenerate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon="trash"
                            className="hover:text-danger hover:bg-danger/10"
                            onClick={e => discardScript(e, s.id)}
                            title="Discard script"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Right Column: Scenes Flow & Narration Preview */}
                  <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between max-h-[320px] overflow-y-auto">
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted block">
                        Script Excerpt & Scenes
                      </span>
                      
                      {s.scenes?.length > 0 ? (
                        <div className="space-y-2.5">
                          {s.scenes.slice(0, 4).map(sc => (
                            <div key={sc.id} className="flex gap-3 items-start text-xs">
                              <span className="font-mono font-bold text-brand-red uppercase text-[10px] shrink-0 mt-0.5">
                                S{sc.scene_number}
                              </span>
                              <p className="text-text-secondary leading-relaxed line-clamp-2">
                                {sc.narration}
                              </p>
                            </div>
                          ))}
                          {s.scenes.length > 4 && (
                            <span className="text-[11px] font-mono text-text-muted block pt-1">
                              + {s.scenes.length - 4} additional scene{s.scenes.length - 4 > 1 ? 's' : ''} in studio
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-sans">
                          {s.full_text || 'No narration content.'}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </GridContainer>
  );
}
