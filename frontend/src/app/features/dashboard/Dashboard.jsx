import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Icon from '../../../components/Icon';
import { api } from '../../../services/api';
import { useChannel } from '../../../contexts/ChannelContext';
import useContentStore from '../../../store/contentStore';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeChannelId } = useChannel();
  const { fetchContent, getMetrics, publications, scripts, ideas, videos } = useContentStore();
  const metrics = getMetrics();

  const [analytics, setAnalytics] = useState(null);
  const [topVideos, setTopVideos] = useState([]);
  const [profile, setProfile] = useState(null);
  const [recommendedIdea, setRecommendedIdea] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProject = async (topic = "Untitled Project", ideaId = null) => {
    if (!activeChannelId) {
      toast.error("Please select a workspace first.");
      return;
    }
    setIsCreating(true);
    try {
      let proj;
      if (ideaId) {
         proj = await api.createProject(activeChannelId, topic);
         await api.updateProject(proj.id, { idea_id: ideaId });
      } else {
         proj = await api.createProject(activeChannelId, topic);
      }
      navigate(`/app/create?project=${proj.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to initialize project");
      setIsCreating(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadDashboard = async () => {
      await fetchContent(activeChannelId, true);
      try {
        const [me, analyticsData, topVids, recIdea] = await Promise.all([
          api.getMe(),
          api.getDashboardAnalytics(activeChannelId).catch(() => null),
          api.getTopVideos(activeChannelId).catch(() => []),
          api.getRecommendedIdea(activeChannelId).catch(() => null)
        ]);
        if (!mounted) return;
        setProfile(me);
        setAnalytics(analyticsData);
        setTopVideos(topVids);
        if (recIdea && !recIdea.error && recIdea.recommended_topic) setRecommendedIdea(recIdea);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
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
  const scheduledVideos = videos.filter(v => v.status === 'approved').map(v => ({ id: v.id, title: v.selected_title || v.derivedTitle, scheduled_at: v.created_at, platform: 'youtube', thumbnail_url: v.thumbnail_url }));
  const pubScheduled = publications.filter(p => new Date(p.scheduled_at || p.created_at) >= new Date() && p.status !== 'published');
  const upcomingContent = [...pubScheduled, ...scheduledVideos].slice(0, 3);

  const incompleteScripts = scripts.filter(s => !videos.some(v => v.script_id === s.id)).slice(0, 3);
  const renderingVideos = videos.filter(v => ['rendering', 'in_progress', 'queued', 'generating'].includes(v.status));
  const failedVideos = videos.filter(v => v.status === 'publish_failed' || v.status === 'render_failed' || v.status === 'failed');
  const reviewVideos = videos.filter(v => v.status === 'ready' || v.status === 'done');
  const recentActivity = [...videos, ...scripts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  const handleArchive = async (e, type, id) => {
    e.stopPropagation();
    try {
      if (type === 'script') {
        await api.discardScript(id);
      } else {
        // Fallback for video or others (since we don't have deleteVideo explicit in the requirements, we'll cancel it if possible)
        await api.cancelVideo(id);
      }
      toast.success("Archived successfully");
      fetchContent(activeChannelId, true);
    } catch (err) {
      toast.error("Failed to archive");
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const [promptText, setPromptText] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isBrainstorming, setIsBrainstorming] = useState(false);

  const userName = profile?.display_name || profile?.name || '';
  const firstName = userName ? userName.split(' ')[0] : 'Creator';

  const starterTopics = [
    { label: '⚡ Tech Secrets', prompt: '5 secret tech hacks engineers never share' },
    { label: '🏛️ Ancient Rome', prompt: 'The most bizarre law in Ancient Rome that was strictly enforced' },
    { label: '🧠 Psychology Trick', prompt: '3 psychology tricks that make anyone respect you immediately' },
    { label: '🌌 Black Hole Mystery', prompt: 'What actually happens in the final 5 seconds before entering a black hole' },
  ];

  const handlePromptSubmit = (e) => {
    e?.preventDefault();
    if (!promptText.trim()) return;
    handleCreateProject(promptText.trim());
  };

  const handleAskAutoTube = async () => {
    if (!aiInput.trim()) return;
    setIsBrainstorming(true);
    try {
      const res = await api.improveIdea(aiInput.trim(), activeChannelId);
      if (res.improved_topic) {
        toast.success("AI generated a viral concept!");
        handleCreateProject(res.improved_topic);
        setShowAiModal(false);
      } else {
        handleCreateProject(aiInput.trim());
        setShowAiModal(false);
      }
    } catch (err) {
      handleCreateProject(aiInput.trim());
      setShowAiModal(false);
    } finally {
      setIsBrainstorming(false);
    }
  };

  // Monetization stats
  const currentViews = analytics?.monetization?.current_views || analytics?.performance?.total_views || 0;
  const currentSubs = analytics?.monetization?.current_subs || analytics?.performance?.total_subs || 0;
  const subsTarget = analytics?.monetization?.subs_target || 1000;
  const viewsTarget = analytics?.monetization?.views_target || 10000000;
  const subsPercent = Math.min(100, Math.round((currentSubs / subsTarget) * 100));
  const viewsPercent = Math.min(100, Math.round((currentViews / viewsTarget) * 100));

  // Storage stats
  const storageUsed = analytics?.storage?.total_mb || 0;
  const storageLimit = analytics?.storage?.limit_mb || 50000;
  const storagePercent = Math.min(100, Math.round((storageUsed / storageLimit) * 100));

  return (
    <div className="space-y-10 animate-in fade-in pb-16 px-4 md:px-8 max-w-[1400px] mx-auto mt-6">

      {/* ── CINEMATIC AI HERO ───────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-surface border border-border/80 p-8 md:p-10 shadow-card-subtle flex flex-col gap-8 isolate">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-red/10 via-ai/5 to-transparent pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-ai/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-brand-red/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ai/10 border border-ai/20 text-ai text-xs font-bold uppercase tracking-wider mb-1">
              <Icon name="sparkles" size={14} className="animate-pulse" />
              <span>AI Production Studio Active</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-text-primary">
              {getGreeting()}, <span className="bg-gradient-to-r from-text-primary via-white to-text-secondary bg-clip-text text-transparent">{firstName}</span>.
            </h1>
            <p className="text-sm md:text-base text-text-secondary max-w-xl">
              Turn any topic into an automated YouTube Short in under 60 seconds. Voice, script, storyboard & visuals orchestrated by AI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => handleCreateProject()}
              disabled={isCreating}
              className="px-6 py-3.5 rounded-xl text-sm font-bold bg-brand hover:bg-brand-hover text-white transition-all flex items-center gap-2 shadow-brand-glow hover:-translate-y-0.5 disabled:opacity-50"
            >
              {isCreating ? <Icon name="loader" size={18} className="animate-spin" /> : <Icon name="plus" size={18} />} Create Video
            </button>
            <button
              onClick={() => navigate('/app/calendar')}
              className="px-5 py-3.5 rounded-xl text-sm font-bold bg-elevated hover:bg-elevated-hover border border-border text-text-primary transition-all flex items-center gap-2 hover:-translate-y-0.5"
            >
              <Icon name="calendar" size={18} /> Schedule
            </button>
            <button
              onClick={() => setShowAiModal(true)}
              className="px-5 py-3.5 rounded-xl text-sm font-bold bg-ai/10 hover:bg-ai/20 border border-ai/25 text-ai transition-all flex items-center gap-2 shadow-ai-glow hover:-translate-y-0.5"
            >
              <Icon name="sparkles" size={18} /> Ask AutoTube
            </button>
          </div>
        </div>

        {/* ── QUICK AI PROMPT COMMAND BAR ────────────────────── */}
        <div className="relative z-10 bg-canvas/80 backdrop-blur-xl border border-border/80 rounded-2xl p-3 shadow-inner">
          <form onSubmit={handlePromptSubmit} className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full flex items-center">
              <Icon name="sparkles" size={18} className="absolute left-4 text-ai shrink-0" />
              <input
                type="text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="What video do you want to create? (e.g. '5 unexplainable deep ocean mysteries')..."
                className="w-full bg-transparent pl-12 pr-4 py-3 text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!promptText.trim() || isCreating}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-ai to-ai-end hover:opacity-90 text-white transition-all flex items-center justify-center gap-2 shadow-ai-glow disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {isCreating ? <Icon name="loader" size={14} className="animate-spin" /> : <Icon name="zap" size={14} />}
              Generate with AI
            </button>
          </form>

          {/* Quick Starter Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/40 mt-3 px-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mr-1">Trending:</span>
            {starterTopics.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPromptText(item.prompt);
                  handleCreateProject(item.prompt);
                }}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-surface hover:bg-elevated border border-border/60 hover:border-ai/40 text-text-secondary hover:text-text-primary transition-all hover:-translate-y-0.5"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRODUCTION PIPELINE TRACKER ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pl-1">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Creation Pipeline</h2>
          <span className="text-[11px] font-mono text-text-secondary">Auto-syncing active jobs</span>
        </div>
        <div className="bg-surface/60 backdrop-blur-md border border-border rounded-2xl p-4 overflow-x-auto hide-scrollbar flex items-center justify-between gap-1 shadow-sm relative">
          <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-border/60 -z-10 -translate-y-1/2" />
          <PipelineNode title="Ideas" count={metrics.ideas} to="/app/ideas" isActive={metrics.ideas > 0} icon="lightbulb" />
          <Icon name="chevron-right" size={16} className="text-border bg-canvas rounded-full px-0.5 shrink-0" />
          <PipelineNode title="Scripts" count={metrics.scripts} to="/app/scripts" isActive={metrics.scripts > 0} icon="file-text" />
          <Icon name="chevron-right" size={16} className="text-border bg-canvas rounded-full px-0.5 shrink-0" />
          <PipelineNode title="Rendering" count={metrics.rendering} to="/app/videos?filter=rendering" isActive={metrics.rendering > 0} isPulse icon="loader" />
          <Icon name="chevron-right" size={16} className="text-border bg-canvas rounded-full px-0.5 shrink-0" />
          <PipelineNode title="Review" count={metrics.review} to="/app/videos?filter=review" isAlert={metrics.review > 0} icon="eye" />
          <Icon name="chevron-right" size={16} className="text-border bg-canvas rounded-full px-0.5 shrink-0" />
          <PipelineNode title="Scheduled" count={metrics.scheduled} to="/app/calendar" icon="calendar" />
          <Icon name="chevron-right" size={16} className="text-border bg-canvas rounded-full px-0.5 shrink-0" />
          <PipelineNode title="Failed" count={metrics.failed} to="/app/videos?filter=failed" isError={metrics.failed > 0} icon="alert-triangle" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Main actions & Content */}
        <div className="xl:col-span-8 space-y-10">

          {/* ── CONTINUE CREATING ───────────────────────────── */}
          <div className="space-y-4">
             <div className="flex justify-between items-center pl-1">
               <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Active Workspace Projects</h2>
             </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviewVideos.map(video => (
                  <ProjectCard key={video.id} item={video} type="review" onClick={() => navigate('/app/videos?filter=review')} onArchive={(e) => handleArchive(e, 'video', video.id)} />
                ))}
                {failedVideos.map(video => (
                  <ProjectCard key={video.id} item={video} type="failed" onClick={() => navigate('/app/videos?filter=failed')} onArchive={(e) => handleArchive(e, 'video', video.id)} />
                ))}
                {renderingVideos.map(video => (
                  <ProjectCard key={video.id} item={video} type="rendering" onClick={() => navigate('/app/videos')} />
                ))}
                {incompleteScripts.map(script => (
                  <ProjectCard key={script.id} item={script} type="script" onClick={() => navigate('/app/create')} onArchive={(e) => handleArchive(e, 'script', script.id)} />
                ))}

                {reviewVideos.length === 0 && failedVideos.length === 0 && renderingVideos.length === 0 && incompleteScripts.length === 0 && (
                  <div className="col-span-full py-16 text-center border border-border border-dashed rounded-2xl bg-surface/30">
                    <div className="w-16 h-16 bg-surface border border-border rounded-full flex items-center justify-center mx-auto mb-4 text-text-muted shadow-sm">
                      <Icon name="layers" size={24} />
                    </div>
                    <p className="text-base font-bold text-text-primary">No active projects in progress</p>
                    <p className="text-sm text-text-secondary mt-1 mb-6">Start a new short with AI assistance.</p>
                    <button onClick={() => handleCreateProject()} className="text-sm font-bold bg-brand hover:bg-brand-hover text-white px-6 py-2.5 rounded-xl shadow-brand-glow hover:-translate-y-0.5 transition-transform">Start a Project</button>
                  </div>
                )}
             </div>
          </div>

          {/* ── RECOMMENDED NEXT IDEA ───────────────────────────── */}
          {recommendedIdea && (
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-ai uppercase tracking-widest pl-1 flex items-center gap-2">
                <Icon name="sparkles" size={14} /> AI Recommended Next Concept
              </h2>
              <div className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-ai/10 via-surface to-canvas border border-ai/20 rounded-2xl p-6 shadow-ai-glow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                   <div className="space-y-2 flex-1">
                     <h3 className="text-lg font-black text-text-primary leading-tight">{recommendedIdea.recommended_topic}</h3>
                     <p className="text-sm text-text-secondary italic">"{recommendedIdea.reason}"</p>
                   </div>
                   <div className="shrink-0 flex items-center gap-3">
                      <button
                         onClick={() => handleCreateProject(recommendedIdea.recommended_topic, recommendedIdea.idea_id)}
                         className="px-5 py-2.5 bg-ai/10 hover:bg-ai/20 text-ai border border-ai/20 rounded-xl text-xs font-bold transition-colors hover:-translate-y-0.5 flex items-center gap-2 shadow-sm"
                      >
                         <Icon name="zap" size={14} />
                         Use this idea
                      </button>
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* ── RECENT ACTIVITY ───────────────────────────── */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest pl-1">Recent Activity</h2>
            <div className="bg-canvas border border-border rounded-2xl overflow-hidden shadow-sm">
              {recentActivity.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {recentActivity.map((item, i) => (
                    <div key={item.id || i} className="flex items-center gap-4 p-4 hover:bg-surface transition-colors">
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.status === 'published' ? 'bg-success/10 text-success' : item.status === 'publish_failed' ? 'bg-danger/10 text-danger' : 'bg-surface border border-border text-text-secondary'}`}>
                         <Icon name={item.status === 'published' ? 'check-circle' : item.topic ? 'file-text' : 'video'} size={18} />
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className="text-sm font-bold text-text-primary truncate">{item.title || item.selected_title || item.title_candidates?.[0] || item.topic || 'Untitled Project'}</p>
                         <p className="text-xs text-text-muted truncate mt-0.5">
                           {item.topic ? 'Script drafted' : item.status === 'published' ? 'Video published' : item.status === 'ready' ? 'Video rendered' : 'Project updated'} • {format(new Date(item.created_at), 'MMM d, h:mm a')}
                         </p>
                       </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-text-muted text-sm">No recent activity recorded.</div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Upcoming, Performance & Monetization */}
        <div className="xl:col-span-4 space-y-10">

           {/* ── MONETIZATION & YOUTUBE STATUS ───────────────────────────── */}
           <div className="space-y-4">
             <div className="flex items-center justify-between pl-1">
               <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Monetization Tracker</h2>
               <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${analytics?.youtube_connected ? 'bg-success/10 text-success border border-success/20' : 'bg-warning/10 text-warning border border-warning/20'}`}>
                 {analytics?.youtube_connected ? 'YouTube Linked' : 'Not Connected'}
               </span>
             </div>

             <div className="bg-surface border border-border rounded-2xl p-5 shadow-card-subtle space-y-5">
               {/* Subscribers Goal */}
               <div className="space-y-2">
                 <div className="flex items-center justify-between text-xs">
                   <span className="font-semibold text-text-secondary flex items-center gap-1.5">
                     <Icon name="users" size={14} className="text-brand-red" /> 1,000 Subscribers
                   </span>
                   <span className="font-mono font-bold text-text-primary">{currentSubs.toLocaleString()} / 1,000 ({subsPercent}%)</span>
                 </div>
                 <div className="w-full h-2 bg-canvas rounded-full overflow-hidden border border-border/50">
                   <div
                     className="h-full bg-gradient-to-r from-brand-red to-ai rounded-full transition-all duration-500"
                     style={{ width: `${subsPercent}%` }}
                   />
                 </div>
               </div>

               {/* Shorts Views Goal */}
               <div className="space-y-2">
                 <div className="flex items-center justify-between text-xs">
                   <span className="font-semibold text-text-secondary flex items-center gap-1.5">
                     <Icon name="eye" size={14} className="text-ai" /> 10M Shorts Views
                   </span>
                   <span className="font-mono font-bold text-text-primary">{currentViews.toLocaleString()} / 10M ({viewsPercent}%)</span>
                 </div>
                 <div className="w-full h-2 bg-canvas rounded-full overflow-hidden border border-border/50">
                   <div
                     className="h-full bg-gradient-to-r from-ai to-ai-end rounded-full transition-all duration-500"
                     style={{ width: `${Math.max(1, viewsPercent)}%` }}
                   />
                 </div>
               </div>

               {/* Storage Usage Telemetry */}
               <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs text-text-muted">
                 <span className="flex items-center gap-1.5">
                   <Icon name="hard-drive" size={13} /> Storage: {storageUsed} MB
                 </span>
                 <span className="font-mono text-[10px] text-text-secondary">{storagePercent}% of 50 GB</span>
               </div>
             </div>
           </div>

           {/* ── UPCOMING CONTENT ───────────────────────────── */}
           <div className="space-y-4">
             <div className="flex items-center justify-between pl-1">
               <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Upcoming</h2>
               <Link to="/app/calendar" className="text-[10px] font-bold text-text-secondary hover:text-text-primary uppercase tracking-wider">View All</Link>
             </div>

             <div className="bg-surface border border-border rounded-2xl p-2 shadow-sm">
                {upcomingContent.length > 0 ? upcomingContent.map((item, i) => (
                  <div key={item.id} className={`flex items-start gap-4 p-3 rounded-xl hover:bg-elevated transition-colors ${i !== upcomingContent.length - 1 ? 'border-b border-border/50' : ''}`}>
                    <div className="w-16 h-20 bg-canvas rounded-lg overflow-hidden shrink-0 border border-border/50">
                       {item.thumbnail_url ? (
                         <img src={item.thumbnail_url} className="w-full h-full object-cover" alt="" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center text-border"><Icon name="calendar" size={20} /></div>
                       )}
                    </div>
                    <div className="py-1">
                      <h4 className="text-sm font-bold text-text-primary line-clamp-2 leading-snug mb-2">{item.title}</h4>
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-canvas border border-border rounded-md text-[10px] text-text-secondary font-bold tracking-wide uppercase">
                         <Icon name={item.platform === 'youtube' ? 'youtube' : 'calendar'} size={12} className={item.platform === 'youtube' ? 'text-brand-red' : ''} />
                         <span>{format(new Date(item.scheduled_at || item.created_at), "MMM d")}</span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="p-8 text-center text-text-muted text-sm border border-dashed border-border/50 rounded-xl m-2">
                    Nothing scheduled yet.
                  </div>
                )}
             </div>
           </div>

           {/* ── PERFORMANCE METRICS ───────────────────────────── */}
           <div className="space-y-4">
             <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest pl-1">Channel Performance</h2>
             <div className="grid grid-cols-2 gap-3">
               <MetricCard label="Views" value={currentViews.toLocaleString()} icon="eye" />
               <MetricCard label="Subs" value={currentSubs.toLocaleString()} icon="users" />
               <MetricCard label="Likes" value={(analytics?.performance?.total_likes || 0).toLocaleString()} icon="thumbs-up" />
               <MetricCard label="Published" value={(analytics?.performance?.total_videos || 0).toLocaleString()} icon="video" />
             </div>
           </div>

           {/* ── TOP PERFORMING ───────────────────────────── */}
           {topVideos.length > 0 && (
             <div className="space-y-4">
               <div className="flex items-center justify-between pl-1">
                 <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Top Performing</h2>
               </div>
               <div className="bg-surface border border-border rounded-2xl p-2 shadow-sm">
                 {topVideos.map((item, i) => (
                   <div key={item.id} className={`flex items-center gap-4 p-3 rounded-xl hover:bg-elevated transition-colors ${i !== topVideos.length - 1 ? 'border-b border-border/50' : ''}`}>
                     <div className="flex-1 min-w-0">
                       <h4 className="text-xs font-bold text-text-primary truncate">{item.title}</h4>
                       <div className="flex items-center gap-3 mt-1">
                         <span className="text-[10px] text-text-muted font-mono"><Icon name="eye" size={10} className="inline mr-1"/>{item.views.toLocaleString()}</span>
                         <span className="text-[10px] text-text-muted font-mono"><Icon name="thumbs-up" size={10} className="inline mr-1"/>{item.likes.toLocaleString()}</span>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}

        </div>
      </div>

      {/* ── ASK AUTOTUBE MODAL ───────────────────────────── */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-ai">
                <Icon name="sparkles" size={20} />
                <h3 className="text-base font-bold text-text-primary">Ask AutoTube AI</h3>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="p-1 rounded-lg hover:bg-elevated text-text-muted hover:text-text-primary transition-colors"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Describe an idea, angle, or niche. AutoTube will analyze viral trends, formulate a retention hook, and launch the creation pipeline.
            </p>

            <textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="e.g. A fast-paced 45-second short explaining why airplanes avoid flying over the Pacific Ocean..."
              rows={4}
              className="w-full bg-canvas border border-border rounded-xl p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ai transition-colors resize-none"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!aiInput.trim() || isBrainstorming}
                onClick={handleAskAutoTube}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-ai hover:bg-ai-hover text-white transition-all flex items-center gap-2 shadow-ai-glow disabled:opacity-50"
              >
                {isBrainstorming ? <Icon name="loader" size={14} className="animate-spin" /> : <Icon name="zap" size={14} />}
                Generate & Start Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PipelineNode({ title, count, to, isActive, isAlert, isError, isPulse, icon }) {
  return (
    <Link
      to={to}
      className={`relative z-10 flex flex-col items-center justify-center p-3 rounded-xl bg-canvas border transition-all min-w-[90px] shadow-sm hover:-translate-y-0.5 ${
        isActive ? 'border-ai text-text-primary shadow-ai-glow' :
        isAlert ? 'border-warning text-text-primary' :
        isError ? 'border-danger text-text-primary' :
        'border-border text-text-muted hover:border-text-muted hover:text-text-primary'
      }`}
    >
      <div className={`mb-1.5 ${isActive ? 'text-ai' : isAlert ? 'text-warning' : isError ? 'text-danger' : 'text-text-muted'}`}>
        <Icon name={icon} size={18} className={isPulse ? 'animate-spin' : ''} />
      </div>
      <span className="text-lg font-black leading-none">{count}</span>
      <span className="text-[9px] font-bold uppercase tracking-widest mt-1 opacity-80">{title}</span>
    </Link>
  );
}

function MetricCard({ label, value, icon }) {
  return (
    <div className="bg-canvas border border-border rounded-xl p-4 shadow-sm flex flex-col justify-center text-center group hover:border-ai/50 transition-colors">
      <div className="mb-2 text-text-muted group-hover:text-ai transition-colors">
        <Icon name={icon} size={20} className="mx-auto" />
      </div>
      <span className="text-2xl font-black text-text-primary tracking-tight">{value}</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">{label}</span>
    </div>
  );
}

function ProjectCard({ item, type, onClick, onArchive }) {
  let statusColor = 'text-text-secondary';
  let statusBg = 'bg-surface';
  let badgeLabel = 'Draft';
  let icon = 'file-text';
  let progress = '0%';

  if (type === 'review') {
    statusColor = 'text-warning';
    statusBg = 'bg-warning/10';
    badgeLabel = 'Review Ready';
    icon = 'eye';
    progress = '100%';
  } else if (type === 'rendering') {
    statusColor = 'text-brand-red';
    statusBg = 'bg-brand-red/10';
    badgeLabel = 'Rendering';
    icon = 'loader';
    progress = '80%';
  } else if (type === 'failed') {
    statusColor = 'text-danger';
    statusBg = 'bg-danger/10';
    badgeLabel = 'Failed';
    icon = 'alert-triangle';
    progress = 'Stopped';
  } else if (type === 'script') {
    statusColor = 'text-ai';
    statusBg = 'bg-ai/10';
    badgeLabel = 'Scripting';
    icon = 'edit-3';
    progress = '45%';
  }

  return (
    <div className="relative text-left bg-surface border border-border rounded-xl overflow-hidden hover:border-ai/50 transition-all group flex flex-col shadow-sm hover:shadow-md hover:-translate-y-1">
      <button onClick={onClick} className="w-full text-left flex flex-col flex-1 h-full">
        <div className="w-full aspect-video bg-canvas relative flex flex-col justify-between p-4 border-b border-border">
          <div className="flex justify-between items-center z-10">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-current ${statusBg} ${statusColor}`}>
              {badgeLabel}
            </span>
            <span className="text-[10px] font-mono font-bold text-text-muted bg-surface px-1.5 py-0.5 rounded">{progress}</span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:opacity-60 transition-opacity">
            <Icon name={icon} size={48} className={type === 'rendering' ? 'animate-spin' : ''} />
          </div>
          {item.thumbnail_url && (
            <div className="absolute inset-0 opacity-40 group-hover:opacity-70 transition-opacity">
              <img src={item.thumbnail_url} className="w-full h-full object-cover grayscale mix-blend-overlay" alt="" />
            </div>
          )}
        </div>
        <div className="p-4 flex flex-col flex-1 bg-surface">
          <h3 className="text-sm font-bold text-text-primary line-clamp-2 leading-snug flex-1 mb-4">{item.topic || item.selected_title || item.title_candidates?.[0] || 'Untitled Project'}</h3>
          <div className="flex items-center justify-between mt-auto">
            <span className="text-[10px] text-text-muted font-medium">Last modified {format(new Date(item.created_at || new Date()), 'MMM d')}</span>
            <span className={`text-xs font-bold ${statusColor} group-hover:underline`}>
              {type === 'review' ? 'Review' : type === 'failed' ? 'Fix Error' : 'Resume'}
            </span>
          </div>
        </div>
      </button>

      {/* Archive Menu */}
      {onArchive && (
        <button
          onClick={onArchive}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-surface/80 text-text-muted hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all z-20 shadow-sm"
          title="Archive project"
        >
          <Icon name="archive" size={14} />
        </button>
      )}
    </div>
  );
}
