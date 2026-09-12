import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';
import GridContainer from '../components/layout/GridContainer';
import PageHeader from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import Metric from '../components/Metric';
import Button from '../components/Button';
import Skeleton from '../components/Skeleton';
import { toast } from 'sonner';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  const loadData = async () => {
    try {
      const res = await api.getDashboardAnalytics();
      setData(res);
    } catch (e) {
      toast.error(`Failed to load analytics: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const res = await api.analyticsCleanup();
      toast.success(`Storage cleanup complete! Freed ${res.freed_mb} MB.`);
      await loadData();
    } catch (err) {
      toast.error("Cleanup failed.");
      console.error(err);
    } finally {
      setCleaning(false);
    }
  };

  if (loading) {
    return (
      <GridContainer>
        <div className="space-y-6">
          <Skeleton height="60px" rounded="rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton height="110px" rounded="rounded-xl" />
            <Skeleton height="110px" rounded="rounded-xl" />
            <Skeleton height="110px" rounded="rounded-xl" />
            <Skeleton height="110px" rounded="rounded-xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <Skeleton height="240px" rounded="rounded-xl" />
            </div>
            <div className="lg:col-span-4">
              <Skeleton height="240px" rounded="rounded-xl" />
            </div>
          </div>
        </div>
      </GridContainer>
    );
  }

  const storageTotal = data?.storage?.total_mb || 0;
  const storageLimit = data?.storage?.limit_mb || 50000;
  const storagePct = Math.min(100, Math.round((storageTotal / storageLimit) * 100));

  const currentSubs = data?.monetization?.current_subs ?? data?.performance?.total_subs ?? 0;
  const subsTarget = data?.monetization?.subs_target || 1000;
  const subsPct = Math.min(100, Math.round((currentSubs / subsTarget) * 100));

  const currentViews = data?.monetization?.current_views ?? data?.performance?.total_views ?? 0;
  const viewsTarget = data?.monetization?.views_target || 10000000;
  const viewsPct = Math.min(100, Math.round((currentViews / viewsTarget) * 100));

  const maxVelocity = data?.view_velocity_7d ? Math.max(...data.view_velocity_7d.map(v => v.views), 1) : 1;

  return (
    <GridContainer>
      <div className="space-y-6">
        <PageHeader
          title="Channel Telemetry"
          description="YouTube Partner Program (YPP) qualification progress, view velocity, and engine storage telemetry."
          actions={
            <Button
              variant="secondary"
              size="sm"
              icon={cleaning ? 'loader' : 'trash'}
              onClick={handleCleanup}
              disabled={cleaning}
              loading={cleaning}
            >
              Clean Temp Assets
            </Button>
          }
        />

        {/* ── YouTube Live Connection Status ──────────────────────────────────── */}
        {data?.youtube_connected ? (
          <div className="p-3.5 bg-success/10 border border-success/30 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-success font-semibold">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span>YouTube Channel Connected: <span className="font-bold text-text-primary">{data.youtube_channel_title || 'Active Channel'}</span></span>
            </div>
            <span className="text-[11px] font-mono text-text-muted">Live YouTube Data API v3 Active</span>
          </div>
        ) : (
          <div className="p-3.5 bg-warning/10 border border-warning/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-warning font-medium">
              <Icon name="alert-triangle" size={16} className="shrink-0" />
              <span>YouTube Channel is not connected. Telemetry currently reflects local project database metrics.</span>
            </div>
            <a
              href="/app/channels"
              className="btn btn-secondary btn-sm shrink-0 self-start sm:self-auto text-text-primary"
            >
              Connect YouTube Channel
            </a>
          </div>
        )}

        {/* ── Key Metrics 4-Col Grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Metric
            label="90-Day Views"
            value={currentViews}
            icon="youtube"
            iconColor="text-brand-red"
            subtitle={`${viewsPct}% of 10M YPP Goal`}
          />
          <Metric
            label="Subscribers"
            value={currentSubs}
            icon="hash"
            iconColor="text-success"
            subtitle={`${subsPct}% of 1,000 YPP Goal`}
          />
          <Metric
            label="Estimated Likes"
            value={data?.performance?.total_likes || 0}
            icon="heart"
            iconColor="text-danger"
            subtitle="Viewer engagement"
          />
          <Metric
            label="Engine Storage"
            value={storageTotal}
            unit="MB"
            icon="hardDrive"
            iconColor="text-warning"
            subtitle={`${storagePct}% of ${Math.round(storageLimit / 1000)}GB`}
          />
        </div>

        {/* ── Mid Row: YPP Goal Progress & Storage Breakdown ────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* YPP Monetization Tracker (8 cols) */}
          <div className="lg:col-span-8 flex">
            <Card variant="surface" className="flex-1 flex flex-col justify-between">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="sparkles" size={16} className="text-brand-red" />}>
                    Path to Monetization (YPP Target)
                  </CardTitle>
                }
                action={
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-success/10 text-success border border-success/30 px-2 py-0.5 rounded">
                    Active Tracking
                  </span>
                }
              />
              <CardContent className="space-y-6">
                {/* Subscribers Goal */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-bold text-text-primary">Subscribers Target</span>
                    <span className="font-mono text-text-secondary">
                      <strong className="text-text-primary font-bold">{currentSubs.toLocaleString()}</strong> / {subsTarget.toLocaleString()} ({subsPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-elevated rounded-full h-3 overflow-hidden border border-border/60">
                    <div 
                      className="bg-brand-red h-full rounded-full transition-all duration-700"
                      style={{ width: `${subsPct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-text-muted text-right">
                    {Math.max(0, subsTarget - currentSubs).toLocaleString()} subscribers remaining
                  </p>
                </div>

                {/* 90-Day Views Goal */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-bold text-text-primary">Shorts 90-Day Views Target</span>
                    <span className="font-mono text-text-secondary">
                      <strong className="text-text-primary font-bold">{currentViews.toLocaleString()}</strong> / 10,000,000 ({viewsPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-elevated rounded-full h-3 overflow-hidden border border-border/60">
                    <div 
                      className="bg-info h-full rounded-full transition-all duration-700"
                      style={{ width: `${viewsPct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-text-muted text-right">
                    {Math.max(0, viewsTarget - currentViews).toLocaleString()} views remaining for monetization
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Storage Telemetry (4 cols) */}
          <div className="lg:col-span-4 flex">
            <Card variant="surface" className="flex-1 flex flex-col justify-between">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="hardDrive" size={16} className="text-warning" />}>
                    Storage Telemetry
                  </CardTitle>
                }
              />
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Final Output Renders</span>
                    <span className="font-mono font-bold text-text-primary">{data?.storage?.output_mb || 0} MB</span>
                  </div>
                  <div className="w-full bg-elevated rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-brand-red h-full rounded-full"
                      style={{ width: `${Math.min(100, (((data?.storage?.output_mb || 0) / storageLimit) * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Temporary Engine Media</span>
                    <span className="font-mono font-bold text-text-primary">{data?.storage?.temp_mb || 0} MB</span>
                  </div>
                  <div className="w-full bg-elevated rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-warning h-full rounded-full"
                      style={{ width: `${Math.min(100, (((data?.storage?.temp_mb || 0) / storageLimit) * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-border/80 flex items-center justify-between text-xs">
                  <span className="text-text-muted">Total Disk Utilization</span>
                  <span className="font-mono font-bold text-text-primary">{storagePct}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>

        {/* ── Bottom Row: Velocity & Niche Distribution ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 7-Day View Velocity Bar Chart (6 cols) */}
          <div className="lg:col-span-6">
            <Card variant="surface" className="h-full">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="activity" size={16} className="text-info" />}>
                    View Velocity (Last 7 Days)
                  </CardTitle>
                }
              />
              <CardContent>
                <div className="flex items-end justify-between h-44 pt-4 gap-2">
                  {(data?.view_velocity_7d || []).map((v, i) => {
                    const heightPct = Math.round((v.views / maxVelocity) * 100);
                    return (
                      <div key={i} className="flex flex-col items-center flex-1 h-full gap-2 group relative">
                        <span className="absolute -top-7 bg-elevated border border-border text-[10px] font-mono font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md z-10">
                          {v.views.toLocaleString()}
                        </span>
                        <div className="flex-1 w-full flex items-end justify-center">
                          <div 
                            className="w-4/5 sm:w-1/2 bg-brand-red/80 group-hover:bg-brand-red rounded-t-sm transition-all duration-300 min-h-[4px]"
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-text-muted uppercase">
                          {v.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Niche Breakdown (6 cols) */}
          <div className="lg:col-span-6">
            <Card variant="surface" className="h-full flex flex-col justify-between">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="layers" size={16} className="text-brand-red" />}>
                    Niche Content Distribution
                  </CardTitle>
                }
              />
              <CardContent className="space-y-4">
                {(data?.niche_breakdown || []).length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-6">
                    No niche distribution data recorded yet.
                  </p>
                ) : (
                  (data.niche_breakdown || []).map((nb, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-text-primary capitalize">{nb.niche}</span>
                        <span className="font-mono text-text-secondary">{nb.count} ideas</span>
                      </div>
                      <div className="w-full bg-elevated rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-brand-red h-full rounded-full"
                          style={{ width: `${Math.min(100, (nb.count / (data?.total_ideas || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

        </div>

      </div>
    </GridContainer>
  );
}
