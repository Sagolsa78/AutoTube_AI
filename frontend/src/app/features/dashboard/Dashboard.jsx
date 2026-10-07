import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Icon from '../../../components/Icon';
import { api } from '../../../services/api';
import { useChannel } from '../../../contexts/ChannelContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeChannelId } = useChannel();
  const [metrics, setMetrics] = useState({
    ideas: 0,
    scripts: 0,
    rendering: 0,
    review: 0,
    scheduled: 0,
    analytics: null
  });
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadDashboard = async () => {
      try {
        const [me, ideas, scripts, videos, analyticsData] = await Promise.all([
          api.getMe(),
          api.getIdeas(activeChannelId),
          api.getScripts(activeChannelId),
          api.getVideos(activeChannelId),
          api.getDashboardAnalytics(activeChannelId).catch(() => null)
        ]);
        if (!mounted) return;
        setProfile(me);

        setMetrics({
          ideas: (ideas || []).length,
          scripts: (scripts || []).length,
          rendering: (videos || []).filter(v => v.status === 'rendering').length,
          review: (videos || []).filter(v => ['ready', 'failed'].includes(v.status)).length,
          scheduled: (videos || []).filter(v => v.status === 'approved').length,
          analytics: analyticsData
        });
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      }
    };

    loadDashboard();
    // Poll for real-time updates every 15 seconds
    const intervalId = setInterval(loadDashboard, 15000);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [activeChannelId]);

  return (
    <div className="space-y-10 animate-in fade-in pb-12">

      {/* ── Greeting & Command Action ───────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            Good afternoon{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-text-secondary flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            Your content engine is running normally.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('/app/calendar')}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-elevated hover:bg-surface-hover text-text-primary transition-colors flex items-center gap-2 border border-border"
          >
            <Icon name="calendar" size={16} />
            Plan this week
          </button>
          <button
            onClick={() => navigate('/app/create')}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-text-primary hover:bg-white text-canvas transition-colors flex items-center gap-2 shadow-sm"
          >
            <Icon name="plus" size={16} />
            Create video
          </button>
        </div>
      </div>

      {/* ── Content Pipeline ─────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Content Pipeline</h2>

        <div className="flex flex-nowrap overflow-x-auto hide-scrollbar gap-2 sm:gap-4 pb-2">

          <PipelineCard title="Ideas" count={metrics.ideas} icon="lightbulb" to="/app/ideas" />
          <div className="hidden sm:flex items-center text-border shrink-0 px-1"><Icon name="arrow-right" size={16} /></div>

          <PipelineCard title="Scripts" count={metrics.scripts} icon="fileText" to="/app/scripts" />
          <div className="hidden sm:flex items-center text-border shrink-0 px-1"><Icon name="arrow-right" size={16} /></div>

          <PipelineCard title="Rendering" count={metrics.rendering} icon="loader" to="/app/videos?filter=rendering" isActive={metrics.rendering > 0} />
          <div className="hidden sm:flex items-center text-border shrink-0 px-1"><Icon name="arrow-right" size={16} /></div>

          <PipelineCard title="Review" count={metrics.review} icon="eye" to="/app/videos?filter=review" isAlert={metrics.review > 0} />
          <div className="hidden sm:flex items-center text-border shrink-0 px-1"><Icon name="arrow-right" size={16} /></div>

          <PipelineCard title="Scheduled" count={metrics.scheduled} icon="calendar" to="/app/calendar" />

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ── Action Required (Review) ───────────────────────────── */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Needs Your Attention</h2>

          <div className="bg-elevated border border-border/60 rounded-2xl overflow-hidden p-6 relative group transition-all hover:border-border">
            {metrics.review > 0 ? (
              <div className="space-y-5 relative z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-text-primary">
                    {metrics.review} video{metrics.review !== 1 && 's'} ready for review
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-brand-red animate-pulse" />
                </div>

                <div className="flex items-center gap-4 bg-surface p-3 rounded-xl border border-border/40">
                  <div className="w-16 h-24 bg-canvas rounded-lg overflow-hidden shrink-0 relative border border-border/30">
                    <div className="absolute inset-0 flex items-center justify-center text-text-muted">
                       <Icon name="play" size={20} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-text-primary truncate">Pending Review Output</h4>
                    <p className="text-xs text-text-secondary mt-1 flex items-center gap-2">
                      <span>60 sec</span>
                      <span>•</span>
                      <span>AI voice</span>
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/app/videos?filter=review')}
                    className="shrink-0 px-4 py-2 bg-text-primary text-canvas rounded-lg text-xs font-bold transition-transform hover:scale-105"
                  >
                    Review
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3 relative z-10">
                <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center text-text-muted mx-auto border border-border">
                  <Icon name="check" size={20} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-text-primary">You're all caught up!</p>
                  <p className="text-xs text-text-secondary">No videos are waiting for your approval.</p>
                </div>
              </div>
            )}

            {/* Ambient Background Detail */}
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
               <Icon name="bell" size={120} />
            </div>
          </div>
        </div>

        {/* ── This Week's Schedule ───────────────────────────────── */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold text-text-muted uppercase tracking-widest">This Week</h2>
            <Link to="/app/calendar" className="text-[11px] font-semibold text-text-primary hover:underline">View full calendar</Link>
          </div>

          <div className="bg-elevated border border-border/60 rounded-2xl p-5 space-y-6">
            <div className="flex justify-between items-center text-xs text-text-muted font-medium">
              <span className="flex-1 text-center">M</span>
              <span className="flex-1 text-center">T</span>
              <span className="flex-1 text-center">W</span>
              <span className="flex-1 text-center">T</span>
              <span className="flex-1 text-center text-text-primary font-bold">F</span>
              <span className="flex-1 text-center">S</span>
              <span className="flex-1 text-center">S</span>
            </div>

            <div className="flex justify-between items-center px-1">
               <ScheduleDot />
               <ScheduleDot />
               <ScheduleDot active count={2} />
               <ScheduleDot />
               <ScheduleDot today active count={1} />
               <ScheduleDot />
               <ScheduleDot active count={1} />
            </div>

            <div className="pt-4 border-t border-border/40 flex justify-between gap-2">
              <PlatformStatus icon="youtube" name="YouTube" stats={metrics.analytics?.publication_rates?.youtube} />
              <PlatformStatus icon="instagram" name="Instagram" stats={metrics.analytics?.publication_rates?.instagram} />
              <PlatformStatus icon="facebook" name="Facebook" stats={metrics.analytics?.publication_rates?.facebook} />
              <PlatformStatus icon="video" name="TikTok" stats={metrics.analytics?.publication_rates?.tiktok} />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function PipelineCard({ title, count, icon, to, isActive, isAlert }) {
  return (
    <Link
      to={to}
      className={`flex-1 min-w-[120px] bg-elevated border rounded-2xl p-4 flex flex-col gap-3 transition-all hover:-translate-y-1 ${
        isAlert ? 'border-brand-red/30 hover:border-brand-red/60 shadow-[0_4px_24px_rgba(230,57,47,0.1)]' :
        isActive ? 'border-text-primary/20 hover:border-text-primary/40' :
        'border-border/60 hover:border-border'
      }`}
    >
      <div className="flex items-center justify-between">
        <Icon name={icon} size={16} className={isAlert ? 'text-brand-red' : isActive ? 'text-text-primary' : 'text-text-muted'} />
        {isAlert && <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse" />}
      </div>
      <div>
        <div className={`text-2xl font-bold tracking-tight ${count > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
          {count}
        </div>
        <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mt-0.5">
          {title}
        </div>
      </div>
    </Link>
  );
}

function ScheduleDot({ active, today, count }) {
  return (
    <div className="flex-1 flex justify-center relative">
      {today && (
        <div className="absolute -inset-2 bg-text-primary/5 rounded-lg border border-text-primary/10" />
      )}
      {active ? (
        <div className="w-6 h-6 rounded-full bg-brand-red text-white flex items-center justify-center text-[10px] font-bold shadow-sm z-10">
          {count || 1}
        </div>
      ) : (
        <div className="w-1.5 h-1.5 rounded-full bg-border mt-2 z-10" />
      )}
    </div>
  );
}

function PlatformStatus({ icon, name, stats }) {
  const active = stats && stats.total > 0;
  const successRate = active ? Math.round((stats.success / stats.total) * 100) : 0;
  return (
    <div className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-colors flex-1 ${active ? 'bg-surface border border-border/50 text-text-primary shadow-sm' : 'text-text-muted opacity-50'}`}>
      <Icon name={icon} size={14} />
      <span className="text-[9px] font-bold uppercase tracking-wider">{name}</span>
      {active && (
        <span className={`text-[10px] font-bold ${successRate >= 80 ? 'text-success' : 'text-warning'}`}>
          {successRate}%
        </span>
      )}
    </div>
  );
}
