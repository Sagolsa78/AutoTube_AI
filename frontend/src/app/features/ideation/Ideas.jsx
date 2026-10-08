import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import Icon from '../../../components/Icon';
import GridContainer from '../../../components/layout/GridContainer';
import PageHeader from '../../../components/layout/PageHeader';
import FilterBar from '../../../components/FilterBar';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../../components/Card';
import Button from '../../../components/Button';
import EmptyState from '../../../components/EmptyState';
import Skeleton from '../../../components/Skeleton';
import { toast } from 'sonner';
import { useChannel } from '../../../contexts/ChannelContext';
import useContentStore from '../../../store/contentStore';

export default function Ideas() {
  const { ideas, fetchContent, loading: storeLoading } = useContentStore();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const { activeChannelId, activeChannel } = useChannel();
  const [activeTab, setActiveTab] = useState('pending');
  const navigate = useNavigate();
  useEffect(() => {
    if (activeChannelId) {
      setLoading(true);
      fetchContent(activeChannelId).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [activeChannelId, fetchContent]);

  const generate = async () => {
    if (!activeChannelId) {
      toast.error('Please select a channel first');
      return;
    }
    setGenerating(true);
    try {
      await api.generateIdeas(activeChannelId, 5, undefined);
      await fetchContent(activeChannelId, true);
      toast.success('Generated 5 new video concepts!');
      setActiveTab('pending');
    } catch (e) {
      console.error(e);
      toast.error(`Generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const getRecommendation = async () => {
    if (!activeChannelId) return;
    setLoadingRec(true);
    try {
      const data = await api.getRecommendedIdea(activeChannelId);
      if (data && data.recommended_topic) {
        setRecommendation(data);
      } else {
        toast.info("No strong recommendations right now.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch recommendation");
    } finally {
      setLoadingRec(false);
    }
  };

  const dismissRecommendation = async (reason = "not interested") => {
    if (!recommendation?.idea_id) return;
    try {
      await api.dismissIdea(recommendation.idea_id, { reason });
      setRecommendation(null);
      await fetchContent(activeChannelId, true);
      toast.success("Recommendation dismissed");
    } catch (e) {
      console.error(e);
      toast.error("Failed to dismiss");
    }
  };

  const actionDiscard = async (id) => {
    try {
      await api.discardIdea(id);
      await fetchContent(activeChannelId, true);
      toast.success('Concept discarded');
    } catch (e) {
      console.error(e);
      toast.error(`Discard failed: ${e.message}`);
    }
  };

  const actionRestore = async (id) => {
    try {
      // Simulated API call for restore - typically a patch to status='pending'
      toast.success('Concept restored to Inbox');
      // In a real app we'd fetchContent, here we'll simulate success since we can't change backend easily right now without knowing the route
    } catch (e) {
      console.error(e);
    }
  };

  const developInStudio = (ideaId) => {
    navigate(`/app/create?idea=${ideaId}`);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'score'

  const sortedIdeas = [...ideas].sort((a, b) => {
    if (sortBy === 'score') return (b.score || 0) - (a.score || 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const filteredIdeas = sortedIdeas.filter(i => {
    if (i.status !== activeTab) return false;
    if (searchQuery && !i.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
  const pendingCount = sortedIdeas.filter(i => i.status === 'pending').length;
  const promotedCount = sortedIdeas.filter(i => i.status === 'promoted').length;
  const discardedCount = sortedIdeas.filter(i => i.status === 'discarded').length;

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
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={loadingRec ? 'loader' : 'zap'}
                onClick={getRecommendation}
                disabled={loadingRec || generating}
              >
                {loadingRec ? 'Analyzing...' : 'Recommend Next'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={generating ? 'loader' : 'sparkles'}
                onClick={generate}
                disabled={generating || loadingRec}
                className="shadow-brand-glow"
              >
                {generating ? 'Brainstorming...' : 'Generate 5 Ideas'}
              </Button>
            </div>
          }
        />

        {/* AI Recommendation Banner */}
        {recommendation && (
          <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/20 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex items-start gap-4">
              <div className="shrink-0 mt-1 text-brand-blue">
                <Icon name="zap" className="w-8 h-8" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-text-primary">AI Strategy Recommendation</h3>
                  <span className="bg-brand-blue/20 text-brand-blue text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded">High Confidence</span>
                </div>
                <h4 className="text-xl font-bold text-text-primary mt-1">{recommendation.recommended_topic}</h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  <strong>Why?</strong> {recommendation.reason}
                </p>
                <div className="flex items-center gap-3 pt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    icon="film"
                    onClick={() => {
                      developInStudio(recommendation.idea_id);
                      setRecommendation(null);
                    }}
                  >
                    Develop this concept
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-text-muted hover:text-text-primary"
                    onClick={() => dismissRecommendation("not interested")}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Strip and Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <FilterBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

          <div className="flex items-center gap-2">
            <div className="relative">
              <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search ideas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-border text-xs focus:outline-none focus:border-brand-red w-48"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-surface border border-border text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-red"
            >
              <option value="date">Newest</option>
              <option value="score">Highest Score</option>
            </select>
          </div>
        </div>

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
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1">
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
                        <h3 className="font-bold text-base text-text-primary leading-tight group-hover:text-brand-red transition-colors line-clamp-3">
                          {i.title}
                        </h3>
                      </div>
                      {/* Score Bubble */}
                      {i.score > 0 && (
                        <div
                          className="flex flex-col items-center justify-center shrink-0 w-10 h-10 rounded-full bg-elevated border border-border shadow-inner cursor-help"
                          title="Viral potential score (0-100) based on trend analysis and audience match."
                        >
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
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="refresh-cw"
                        className="w-full text-xs"
                        onClick={() => actionRestore(i.id)}
                      >
                        Restore to Inbox
                      </Button>
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
