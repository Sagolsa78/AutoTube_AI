import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import Icon from '../components/Icon';
import GridContainer from '../components/layout/GridContainer';
import PageHeader from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import Metric from '../components/Metric';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import { toast } from 'sonner';
import { useChannel } from '../contexts/ChannelContext';

export default function Dashboard() {
  const { activeChannelId } = useChannel();
  const [stats, setStats] = useState({
    ideas: 0, pendingIdeas: 0,
    scripts: 0, approvedScripts: 0,
    rendering: 0, ready: 0, uploaded: 0,
  });
  const [recentVideos, setRecentVideos] = useState([]);
  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [computeTelemetry, setComputeTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!activeChannelId) {
      if (isMounted) setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const [ideas, scripts, videos, prof, dashAnalytics, compute] = await Promise.all([
          api.getIdeas(activeChannelId),
          api.getScripts(activeChannelId),
          api.getVideos(activeChannelId),
          api.getProfile(),
          api.getDashboardAnalytics(activeChannelId),
          api.getComputeTelemetry().catch(() => null),
        ]);
        if (!isMounted) return;

        const pendingIdeas = (ideas || []).filter(i => i.status === 'pending').length;
        const approvedScripts = (scripts || []).filter(s => s.status === 'approved' || s.status === 'draft').length;
        const rendering = (videos || []).filter(v => v.status === 'rendering').length;
        const ready = (videos || []).filter(v => ['ready', 'approved'].includes(v.status)).length;
        const uploaded = (videos || []).filter(v => v.status === 'uploaded').length;

        setStats({
          ideas: (ideas || []).length, pendingIdeas,
          scripts: (scripts || []).length, approvedScripts,
          rendering, ready, uploaded,
        });
        setRecentVideos((videos || []).slice(0, 4));
        setProfile(prof);
        setAnalytics(dashAnalytics);
        setComputeTelemetry(compute);
      } catch (e) {
        console.error('Failed to load dashboard data', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [activeChannelId]);

  const totalReview = stats.pendingIdeas + stats.approvedScripts + stats.ready;
  const readyVideos = recentVideos.filter(v => ['ready', 'approved'].includes(v.status));
  const renderingVideos = recentVideos.filter(v => v.status === 'rendering');

  if (loading) {
    return (
      <GridContainer>
        <div className="space-y-6 animate-pulse">
          <div className="h-16 bg-surface border border-border rounded-xl w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <Skeleton height="180px" rounded="rounded-xl" />
              <Skeleton height="240px" rounded="rounded-xl" />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <Skeleton height="140px" rounded="rounded-xl" />
              <Skeleton height="140px" rounded="rounded-xl" />
              <Skeleton height="140px" rounded="rounded-xl" />
            </div>
          </div>
        </div>
      </GridContainer>
    );
  }

  const creatorName = profile?.display_name || profile?.channel_name || 'Creator';

  return (
    <GridContainer>
      <div className="space-y-6">
        {/* Page Header: Secondary CTA 'Review Best' per Section 3.4 & 10 */}
        <PageHeader
          title="Command Center"
          description={`Welcome back, ${creatorName}. Here's your production pipeline status and telemetry.`}
          badge={
            totalReview > 0 ? (
              <span className="badge badge-pending">
                {totalReview} action{totalReview > 1 ? 's' : ''} required
              </span>
            ) : (
              <span className="badge badge-ready">
                All caught up
              </span>
            )
          }
          actions={
            <Link to="/app/best">
              <Button variant="secondary" icon="star" size="sm">
                Review Best
              </Button>
            </Link>
          }
        />

        {/* Responsive Two-Column Fluid Grid (65% / 35%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* PRIMARY COLUMN: Action Queue & Active Jobs (~65%) */}
          <div className="lg:col-span-8 space-y-6 w-full">
            
            {/* Action Required Section */}
            {totalReview > 0 ? (
              <Card variant="surface" className="border-border">
                <CardHeader
                  title={
                    <CardTitle icon={<Icon name="alert-triangle" className="text-warning" size={18} />}>
                      Action Required
                    </CardTitle>
                  }
                  action={
                    <span className="text-xs font-mono font-semibold text-text-secondary bg-elevated px-2 py-0.5 rounded border border-border">
                      {totalReview} Queue Item{totalReview > 1 ? 's' : ''}
                    </span>
                  }
                />

                <CardContent className="space-y-3">
                  {/* Ready for Publish / Review */}
                  {readyVideos.length > 0 && (
                    <div className="bg-elevated/70 border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-border-strong transition-colors">
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div className="w-10 h-14 bg-canvas rounded-lg border border-border flex items-center justify-center shrink-0 text-brand-red">
                          <Icon name="video" size={20} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <StatusBadge status="ready" size="sm" />
                            <span className="text-xs text-text-muted font-mono truncate">
                              ID: {readyVideos[0].id?.substring(0, 8)}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-text-primary truncate">
                            {readyVideos[0].selected_title || readyVideos[0].title || 'Rendered Short Ready'}
                          </h4>
                          <p className="text-xs text-text-secondary">
                            Final video rendered and awaiting publication approval.
                          </p>
                        </div>
                      </div>
                      <Link to="/app/videos" className="shrink-0">
                        <Button variant="primary" size="sm" icon="play">
                          Review Video
                        </Button>
                      </Link>
                    </div>
                  )}

                  {/* Pending Ideas */}
                  {stats.pendingIdeas > 0 && (
                    <div className="bg-elevated/70 border border-border rounded-xl p-4 flex items-center justify-between gap-4 hover:border-border-strong transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-canvas rounded-lg border border-border flex items-center justify-center shrink-0 text-warning">
                          <Icon name="lightbulb" size={18} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-text-primary">
                            {stats.pendingIdeas} Idea{stats.pendingIdeas > 1 ? 's' : ''} Pending Curation
                          </h4>
                          <p className="text-xs text-text-secondary truncate">
                            Review generated concepts and promote promising angles to script.
                          </p>
                        </div>
                      </div>
                      <Link to="/app/ideas" className="shrink-0">
                        <Button variant="secondary" size="sm" icon="arrow-right" iconPosition="right">
                          View Ideas
                        </Button>
                      </Link>
                    </div>
                  )}

                  {/* Scripts Ready for Storyboard / Studio */}
                  {stats.approvedScripts > 0 && (
                    <div className="bg-elevated/70 border border-border rounded-xl p-4 flex items-center justify-between gap-4 hover:border-border-strong transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-canvas rounded-lg border border-border flex items-center justify-center shrink-0 text-info">
                          <Icon name="fileText" size={18} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-text-primary">
                            {stats.approvedScripts} Script{stats.approvedScripts > 1 ? 's' : ''} Ready to Storyboard
                          </h4>
                          <p className="text-xs text-text-secondary truncate">
                            Scripts with scene directions waiting for visual curation and rendering.
                          </p>
                        </div>
                      </div>
                      <Link to="/app/scripts" className="shrink-0">
                        <Button variant="secondary" size="sm" icon="arrow-right" iconPosition="right">
                          Open Scripts
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* Content-sized Empty State (Section 3.3) */
              <EmptyState
                icon="check"
                title="Pipeline Queue Clear"
                description="All pending videos, scripts, and concepts have been processed. Start a new idea to populate the review queue."
                action={
                  <Link to="/app/ideas">
                    <Button variant="secondary" size="sm" icon="lightbulb">
                      Explore Ideas
                    </Button>
                  </Link>
                }
                secondary={
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-text-muted">Active Pipeline:</span>
                    <span className="text-success font-semibold">0 Waiting / Optimal</span>
                  </div>
                }
              />
            )}

            {/* Active Rendering Jobs */}
            {renderingVideos.length > 0 && (
              <Card variant="surface" className="border-warning/30">
                <CardHeader
                  title={
                    <CardTitle icon={<Icon name="loader" className="animate-spin text-warning" size={18} />}>
                      Rendering in Progress
                    </CardTitle>
                  }
                  action={
                    <span className="badge badge-rendering">
                      {renderingVideos.length} Rendering
                    </span>
                  }
                />
                <CardContent className="space-y-3">
                  {renderingVideos.map(v => (
                    <div key={v.id} className="bg-elevated p-4 rounded-xl border border-border space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-text-primary truncate pr-4">
                          {v.title || `Rendering Job #${v.id.substring(0, 8)}`}
                        </span>
                        <span className="font-mono text-warning font-semibold">
                          {Math.round(v.render_progress || 0)}%
                        </span>
                      </div>
                      <div className="w-full bg-canvas rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-warning h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(5, Math.min(100, v.render_progress || 25))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Quick Production Pipeline Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Concepts</span>
                <span className="text-xl font-bold font-mono text-text-primary mt-1">{stats.ideas}</span>
                <span className="text-[10px] text-text-secondary mt-0.5">{stats.pendingIdeas} pending</span>
              </div>
              <div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Scripts</span>
                <span className="text-xl font-bold font-mono text-text-primary mt-1">{stats.scripts}</span>
                <span className="text-[10px] text-text-secondary mt-0.5">{stats.approvedScripts} ready</span>
              </div>
              <div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Videos</span>
                <span className="text-xl font-bold font-mono text-text-primary mt-1">{stats.ready}</span>
                <span className="text-[10px] text-text-secondary mt-0.5">{stats.rendering} rendering</span>
              </div>
              <div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Published</span>
                <span className="text-xl font-bold font-mono text-success mt-1">{stats.uploaded}</span>
                <span className="text-[10px] text-text-secondary mt-0.5">Live on YouTube</span>
              </div>
            </div>

          </div>

          {/* SECONDARY COLUMN: Telemetry Widgets (~35%) - Stretch 100% per §3.5 */}
          <div className="lg:col-span-4 space-y-6 w-full">
            
            {/* Compute Plane / Worker Router Widget (§5) */}
            <Card variant="surface" className="w-full">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="cpu" size={16} className="text-brand-red" />}>
                    Compute Plane
                  </CardTitle>
                }
                action={
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-red bg-brand-red/10 border border-brand-red/20 px-2 py-0.5 rounded">
                    {computeTelemetry?.strategy || 'Local-First ($0)'}
                  </span>
                }
              />
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-elevated border border-border/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${computeTelemetry?.local_worker?.status === 'online' ? 'bg-success shadow-[0_0_6px_#32C48D]' : 'bg-text-muted'}`} />
                    <span className="font-medium text-text-primary">
                      {computeTelemetry?.local_worker?.name || 'Local RTX 3050'}
                    </span>
                  </div>
                  <span className={`text-[11px] font-mono font-semibold uppercase ${computeTelemetry?.local_worker?.status === 'online' ? 'text-success' : 'text-text-muted'}`}>
                    {computeTelemetry?.local_worker?.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>

                {/* Cloud Burst Spend Tracker */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">Today's Cloud Burst Spend</span>
                    <span className="font-mono font-bold text-text-primary">
                      ${computeTelemetry?.cloud_burst?.today_spent_usd !== undefined ? computeTelemetry.cloud_burst.today_spent_usd.toFixed(2) : '0.00'}
                      <span className="text-text-muted font-normal"> / ${computeTelemetry?.cloud_burst?.daily_budget_usd !== undefined ? computeTelemetry.cloud_burst.daily_budget_usd.toFixed(2) : '2.00'} cap</span>
                    </span>
                  </div>
                  <div className="w-full bg-elevated rounded-full h-1.5 overflow-hidden border border-border/60">
                    <div 
                      className="bg-brand-red h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, (((computeTelemetry?.cloud_burst?.today_spent_usd || 0) / (computeTelemetry?.cloud_burst?.daily_budget_usd || 2.0)) * 100))}%` 
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-text-muted pt-0.5">
                    <span>Burst Target: {computeTelemetry?.cloud_burst?.provider || 'RunPod Serverless'}</span>
                    <span>${computeTelemetry?.cloud_burst?.budget_remaining_usd !== undefined ? computeTelemetry.cloud_burst.budget_remaining_usd.toFixed(2) : '2.00'} left</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Widget */}
            <Card variant="surface" className="w-full">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="barChart" size={16} className="text-brand-red" />}>
                    Performance
                  </CardTitle>
                }
                action={
                  <Link to="/app/analytics" className="text-xs text-brand-red hover:text-brand-red-hover font-semibold transition-colors">
                    View All →
                  </Link>
                }
              />
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="text-text-secondary">Subscribers</span>
                    <span className="font-mono font-bold text-text-primary">
                      {analytics?.subscribers || analytics?.performance?.total_subs || 0}
                    </span>
                  </div>
                  <div className="w-full bg-elevated rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-success h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, (((analytics?.subscribers || analytics?.performance?.total_subs || 0) / 1000) * 100))}%` 
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="text-text-secondary">Shorts Views (90D)</span>
                    <span className="font-mono font-bold text-text-primary">
                      {analytics?.shorts_views_90d || analytics?.performance?.total_views || 0}
                    </span>
                  </div>
                  <div className="w-full bg-elevated rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-info h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, (((analytics?.shorts_views_90d || analytics?.performance?.total_views || 0) / 10000000) * 100))}%` 
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Storage Telemetry Widget */}
            <Card variant="surface" className="w-full">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="hardDrive" size={16} className="text-warning" />}>
                    Engine Storage
                  </CardTitle>
                }
                action={
                  <span className="text-xs font-mono text-text-muted">
                    {analytics?.storage?.limit_mb ? `${Math.round(analytics.storage.limit_mb / 1000)}GB Limit` : '50GB'}
                  </span>
                }
              />
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono text-text-primary tracking-tight">
                      {analytics?.storage?.total_mb || 0}
                    </span>
                    <span className="text-xs text-text-muted font-sans font-medium">MB used</span>
                  </div>
                  <span className="text-xs font-mono text-text-secondary">
                    {Math.round(((analytics?.storage?.total_mb || 0) / (analytics?.storage?.limit_mb || 50000)) * 100)}%
                  </span>
                </div>

                <div className="w-full bg-elevated rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-brand-red h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min(100, (((analytics?.storage?.total_mb || 0) / (analytics?.storage?.limit_mb || 50000)) * 100))}%` 
                    }}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] text-text-muted pt-2 border-t border-border/60">
                  <span>Output: <strong className="font-mono text-text-secondary">{analytics?.storage?.output_mb || 0} MB</strong></span>
                  <span>Temp: <strong className="font-mono text-text-secondary">{analytics?.storage?.temp_mb || 0} MB</strong></span>
                </div>
              </CardContent>
            </Card>

            {/* AI Providers Status Widget */}
            <Card variant="surface" className="w-full">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="activity" size={16} className="text-success" />}>
                    AI Providers
                  </CardTitle>
                }
                action={
                  <Link to="/app/health" className="text-xs text-text-muted hover:text-text-primary transition-colors">
                    Health →
                  </Link>
                }
              />
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-elevated border border-border/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_6px_#32C48D]" />
                    <span className="font-medium text-text-primary">Ollama (LLM)</span>
                  </div>
                  <span className="text-[11px] font-mono text-text-muted uppercase">Local Cluster</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-elevated border border-border/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_6px_#32C48D]" />
                    <span className="font-medium text-text-primary">Edge-TTS (Voice)</span>
                  </div>
                  <span className="text-[11px] font-mono text-text-muted uppercase">High Speed</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-elevated border border-border/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_6px_#32C48D]" />
                    <span className="font-medium text-text-primary">Stock Media</span>
                  </div>
                  <span className="text-[11px] font-mono text-text-muted uppercase">Pexels/Pixabay</span>
                </div>
              </CardContent>
            </Card>

          </div>

        </div>
      </div>
    </GridContainer>
  );
}
