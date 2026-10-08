import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Icon from '../../../components/Icon';
import { api } from '../../../services/api';
import { useChannel } from '../../../contexts/ChannelContext';
import useContentStore from '../../../store/contentStore';
import { format } from 'date-fns';

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeChannelId } = useChannel();
  const { fetchContent, getMetrics, publications, scripts, ideas, videos } = useContentStore();
  const metrics = getMetrics();

  const [analytics, setAnalytics] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadDashboard = async () => {
      await fetchContent(activeChannelId, true);
      try {
        const [me, analyticsData] = await Promise.all([
          api.getMe(),
          api.getDashboardAnalytics(activeChannelId).catch(() => null)
        ]);
        if (!mounted) return;
        setProfile(me);
        setAnalytics(analyticsData);
      } catch (err) {
        console.error("Failed to load dashboard profile/analytics", err);
      }
    };

    loadDashboard();
    const intervalId = setInterval(loadDashboard, 30000); // Check every 30s
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [activeChannelId, fetchContent]);

  // Derived data
  const upcomingContent = publications.filter(p => new Date(p.scheduled_at || p.created_at) >= new Date() && p.status !== 'published').slice(0, 3);

  const incompleteScripts = scripts.slice(0, 2); // Show top 2 most recent
  const renderingVideos = videos.filter(v => v.status === 'rendering');
  const failedVideos = videos.filter(v => v.status === 'publish_failed' || v.status === 'render_failed');
  const reviewVideos = videos.filter(v => v.status === 'ready');

  return (
    <div className="space-y-12 animate-in fade-in pb-16 px-4 md:px-8 max-w-6xl mx-auto mt-8">

      {/* ── HEADER ───────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/50">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-text-primary">
            Good evening{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-text-secondary">
            Your content workspace is ready.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={() => navigate('/app/calendar')}
            className="px-5 py-3 rounded-xl text-xs font-bold bg-surface hover:bg-elevated text-text-primary transition-all flex items-center gap-2 border border-border shadow-sm hover:shadow-md"
          >
            <Icon name="calendar" size={16} /> Plan content
          </button>
          <button
            onClick={() => navigate('/app/create')}
            className="px-6 py-3 rounded-xl text-xs font-bold bg-text-primary hover:bg-white text-canvas transition-all flex items-center gap-2 shadow-[0_4px_14px_0_rgba(255,255,255,0.2)] hover:-translate-y-0.5"
          >
            <Icon name="sparkles" size={16} /> Create with AI
          </button>
        </div>
      </div>

      {/* ── CONTENT PIPELINE ─────────────────────────────────────── */}
      <div className="bg-surface/40 border border-border/50 rounded-2xl p-2 sm:p-3 overflow-x-auto hide-scrollbar flex items-center justify-between gap-2 shadow-sm">
         <PipelineNode title="Ideas" count={metrics.ideas} to="/app/ideas" />
         <Icon name="chevron-right" size={14} className="text-border shrink-0" />
         <PipelineNode title="Scripts" count={metrics.scripts} to="/app/scripts" />
         <Icon name="chevron-right" size={14} className="text-border shrink-0" />
         <PipelineNode title="Rendering" count={metrics.rendering} to="/app/videos?filter=rendering" isActive={metrics.rendering > 0} />
         <Icon name="chevron-right" size={14} className="text-border shrink-0" />
         <PipelineNode title="Review" count={metrics.review} to="/app/videos?filter=review" isAlert={metrics.review > 0} />
         <Icon name="chevron-right" size={14} className="text-border shrink-0" />
         <PipelineNode title="Scheduled" count={metrics.scheduled} to="/app/calendar" />
         <Icon name="chevron-right" size={14} className="text-border shrink-0" />
         <PipelineNode title="Failed" count={metrics.failed} to="/app/videos?filter=failed" isError={metrics.failed > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

        {/* LEFT COLUMN: Main actions & Content */}
        <div className="lg:col-span-8 space-y-10">

          {/* ── NEEDS YOUR ATTENTION ───────────────────────────── */}
          {(failedVideos.length > 0 || reviewVideos.length > 0) && (
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                <Icon name="alert-circle" size={14} className="text-brand-red" /> Needs Your Attention
              </h2>
              <div className="space-y-3">

                {failedVideos.map(video => (
                  <div key={video.id} className="flex flex-col sm:flex-row sm:items-center gap-4 bg-surface border-l-4 border-l-danger border-y border-r border-border/60 p-4 rounded-r-xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-24 aspect-video bg-canvas rounded-lg overflow-hidden shrink-0 border border-border/50">
                       <img src={video.thumbnail_url || 'https://via.placeholder.com/320x180/1a1b1e/3f4045?text=Failed'} alt="thumbnail" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-text-primary truncate">{video.title_candidates?.[0] || 'Untitled Video'}</h4>
                      <p className="text-xs text-danger font-medium mt-1">Render failed • {format(new Date(video.created_at), 'MMM d, h:mm a')}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-3 sm:mt-0">
                      <button className="px-3 py-1.5 text-[11px] font-bold text-text-secondary hover:text-text-primary bg-canvas border border-border rounded-lg transition-colors">View details</button>
                      <button className="px-3 py-1.5 text-[11px] font-bold bg-danger/10 text-danger hover:bg-danger hover:text-white border border-danger/20 rounded-lg transition-colors">Retry</button>
                    </div>
                  </div>
                ))}

                {reviewVideos.map(video => (
                  <div key={video.id} className="flex flex-col sm:flex-row sm:items-center gap-4 bg-surface border-l-4 border-l-warning border-y border-r border-border/60 p-4 rounded-r-xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-24 aspect-[9/16] max-h-32 bg-canvas rounded-lg overflow-hidden shrink-0 border border-border/50">
                       <video src={video.url} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-text-primary truncate">{video.selected_title || 'Untitled Output'}</h4>
                      <p className="text-xs text-warning font-medium mt-1">Ready for review</p>
                    </div>
                    <div className="flex items-center gap-2 mt-3 sm:mt-0">
                      <button onClick={() => navigate('/app/videos?filter=review')} className="px-4 py-2 text-xs font-bold bg-text-primary text-canvas hover:bg-white rounded-lg transition-colors shadow-sm">
                        Review
                      </button>
                    </div>
                  </div>
                ))}

              </div>
            </div>
          )}

          {/* ── CONTINUE CREATING ───────────────────────────── */}
          <div className="space-y-4">
             <div className="flex justify-between items-center">
               <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Continue Creating</h2>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

                {incompleteScripts.map(script => (
                  <div key={script.id} className="bg-canvas border border-border/60 rounded-xl overflow-hidden hover:border-brand-red/50 transition-colors group flex flex-col shadow-sm hover:shadow-md">
                     <div className="w-full aspect-[4/3] bg-surface relative p-4 flex flex-col justify-between border-b border-border/40">
                       <div className="flex justify-between">
                         <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary bg-elevated px-2 py-0.5 rounded border border-border">Scripting</span>
                         <span className="text-[10px] font-mono text-text-muted">45%</span>
                       </div>
                       <Icon name="file-text" size={32} className="text-border group-hover:text-text-secondary transition-colors" />
                     </div>
                     <div className="p-4 flex flex-col flex-1">
                        <h3 className="text-sm font-bold text-text-primary line-clamp-2 leading-snug flex-1 mb-4">{script.topic || 'Untitled Idea'}</h3>
                        <button onClick={() => navigate('/app/create')} className="w-full bg-brand-red/10 text-brand-red hover:bg-brand-red hover:text-white border border-brand-red/20 py-2 rounded-lg text-xs font-bold transition-colors">
                          Continue
                        </button>
                     </div>
                  </div>
                ))}

                {renderingVideos.map(video => (
                  <div key={video.id} className="bg-canvas border border-border/60 rounded-xl overflow-hidden hover:border-brand-red/50 transition-colors group flex flex-col shadow-sm hover:shadow-md">
                     <div className="w-full aspect-[4/3] bg-surface relative flex items-center justify-center border-b border-border/40">
                        <Icon name="loader" size={24} className="text-brand-red animate-spin" />
                        <div className="absolute top-3 right-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-red bg-brand-red/10 border border-brand-red/20 px-2 py-0.5 rounded">Rendering</span>
                        </div>
                     </div>
                     <div className="p-4 flex flex-col flex-1">
                        <h3 className="text-sm font-bold text-text-primary line-clamp-2 leading-snug flex-1 mb-4">{video.title_candidates?.[0] || 'Rendering...'}</h3>
                        <button onClick={() => navigate('/app/videos')} className="w-full bg-surface text-text-primary border border-border hover:bg-elevated py-2 rounded-lg text-xs font-bold transition-colors">
                          View Progress
                        </button>
                     </div>
                  </div>
                ))}

                {incompleteScripts.length === 0 && renderingVideos.length === 0 && (
                  <div className="col-span-full py-12 text-center border border-dashed border-border/60 rounded-xl bg-surface/30">
                    <Icon name="layers" size={32} className="text-border mx-auto mb-3" />
                    <p className="text-sm font-bold text-text-primary">No active projects</p>
                    <p className="text-xs text-text-muted mt-1 mb-4">Start generating a new video now.</p>
                    <button onClick={() => navigate('/app/create')} className="text-xs font-bold bg-brand-red text-white px-5 py-2 rounded-lg shadow-sm">New Video</button>
                  </div>
                )}
             </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Upcoming & Insights */}
        <div className="lg:col-span-4 space-y-10">

           {/* ── UPCOMING ───────────────────────────── */}
           <div className="space-y-4">
             <div className="flex items-center justify-between">
               <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Upcoming</h2>
               <Link to="/app/calendar" className="text-[10px] font-bold text-brand-red hover:underline uppercase">Full Calendar</Link>
             </div>

             <div className="bg-canvas border border-border/60 rounded-2xl p-2 shadow-sm">
                {upcomingContent.length > 0 ? upcomingContent.map((item, i) => (
                  <div key={item.id} className={`flex items-start gap-3 p-3 rounded-xl hover:bg-surface transition-colors ${i !== upcomingContent.length - 1 ? 'border-b border-border/30' : ''}`}>
                    <div className="w-12 h-16 bg-surface rounded overflow-hidden shrink-0">
                       {item.thumbnail_url ? (
                         <img src={item.thumbnail_url} className="w-full h-full object-cover" alt="" />
                       ) : (
                         <Icon name="video" size={16} className="text-border mx-auto mt-4" />
                       )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text-primary line-clamp-2 leading-tight mb-1">{item.title}</h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-text-secondary font-medium">
                         <Icon name={item.platform === 'youtube' ? 'youtube' : 'calendar'} size={10} />
                         <span>{format(new Date(item.scheduled_at || item.created_at), "MMM d, h:mm a")}</span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <p className="text-xs text-text-muted">Nothing scheduled.</p>
                  </div>
                )}
             </div>
           </div>

           {/* ── AI INSIGHTS ───────────────────────────── */}
           <div className="space-y-4">
             <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
               <Icon name="sparkles" size={14} className="text-brand-red" /> Auto Insights
             </h2>
             <div className="bg-surface border border-border/60 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><Icon name="trending-up" size={64} /></div>
                <div className="relative z-10 text-center py-4">
                   <p className="text-sm font-bold text-text-primary mb-2">Not enough data</p>
                   <p className="text-xs text-text-secondary">AI insights will appear here once you publish more videos.</p>
                </div>
             </div>
           </div>

           {/* ── PERFORMANCE ───────────────────────────── */}
           <div className="space-y-4">
             <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Performance</h2>
             <div className="grid grid-cols-2 gap-3">
               <MetricCard label="Views" value={analytics?.performance?.total_views || 0} />
               <MetricCard label="Subs" value={analytics?.performance?.total_subs || 0} />
               <MetricCard label="Likes" value={analytics?.performance?.total_likes || 0} />
               <MetricCard label="Published" value={analytics?.performance?.total_videos || 0} />
             </div>
           </div>

        </div>
      </div>
    </div>
  );
}

function PipelineNode({ title, count, to, isActive, isAlert, isError }) {
  return (
    <Link
      to={to}
      className={`flex flex-col px-4 py-2 rounded-xl transition-all min-w-[80px] hover:bg-surface-hover ${
        isActive ? 'bg-surface shadow-sm ring-1 ring-border text-text-primary' :
        isAlert ? 'bg-warning/10 ring-1 ring-warning/30' :
        isError ? 'bg-danger/10 ring-1 ring-danger/30' :
        'opacity-80 hover:opacity-100 text-text-secondary'
      }`}
    >
      <span className={`text-lg font-black leading-none ${isError ? 'text-danger' : isAlert ? 'text-warning' : isActive ? 'text-brand-red' : ''}`}>
        {count}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest mt-1">
        {title}
      </span>
    </Link>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="bg-canvas border border-border/60 rounded-xl p-4 shadow-sm flex flex-col justify-center text-center">
      <span className="text-xl font-black text-text-primary tracking-tight">{value}</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">{label}</span>
    </div>
  );
}
