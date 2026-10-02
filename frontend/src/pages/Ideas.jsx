import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Icon from '../components/Icon';
import GridContainer from '../components/layout/GridContainer';
import PageHeader from '../components/layout/PageHeader';
import FilterBar from '../components/FilterBar';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/Card';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import { toast } from 'sonner';
import { useChannel } from '../contexts/ChannelContext';

export default function Ideas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { activeChannelId, activeChannel } = useChannel();
  const [activeTab, setActiveTab] = useState('pending');
  const navigate = useNavigate();
  const loadIdeas = async () => {
    try {
      setLoading(true);
      const data = await api.getIdeas(activeChannelId);
      setIdeas((data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    if (activeChannelId) {
      loadIdeas(); 
    } else {
      setIdeas([]);
      setLoading(false);
    }
  }, [activeChannelId]);

  const generate = async () => {
    if (!activeChannelId) {
      toast.error('Please select a channel first');
      return;
    }
    setGenerating(true);
    try {
      const prof = await api.getProfile();
      await api.generateIdeas(activeChannelId, 5, prof?.default_niche || 'science_wow');
      await loadIdeas();
      toast.success('Generated 5 new video concepts!');
      setActiveTab('pending');
    } catch (e) { 
      console.error(e); 
      toast.error(`Generation failed: ${e.message}`); 
    } finally { 
      setGenerating(false); 
    }
  };

  const actionDiscard = async (id) => {
    try {
      await api.discardIdea(id);
      await loadIdeas();
      toast.success('Concept discarded');
    } catch (e) { 
      console.error(e); 
      toast.error(`Discard failed: ${e.message}`); 
    }
  };

  const developInStudio = (ideaId) => {
    navigate(`/app/create?idea=${ideaId}`);
  };

  const filteredIdeas = ideas.filter(i => i.status === activeTab);
  const pendingCount = ideas.filter(i => i.status === 'pending').length;
  const promotedCount = ideas.filter(i => i.status === 'promoted').length;
  const discardedCount = ideas.filter(i => i.status === 'discarded').length;

  const tabs = [
    { id: 'pending', label: 'Inbox (Pending)', count: pendingCount, icon: 'layers' },
    { id: 'promoted', label: 'In Studio', count: promotedCount, icon: 'film' },
    { id: 'discarded', label: 'Discarded', count: discardedCount, icon: 'trash' }
  ];

  if (loading) {
    return (
      <GridContainer>
        <div className="space-y-6">
          <Skeleton height="60px" rounded="rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton height="180px" rounded="rounded-xl" />
            <Skeleton height="180px" rounded="rounded-xl" />
            <Skeleton height="180px" rounded="rounded-xl" />
          </div>
        </div>
      </GridContainer>
    );
  }

  return (
    <GridContainer>
      <div className="space-y-6">
        <PageHeader
          title="Concept Generator"
          description="Brainstorm, curate, and promote viral hook concepts to the scriptwriting studio."
          actions={
            <Button
              variant="primary"
              size="sm"
              icon={generating ? 'loader' : 'sparkles'}
              onClick={generate}
              disabled={generating}
              loading={generating}
              className="shadow-brand-glow"
            >
              {generating ? 'Brainstorming...' : 'Generate 5 Ideas'}
            </Button>
          }
        />

        {/* Tab Strip */}
        <FilterBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Concept Cards Grid */}
        {filteredIdeas.length === 0 ? (
          <EmptyState
            icon="lightbulb"
            title={`No ${activeTab} concepts`}
            description={
              activeTab === 'pending'
                ? 'Click "Generate 5 Ideas" to generate fresh YouTube Shorts concepts tailored to your niche.'
                : activeTab === 'promoted'
                ? 'Ideas that have been moved to scriptwriting appear here.'
                : 'You have not discarded any ideas.'
            }
            action={
              activeTab === 'pending' && (
                <Button 
                  variant="primary" 
                  size="sm" 
                  icon="sparkles" 
                  onClick={generate} 
                  disabled={generating}
                >
                  Generate Concepts
                </Button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredIdeas.map(i => {
              const isDiscarded = i.status === 'discarded';
              return (
                <Card 
                  key={i.id} 
                  variant="surface" 
                  className={`flex flex-col justify-between ${isDiscarded ? 'opacity-60' : ''}`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 bg-surface-hover text-text-secondary text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border border-border">
                            {i.topic}
                          </span>
                          {i.score >= 90 && (
                            <span className="inline-flex items-center gap-1 bg-brand-red/10 text-brand-red text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border border-brand-red/20">
                              🔥 Trending
                            </span>
                          )}
                          {i.score >= 80 && i.score < 90 && (
                            <span className="inline-flex items-center gap-1 bg-brand-blue/10 text-brand-blue text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border border-brand-blue/20">
                              📈 High Potential
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-base text-text-primary leading-tight group-hover:text-brand-red transition-colors">
                          {i.title}
                        </h3>
                      </div>
                      {/* Score Bubble */}
                      {i.score > 0 && (
                        <div className="flex flex-col items-center justify-center shrink-0 w-10 h-10 rounded-full bg-elevated border border-border shadow-inner">
                          <span className="text-xs font-bold font-mono text-text-primary">{Math.round(i.score)}</span>
                        </div>
                      )}
                    </div>

                    {i.angle && (
                      <div className="bg-elevated/70 border border-border p-2.5 rounded-lg">
                        <span className="text-[10px] uppercase tracking-widest text-text-muted font-mono font-bold block mb-0.5">
                          Hook Angle
                        </span>
                        <p className="text-xs text-text-primary italic line-clamp-2">
                          "{i.angle}"
                        </p>
                      </div>
                    )}
                  </div>

                  <CardFooter className="pt-3">
                    {i.status === 'pending' && (
                      <div className="flex items-center gap-2 w-full">
                        <Button 
                          variant="primary" 
                          size="sm" 
                          icon="sparkles" 
                          className="flex-1 shadow-brand-glow"
                          onClick={() => developInStudio(i.id)}
                        >
                          Develop in Studio
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          icon="trash" 
                          className="hover:text-danger"
                          onClick={() => actionDiscard(i.id)}
                          title="Discard concept"
                        />
                      </div>
                    )}

                    {i.status === 'promoted' && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        icon="film" 
                        className="w-full"
                        onClick={() => developInStudio(i.id)}
                      >
                        Open in Studio →
                      </Button>
                    )}

                    {i.status === 'discarded' && (
                      <span className="text-xs font-mono text-text-muted">
                        Discarded
                      </span>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </GridContainer>
  );
}
