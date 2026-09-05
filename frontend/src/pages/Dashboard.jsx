import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import Icon from '../components/Icon';

export default function Dashboard() {
  const [stats, setStats] = useState({
    ideas: 0, pendingIdeas: 0,
    scripts: 0, approvedScripts: 0,
    rendering: 0, ready: 0, uploaded: 0,
  });
  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [ideas, scripts, videos, prof, dashAnalytics] = await Promise.all([
          api.getIdeas(), api.getScripts(), api.getVideos(), api.getProfile(), api.getDashboardAnalytics(),
        ]);
        const pendingIdeas   = ideas.filter(i => i.status === 'pending').length;
        const approvedScripts = scripts.filter(s => s.status === 'approved' || s.status === 'pending').length;
        const rendering = videos.filter(v => v.status === 'rendering').length;
        const ready     = videos.filter(v => ['ready', 'approved'].includes(v.status)).length;
        const uploaded  = videos.filter(v => v.status === 'uploaded').length;
        setStats({
          ideas: ideas.length, pendingIdeas,
          scripts: scripts.length, approvedScripts,
          rendering, ready, uploaded,
        });
        setProfile(prof);
        setAnalytics(dashAnalytics);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const totalReview = stats.pendingIdeas + stats.approvedScripts + stats.ready;

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1>{profile ? `Welcome, ${profile.display_name}` : 'Dashboard'}</h1>
          <p>Your content production pipeline at a glance.</p>
        </div>
        <Link to="/app/create" className="btn btn-primary"><Icon name="plus" size={14} /> Create Short</Link>
      </div>

      {/* ── Production Pipeline ────────────────────────────────────────── */}
      <div className="pipeline-container">
        <h3 className="card-title mb-4">Production Pipeline</h3>
        <div className="pipeline-rail">

          <div className="pipeline-step">
            <div className="pipeline-node bg-surface-3">
              <span className="pipeline-count mono c-text-1">{stats.ideas}</span>
            </div>
            <div className="pipeline-label">Ideas</div>
          </div>

          <div className="pipeline-line"></div>

          <div className="pipeline-step">
            <div className="pipeline-node bg-surface-3">
              <span className="pipeline-count mono c-info">{stats.scripts}</span>
            </div>
            <div className="pipeline-label">Scripts</div>
          </div>

          <div className="pipeline-line"></div>

          <div className="pipeline-step">
            <div className={`pipeline-node ${stats.rendering > 0 ? 'node-rendering' : 'bg-surface-3'}`}>
              <span className="pipeline-count mono c-warning">{stats.rendering}</span>
            </div>
            <div className="pipeline-label">Rendering</div>
          </div>

          <div className="pipeline-line"></div>

          <div className="pipeline-step">
            <div className="pipeline-node bg-surface-3">
              <span className="pipeline-count mono c-success">{stats.ready}</span>
            </div>
            <div className="pipeline-label">Ready</div>
          </div>

          <div className="pipeline-line"></div>

          <div className="pipeline-step">
            <div className="pipeline-node bg-surface-3">
              <span className="pipeline-count mono c-text-1">{stats.uploaded}</span>
            </div>
            <div className="pipeline-label">Uploaded</div>
          </div>

        </div>
      </div>

      {/* ── Dashboard Widgets Grid ─────────────────────────────────────── */}
      <div className="grid-2 mt-4">

        {/* ── Unified Action Queue ──────────────────────────────────────── */}
        <div className="card" style={{ padding: '20px' }}>
          <div className="card-header mb-3">
            <h3 className="card-title flex items-center gap-2">
              <Icon name="clock" size={16} className="c-accent" /> Needs Your Review
            </h3>
            {totalReview > 0 && (
              <span className="badge badge-pending">{totalReview} items</span>
            )}
          </div>
          <div className="flex-col gap-2">
            <Link to="/app/ideas" className="nav-item" style={{ background: 'var(--surface-3)', border: '1px solid var(--border-1)', padding: '12px 16px', borderRadius: 'var(--r-sm)' }}>
              <div className="flex justify-between items-center w-full">
                <span className="flex items-center gap-2"><Icon name="layers" size={16} className="text-muted" /> Ideas Pending Approval</span>
                <span className={`badge ${stats.pendingIdeas > 0 ? 'badge-pending' : 'badge-approved'}`}>
                  {stats.pendingIdeas} {stats.pendingIdeas === 1 ? 'Idea' : 'Ideas'}
                </span>
              </div>
            </Link>
            <Link to="/app/scripts" className="nav-item" style={{ background: 'var(--surface-3)', border: '1px solid var(--border-1)', padding: '12px 16px', borderRadius: 'var(--r-sm)' }}>
              <div className="flex justify-between items-center w-full">
                <span className="flex items-center gap-2"><Icon name="fileText" size={16} className="text-muted" /> Scripts Ready to Generate</span>
                <span className={`badge ${stats.approvedScripts > 0 ? 'badge-scripted' : 'badge-approved'}`}>
                  {stats.approvedScripts} {stats.approvedScripts === 1 ? 'Script' : 'Scripts'}
                </span>
              </div>
            </Link>
            <Link to="/app/videos" className="nav-item" style={{ background: 'var(--surface-3)', border: '1px solid var(--border-1)', padding: '12px 16px', borderRadius: 'var(--r-sm)' }}>
              <div className="flex justify-between items-center w-full">
                <span className="flex items-center gap-2"><Icon name="video" size={16} className="text-muted" /> Videos Ready for Upload</span>
                <span className={`badge ${stats.ready > 0 ? 'badge-ready' : 'badge-approved'}`}>
                  {stats.ready} {stats.ready === 1 ? 'Video' : 'Videos'}
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* ── System & Providers Column ─────────────────────────────────── */}
        <div className="flex-col gap-3">
          {/* Provider Status Strip */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="card-header mb-3">
              <h3 className="card-title flex items-center gap-2"><Icon name="server" size={16} className="c-blue" /> Active Providers</h3>
              <Link to="/app/health" className="btn btn-sm btn-secondary" style={{ fontSize: '11px', padding: '3px 10px' }}>Details</Link>
            </div>
            <div className="flex-col gap-2">
              <div className="flex justify-between items-center" style={{ fontSize: '13px', background: 'var(--surface-3)', padding: '10px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-1)' }}>
                <div className="flex items-center gap-2"><span className="dot"></span> Ollama (LLM Primary)</div>
                <span className="text-xs text-muted">Local — Unlimited</span>
              </div>
              <div className="flex justify-between items-center" style={{ fontSize: '13px', background: 'var(--surface-3)', padding: '10px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-1)' }}>
                <div className="flex items-center gap-2"><span className="dot"></span> Edge-TTS</div>
                <span className="text-xs text-muted">Unlimited</span>
              </div>
              <div className="flex justify-between items-center" style={{ fontSize: '13px', background: 'var(--surface-3)', padding: '10px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-1)' }}>
                <div className="flex items-center gap-2"><span className="dot"></span> Pexels (Footage)</div>
                <span className="text-xs text-muted">Free Tier</span>
              </div>
            </div>
          </div>

          {/* Storage / Disk Widget */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="card-header mb-3">
              <h3 className="card-title flex items-center gap-2"><Icon name="hardDrive" size={16} className="c-warning" /> Storage Usage</h3>
              <Link to="/app/analytics" className="btn btn-sm btn-secondary" style={{ fontSize: '11px', padding: '3px 10px' }}>View Telemetry</Link>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontSize: '13px', color: 'var(--text-1)' }}>Temp & Renders</span>
              <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>
                {analytics?.storage?.total_mb || 0} MB
              </span>
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{
                  background: 'var(--warning)',
                  width: `${Math.min(100, ((analytics?.storage?.total_mb || 0) / (analytics?.storage?.limit_mb || 50000)) * 100)}%`
                }}
              />
            </div>
            <p className="text-xs text-muted mt-2">
              Output: {analytics?.storage?.output_mb || 0} MB | Temp: {analytics?.storage?.temp_mb || 0} MB
            </p>
          </div>
        </div>

        {/* ── Path to Monetization (YPP) ────────────────────────────────── */}
        <div className="card" style={{ padding: '20px', gridColumn: '1 / -1' }}>
          <div className="card-header mb-4">
            <h3 className="card-title flex items-center gap-2"><Icon name="youtube" size={16} className="c-accent" /> Path to Monetization (YPP)</h3>
            <span className="text-xs text-muted">Goal: Feb 2027</span>
          </div>
          <div className="grid-2 gap-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-bold">Subscribers</span>
                <span className="text-muted mono">{analytics?.subscribers || 0} / {analytics?.ypp_sub_goal ? analytics.ypp_sub_goal.toLocaleString() : '1,000'}</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${Math.min(100, ((analytics?.subscribers || 0) / (analytics?.ypp_sub_goal || 1000)) * 100)}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-bold">Shorts Views (90 Days)</span>
                <span className="text-muted mono">{analytics?.shorts_views_90d || 0} / {analytics?.ypp_view_goal ? (analytics.ypp_view_goal / 1000000) + 'M' : '10M'}</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${Math.min(100, ((analytics?.shorts_views_90d || 0) / (analytics?.ypp_view_goal || 10000000)) * 100)}%` }}></div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted mt-3">YPP progress will auto-populate once YouTube Analytics data flows in.</p>
        </div>

      </div>
    </div>
  );
}
