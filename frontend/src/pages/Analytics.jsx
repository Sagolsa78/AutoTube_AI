import { useState, useEffect } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';
import { toast } from 'sonner';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const res = await api.getDashboardAnalytics();
      setData(res);
    } catch (e) {
      toast.error(`Failed to load analytics: ${e.message}`);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCleanup = async () => {
    try {
      const res = await api.analyticsCleanup();
      toast.success(`Cleanup complete! Freed ${res.freed_mb} MB of space.`);
      loadData(); // Refresh UI to show 0 MB temp storage
    } catch (err) {
      toast.error("Cleanup failed.");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="empty-state" style={{ padding: '80px 20px' }}>
        <span className="spinner spinner-lg" />
        <p>Loading channel analytics & telemetry...</p>
      </div>
    );
  }

  const storagePct = data?.storage ? Math.min(100, Math.round((data.storage.total_mb / data.storage.limit_mb) * 100)) : 0;
  const maxVelocity = data?.view_velocity_7d ? Math.max(...data.view_velocity_7d.map(v => v.views)) : 1;

  return (
    <div className="analytics-page flex-col gap-4">
      <div className="page-header flex justify-between items-end">
        <div>
          <h1>Channel Insights & Telemetry</h1>
          <p>YouTube Partner Program (YPP) monetization tracking and engine storage metrics.</p>
        </div>
        <button className="btn btn-outline" onClick={handleCleanup}>
          <Icon name="trash" size={16} /> Cleanup Temp Assets
        </button>
      </div>

      {/* ── Key Metrics Banner ─────────────────────────────────────────────── */}
      <div className="grid-4 gap-3">
        <div className="card" style={{ padding: '16px' }}>
          <span className="text-xs text-muted">Total 90-Day Views</span>
          <div className="flex items-center justify-between mt-1">
            <span className="mono text-2xl font-bold c-accent">
              {data?.performance?.total_views?.toLocaleString() || 0}
            </span>
            <Icon name="youtube" size={20} className="c-accent" />
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <span className="text-xs text-muted">Subscribers</span>
          <div className="flex items-center justify-between mt-1">
            <span className="mono text-2xl font-bold c-success">
              {data?.performance?.total_subs?.toLocaleString() || 0}
            </span>
            <Icon name="hash" size={20} className="c-success" />
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <span className="text-xs text-muted">Est. Total Likes</span>
          <div className="flex items-center justify-between mt-1">
            <span className="mono text-2xl font-bold c-info">
              {data?.performance?.total_likes?.toLocaleString() || 0}
            </span>
            <Icon name="heart" size={20} className="c-info" />
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <span className="text-xs text-muted">Engine Storage Used</span>
          <div className="flex items-center justify-between mt-1">
            <span className="mono text-2xl font-bold c-warning">
              {data?.storage?.total_mb || 0} MB
            </span>
            <Icon name="hardDrive" size={20} className="c-warning" />
          </div>
        </div>
      </div>

      {/* ── YPP Monetization Tracker ───────────────────────────────────────── */}
      <div className="card" style={{ padding: '24px' }}>
        <div className="card-header mb-4">
          <h3 className="card-title flex items-center gap-2">
            <Icon name="sparkles" size={18} className="c-accent" /> Path to Monetization (YPP)
          </h3>
          <span className="badge badge-approved">Goal Status: In Progress</span>
        </div>

        <div className="grid-2 gap-6">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-bold">Subscribers Goal</span>
              <span className="mono text-muted">
                {data?.monetization?.current_subs || 0} / {data?.monetization?.subs_target?.toLocaleString() || '1k'}
              </span>
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${Math.min(100, ((data?.monetization?.current_subs || 0) / (data?.monetization?.subs_target || 1000)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted mt-2">
              {Math.max(0, (data?.monetization?.subs_target || 1000) - (data?.monetization?.current_subs || 0))} more subscribers needed to qualify.
            </p>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-bold">Shorts 90-Day Views Goal</span>
              <span className="mono text-muted">
                {data?.monetization?.current_views?.toLocaleString() || 0} / {(data?.monetization?.views_target || 10000000) / 1000000}M
              </span>
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.min(100, ((data?.monetization?.current_views || 0) / (data?.monetization?.views_target || 10000000)) * 100)}%`
                }}
              />
            </div>
            <p className="text-xs text-muted mt-2">
              {Math.max(0, (data?.monetization?.views_target || 10000000) - (data?.monetization?.current_views || 0)).toLocaleString()} views needed in 90 days.
            </p>
          </div>
        </div>
      </div>

      {/* ── View Velocity & Storage Telemetry ──────────────────────────────── */}
      <div className="grid-2 gap-4">
        {/* 7-Day View Velocity */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 className="card-title flex items-center gap-2 mb-4">
            <Icon name="activity" size={16} className="c-info" /> 7-Day View Velocity
          </h3>
          <div className="flex items-end justify-between gap-2" style={{ height: '140px', padding: '10px 0' }}>
            {data?.view_velocity_7d?.map((v, i) => {
              const heightPct = Math.round((v.views / maxVelocity) * 100);
              return (
                <div key={i} className="flex-col items-center flex-1 gap-2" style={{ height: '100%' }}>
                  <div className="flex-1 w-full flex items-end justify-center">
                    <div
                      style={{
                        height: `${heightPct}%`,
                        width: '80%',
                        background: 'linear-gradient(180deg, var(--accent), var(--accent-muted))',
                        borderRadius: 'var(--r-xs)'
                      }}
                      title={`${v.day}: ${v.views} views`}
                    />
                  </div>
                  <span className="text-xs text-muted mono">{v.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Storage Telemetry */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 className="card-title flex items-center gap-2 mb-4">
            <Icon name="hardDrive" size={16} className="c-warning" /> Disk Storage Telemetry
          </h3>
          <div className="flex-col gap-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Final Renders (`/output`)</span>
                <span className="mono font-bold">{data?.storage?.output_mb || 0} MB</span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(100, ((data?.storage?.output_mb || 0) / (data?.storage?.limit_mb || 50000)) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Temp Assets (`/audio`, `/visuals`)</span>
                <span className="mono font-bold">{data?.storage?.temp_mb || 0} MB</span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{
                    background: 'var(--warning)',
                    width: `${Math.min(100, ((data?.storage?.temp_mb || 0) / (data?.storage?.limit_mb || 50000)) * 100)}%`
                  }}
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-muted mt-2 pt-2 border-t" style={{ borderColor: 'var(--border-1)' }}>
              <span>Total Usage Threshold</span>
              <span className="mono font-bold">{storagePct}% of 50 GB</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content Performance by Niche ──────────────────────────────────── */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 className="card-title flex items-center gap-2 mb-3">
          <Icon name="layers" size={16} className="c-accent" /> Niche & Topic Distribution
        </h3>
        {data?.niche_breakdown?.length === 0 ? (
          <p className="text-xs text-muted">No topic data available yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Niche / Category</th>
                  <th>Ideas Generated</th>
                  <th>Distribution Share</th>
                </tr>
              </thead>
              <tbody>
                {data?.niche_breakdown?.map((nb, i) => (
                  <tr key={i}>
                    <td className="font-bold">{nb.niche}</td>
                    <td className="mono">{nb.count}</td>
                    <td>
                      <div className="progress-bar-track" style={{ width: '120px' }}>
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${Math.min(100, (nb.count / (data?.total_ideas || 1)) * 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
