import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Icon from '../components/Icon';
import GridContainer from '../components/layout/GridContainer';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import Skeleton from '../components/Skeleton';
import { useChannel } from '../contexts/ChannelContext';
import { useJobs } from '../hooks/useJobs';

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { activeChannel, activeChannelId } = useChannel();
  const { activeVideos, activeCount } = useJobs();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    ideas: 0,
    pendingIdeas: 0,
    scripts: 0,
    approvedScripts: 0,
    readyVideos: 0,
    uploadedVideos: 0,
    totalVideos: 0,
  });

  const [pendingIdeaList, setPendingIdeaList] = useState([]);
  const [approvedScriptList, setApprovedScriptList] = useState([]);
  const [readyVideoList, setReadyVideoList] = useState([]);
  const [topVideos, setTopVideos] = useState([]);
  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [computeTelemetry, setComputeTelemetry] = useState(null);
  const [ytStatus, setYtStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!activeChannelId) {
      if (isMounted) setLoading(false);
      return;
    }

    async function loadDashboardData() {
      try {
        setLoading(true);
        const [ideas, scripts, videos, prof, dashAnalytics, topVids, compute, yt] = await Promise.all([
          api.getIdeas(activeChannelId).catch(() => []),
          api.getScripts(activeChannelId).catch(() => []),
          api.getVideos(activeChannelId).catch(() => []),
          api.getProfile().catch(() => null),
          api.getDashboardAnalytics(activeChannelId).catch(() => null),
          api.getTopVideos(activeChannelId, 4).catch(() => []),
          api.getComputeTelemetry().catch(() => null),
          api.getYoutubeStatus().catch(() => ({ connected: false })),
        ]);

        if (!isMounted) return;

        const ideasArr = Array.isArray(ideas) ? ideas : [];
        const scriptsArr = Array.isArray(scripts) ? scripts : [];
        const videosArr = Array.isArray(videos) ? videos : [];

        const pendingIdeas = ideasArr.filter(i => i.status === 'pending');
        const approvedScripts = scriptsArr.filter(s => ['draft', 'approved'].includes(s.status));
        const readyVideos = videosArr.filter(v => ['ready', 'approved'].includes(v.status));
        const uploadedVideos = videosArr.filter(v => v.status === 'uploaded');

        setStats({
          ideas: ideasArr.length,
          pendingIdeas: pendingIdeas.length,
          scripts: scriptsArr.length,
          approvedScripts: approvedScripts.length,
          readyVideos: readyVideos.length,
          uploadedVideos: uploadedVideos.length,
          totalVideos: videosArr.length,
        });

        setPendingIdeaList(pendingIdeas.slice(0, 3));
        setApprovedScriptList(approvedScripts.slice(0, 3));
        setReadyVideoList(readyVideos.slice(0, 3));
        setTopVideos(Array.isArray(topVids) ? topVids : []);
        setProfile(prof);
        setAnalytics(dashAnalytics);
        setComputeTelemetry(compute);
        setYtStatus(yt);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();
    return () => { isMounted = false; };
  }, [activeChannelId]);

  const creatorName = profile?.display_name || activeChannel?.name || 'Creator';
  const totalActionRequired = stats.pendingIdeas + stats.approvedScripts + stats.readyVideos;
  const isNewChannel = stats.totalVideos === 0 && stats.ideas === 0 && stats.scripts === 0;

  if (loading) {
    return (
      <GridContainer>
        <div className="space-y-6 animate-pulse">
          <div className="h-20 bg-surface border border-border rounded-2xl w-full" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton height="100px" rounded="rounded-xl" />
            <Skeleton height="100px" rounded="rounded-xl" />
            <Skeleton height="100px" rounded="rounded-xl" />
            <Skeleton height="100px" rounded="rounded-xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <Skeleton height="200px" rounded="rounded-xl" />
              <Skeleton height="260px" rounded="rounded-xl" />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <Skeleton height="160px" rounded="rounded-xl" />
              <Skeleton height="200px" rounded="rounded-xl" />
            </div>
          </div>
        </div>
      </GridContainer>
    );
  }

  return (
    <GridContainer>
      <div className="space-y-6">

        {/* ── 1. Hero Creator Header ────────────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-2xl p-6 relative overflow-hidden shadow-card-subtle">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-brand-red bg-brand-red/10 border border-brand-red/20 px-2.5 py-0.5 rounded-full">
                  {activeChannel?.name || 'Active Workspace'}
                </span>
                {ytStatus?.connected ? (
                  <span className="text-xs font-mono font-semibold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                    YouTube Connected
                  </span>
                ) : (
                  <Link
                    to="/app/channels"
                    className="text-xs font-mono font-semibold text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full hover:bg-warning/20 transition-colors flex items-center gap-1"
                  >
                    <Icon name="alert-circle" size={12} />
                    Connect YouTube
                  </Link>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
                {getTimeGreeting()}, {creatorName}
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary max-w-xl">
                Here is what is happening across your content pipeline and production queues today.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link to="/app/ideas">
                <Button variant="secondary" size="md" icon="lightbulb">
                  Generate Ideas
                </Button>
              </Link>
              <Link to="/app/create">
                <Button variant="primary" size="md" icon="plus" className="shadow-brand-glow">
                  Create Video
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── 2. Real KPI Metrics Row ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between hover:border-border-strong transition-colors">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span className="font-semibold uppercase tracking-wider">Total Videos</span>
              <Icon name="video" size={16} className="text-brand-red" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-text-primary">{stats.totalVideos}</div>
              <div className="text-[11px] text-text-secondary mt-0.5">
                {stats.uploadedVideos} published on YouTube
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between hover:border-border-strong transition-colors">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span className="font-semibold uppercase tracking-wider">Shorts Views</span>
              <Icon name="barChart" size={16} className="text-info" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-text-primary">
                {(analytics?.performance?.total_views || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-text-secondary mt-0.5">
                {ytStatus?.connected ? 'Synced from YouTube' : 'Connect YouTube for live stats'}
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between hover:border-border-strong transition-colors">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span className="font-semibold uppercase tracking-wider">Subscribers</span>
              <Icon name="youtube" size={16} className="text-success" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-text-primary">
                {(analytics?.performance?.total_subs || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-text-secondary mt-0.5">
                Goal: 1,000 for Partner Program
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between hover:border-border-strong transition-colors">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span className="font-semibold uppercase tracking-wider">Production Queue</span>
              <Icon name="cpu" size={16} className="text-warning" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-warning">{activeCount}</div>
              <div className="text-[11px] text-text-secondary mt-0.5">
                {activeCount > 0 ? 'Rendering in progress' : 'Cluster idle ($0)'}
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Guided Onboarding (Rendered when channel is fresh) ─────────── */}
        {isNewChannel && (
          <Card variant="surface" className="border-brand-red/30 bg-gradient-to-r from-surface to-brand-red/5">
            <CardHeader
              title={
                <CardTitle icon={<Icon name="sparkles" className="text-brand-red" size={18} />}>
                  Welcome to AutoTube — Let's Setup Your Channel
                </CardTitle>
              }
            />
            <CardContent className="space-y-4">
              <p className="text-xs text-text-secondary">
                Follow these essential steps to generate, render, and publish your first automated YouTube Short.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
                <div className="bg-elevated p-3 rounded-xl border border-success/30 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-success uppercase">Step 1</span>
                  <span className="text-xs font-bold text-text-primary">Account Ready</span>
                  <span className="text-[11px] text-text-muted">✓ Configured</span>
                </div>

                <div className={`p-3 rounded-xl border flex flex-col gap-1 ${ytStatus?.connected ? 'bg-elevated border-success/30' : 'bg-surface border-border'}`}>
                  <span className={`text-[10px] font-bold uppercase ${ytStatus?.connected ? 'text-success' : 'text-warning'}`}>Step 2</span>
                  <span className="text-xs font-bold text-text-primary">Connect YouTube</span>
                  <Link to="/app/channels" className="text-[11px] text-brand-red hover:underline mt-auto">
                    {ytStatus?.connected ? '✓ Connected' : 'Connect now →'}
                  </Link>
                </div>

                <div className="bg-surface border border-border p-3 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-text-muted uppercase">Step 3</span>
                  <span className="text-xs font-bold text-text-primary">Select Niche</span>
                  <Link to="/app/channels" className="text-[11px] text-brand-red hover:underline mt-auto">
                    {activeChannel?.niche ? `✓ ${activeChannel.niche}` : 'Configure →'}
                  </Link>
                </div>

                <div className="bg-surface border border-border p-3 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-text-muted uppercase">Step 4</span>
                  <span className="text-xs font-bold text-text-primary">First Short</span>
                  <Link to="/app/create" className="text-[11px] text-brand-red hover:underline mt-auto">
                    Launch Studio →
                  </Link>
                </div>

                <div className="bg-surface border border-border p-3 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-text-muted uppercase">Step 5</span>
                  <span className="text-xs font-bold text-text-primary">Publish</span>
                  <span className="text-[11px] text-text-muted mt-auto">Review & Upload</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 4. Main Two-Column Workspace Layout ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* PRIMARY COLUMN (~65%): Active Pipeline & Action Queue */}
          <div className="lg:col-span-8 space-y-6 w-full">

            {/* Active In-Flight Pipeline */}
            {activeVideos.length > 0 && (
              <Card variant="surface" className="border-warning/30 bg-warning/5">
                <CardHeader
                  title={
                    <CardTitle icon={<Icon name="loader" className="animate-spin text-warning" size={18} />}>
                      Rendering in Progress ({activeVideos.length})
                    </CardTitle>
                  }
                  action={
                    <span className="badge badge-rendering">
                      Live Telemetry
                    </span>
                  }
                />
                <CardContent className="space-y-3">
                  {activeVideos.map(v => (
                    <div key={v.id} className="bg-surface p-4 rounded-xl border border-border space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <Link to={`/app/jobs/${v.id}`} className="font-bold text-text-primary hover:text-brand-red truncate pr-4">
                          {v.selected_title || v.title_candidates?.[0] || 'Draft Short'}
                        </Link>
                        <span className="font-mono text-warning font-bold">
                          {Math.round(v.render_progress || 0)}%
                        </span>
                      </div>
                      <div className="w-full bg-canvas rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-warning h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(5, Math.min(100, v.render_progress || 10))}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-text-muted">
                        <span className="capitalize">Stage: <strong className="text-text-secondary">{v.render_stage || 'queued'}</strong></span>
                        <Link to={`/app/jobs/${v.id}`} className="text-brand-red hover:underline font-medium">
                          Track Details →
                        </Link>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Action Required / Curation Queue */}
            <Card variant="surface" className="border-border">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="check-circle" className="text-brand-red" size={18} />}>
                    Action Required ({totalActionRequired})
                  </CardTitle>
                }
                action={
                  <span className="text-xs font-mono font-semibold text-text-secondary bg-elevated px-2 py-0.5 rounded border border-border">
                    Curation Queue
                  </span>
                }
              />

              <CardContent className="space-y-3">
                {totalActionRequired === 0 ? (
                  <div className="py-8 text-center text-text-muted text-xs space-y-2">
                    <div className="w-10 h-10 rounded-full bg-surface-hover border border-border flex items-center justify-center mx-auto text-success">
                      <Icon name="check" size={20} />
                    </div>
                    <p className="font-semibold text-text-secondary text-sm">All Curation Queues Clear</p>
                    <p className="text-[11px] max-w-sm mx-auto">
                      You have no pending ideas to promote or rendered videos waiting for approval.
                    </p>
                    <Link to="/app/ideas" className="inline-block pt-2">
                      <Button variant="secondary" size="sm" icon="lightbulb">
                        Explore New Ideas
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Rendered Videos Awaiting Publishing Review */}
                    {readyVideoList.map(v => (
                      <div key={v.id} className="bg-elevated/80 border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-border-strong transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-14 bg-canvas rounded-lg border border-border flex items-center justify-center shrink-0 text-brand-red">
                            <Icon name="video" size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <StatusBadge status="ready" size="sm" />
                              <span className="text-[10px] text-text-muted font-mono">
                                In Review
                              </span>
                            </div>
                            <h4 className="text-xs sm:text-sm font-bold text-text-primary truncate">
                              {v.selected_title || v.title_candidates?.[0] || 'Rendered Short Ready'}
                            </h4>
                            <p className="text-[11px] text-text-secondary">
                              Final video assembled with voiceover & captions. Ready for review.
                            </p>
                          </div>
                        </div>
                        <Link to="/app/videos" className="shrink-0">
                          <Button variant="primary" size="sm" icon="play">
                            Review Video
                          </Button>
                        </Link>
                      </div>
                    ))}

                    {/* Pending Ideas */}
                    {pendingIdeaList.length > 0 && (
                      <div className="bg-elevated/80 border border-border rounded-xl p-4 flex items-center justify-between gap-4 hover:border-border-strong transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-canvas rounded-lg border border-border flex items-center justify-center shrink-0 text-warning">
                            <Icon name="lightbulb" size={18} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-bold text-text-primary">
                              {stats.pendingIdeas} Idea{stats.pendingIdeas > 1 ? 's' : ''} Pending Curation
                            </h4>
                            <p className="text-[11px] text-text-secondary truncate">
                              Review generated concepts and promote top angles to script.
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

                    {/* Approved Scripts Ready to Storyboard */}
                    {approvedScriptList.length > 0 && (
                      <div className="bg-elevated/80 border border-border rounded-xl p-4 flex items-center justify-between gap-4 hover:border-border-strong transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-canvas rounded-lg border border-border flex items-center justify-center shrink-0 text-info">
                            <Icon name="fileText" size={18} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-bold text-text-primary">
                              {stats.approvedScripts} Script{stats.approvedScripts > 1 ? 's' : ''} Ready for Studio
                            </h4>
                            <p className="text-[11px] text-text-secondary truncate">
                              Scripts with visual prompts waiting for visual curation and rendering.
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
                  </>
                )}
              </CardContent>
            </Card>

            {/* Top Performing Content Section */}
            {topVideos.length > 0 && (
              <Card variant="surface" className="border-border">
                <CardHeader
                  title={
                    <CardTitle icon={<Icon name="star" className="text-warning" size={16} />}>
                      Top Performing Videos
                    </CardTitle>
                  }
                  action={
                    <Link to="/app/analytics" className="text-xs text-brand-red hover:underline font-semibold">
                      Full Analytics →
                    </Link>
                  }
                />
                <CardContent className="divide-y divide-border/40 p-0">
                  {topVideos.map(tv => (
                    <div key={tv.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-surface-hover transition-colors">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-text-primary truncate">
                          {tv.title}
                        </h4>
                        <div className="flex items-center gap-3 text-[10px] text-text-muted mt-0.5">
                          <span>{tv.views?.toLocaleString() || 0} views</span>
                          <span>•</span>
                          <span>{tv.likes?.toLocaleString() || 0} likes</span>
                          <span>•</span>
                          <span>{tv.comments?.toLocaleString() || 0} comments</span>
                        </div>
                      </div>
                      <Link to="/app/videos">
                        <Button variant="ghost" size="sm" icon="play">
                          View
                        </Button>
                      </Link>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

          </div>

          {/* SECONDARY COLUMN (~35%): Telemetry, Compute & Recommendations */}
          <div className="lg:col-span-4 space-y-6 w-full">

            {/* Production Costs / Engine Status */}
            <Card variant="surface" className="w-full">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="pieChart" size={16} className="text-brand-red" />}>
                    Production Costs
                  </CardTitle>
                }
                action={
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-red bg-brand-red/10 border border-brand-red/20 px-2 py-0.5 rounded">
                    Tracking Active
                  </span>
                }
              />
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-elevated border border-border/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${computeTelemetry ? 'bg-success shadow-[0_0_6px_#32C48D]' : 'bg-text-muted'}`} />
                    <span className="font-medium text-text-primary">
                      Production Engine
                    </span>
                  </div>
                  <span className={`text-[11px] font-mono font-semibold uppercase ${computeTelemetry ? 'text-success' : 'text-text-muted'}`}>
                    {computeTelemetry ? 'Online' : 'Standby'}
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">AI APIs & Cloud Render</span>
                    <span className="font-mono font-bold text-text-primary">
                      ${computeTelemetry?.cloud_burst?.today_spent_usd !== undefined ? computeTelemetry.cloud_burst.today_spent_usd.toFixed(2) : '0.00'}

                      <span className="text-text-muted font-normal"> / $2.00 cap</span>
                    </span>
                  </div>
                  <div className="w-full bg-elevated rounded-full h-1.5 overflow-hidden border border-border/60">
                    <div
                      className="bg-brand-red h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (((computeTelemetry?.cloud_burst?.today_spent_usd || 0) / 2.0) * 100))}%`
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Storage Utilization */}
            <Card variant="surface" className="w-full">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="hardDrive" size={16} className="text-warning" />}>
                    Storage Usage
                  </CardTitle>
                }
                action={
                  <span className="text-[11px] font-mono text-text-muted">
                    {analytics?.storage?.limit_mb ? `${Math.round(analytics.storage.limit_mb / 1000)}GB Limit` : '50GB'}
                  </span>
                }
              />
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-text-primary tracking-tight">
                      {analytics?.storage?.total_mb || 0}
                    </span>
                    <span className="text-xs text-text-muted font-sans font-medium">MB used</span>
                  </div>
                  <span className="text-xs font-mono text-text-secondary">
                    {Math.round(((analytics?.storage?.total_mb || 0) / (analytics?.storage?.limit_mb || 50000)) * 100)}%
                  </span>
                </div>

                <div className="w-full bg-elevated rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-brand-red h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (((analytics?.storage?.total_mb || 0) / (analytics?.storage?.limit_mb || 50000)) * 100))}%`
                    }}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] text-text-muted pt-1 border-t border-border/40">
                  <span>Output: <strong className="font-mono text-text-secondary">{analytics?.storage?.output_mb || 0} MB</strong></span>
                  <span>Temp: <strong className="font-mono text-text-secondary">{analytics?.storage?.temp_mb || 0} MB</strong></span>
                </div>
              </CardContent>
            </Card>

            {/* AI Recommendation Strategy */}
            <Card variant="surface" className="w-full border-border">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="zap" size={16} className="text-info" />}>
                    AI Content Strategy
                  </CardTitle>
                }
              />
              <CardContent className="space-y-3 text-xs">
                <p className="text-text-secondary leading-relaxed">
                  Focusing on <strong>{activeChannel?.niche || 'Technology'}</strong> content with curiosity hooks delivers higher audience retention.
                </p>
                <div className="p-2.5 rounded-lg bg-elevated border border-border text-[11px] space-y-1">
                  <div className="font-semibold text-text-primary">Recommended Action</div>
                  <div className="text-text-muted">
                    Generate 3 follow-up concepts around trending search queries.
                  </div>
                </div>
                <Link to="/app/ideas" className="block w-full">
                  <Button variant="secondary" size="sm" className="w-full">
                    Open Idea Lab
                  </Button>
                </Link>
              </CardContent>
            </Card>

          </div>

        </div>

      </div>
    </GridContainer>
  );
}
