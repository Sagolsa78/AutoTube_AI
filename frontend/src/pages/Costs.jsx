import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import PageHeader from '../components/layout/PageHeader';
import GridContainer from '../components/layout/GridContainer';
import { Card } from '../components/Card';
import Icon from '../components/Icon';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { useChannel } from '../contexts/ChannelContext';

export default function Costs() {
  const { channels } = useChannel();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchCosts = async () => {
      setLoading(true);
      try {
        const data = await api.getCostSummary();
        if (mounted) setSummary(data);
      } catch (err) {
        console.error("Failed to fetch costs:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchCosts();
    return () => { mounted = false; };
  }, []);

  const getChannelName = (id) => {
    if (!id || id === 'unassigned') return 'Unassigned';
    const c = channels.find(ch => ch.id === id);
    return c ? c.name : 'Unknown Channel';
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <PageHeader title="Cost Analytics" description="Loading metrics..." />
        <GridContainer columns={3}>
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </GridContainer>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-4 md:p-8 h-full flex items-center justify-center">
        <EmptyState icon="dollarSign" title="Failed to load costs" message="Could not fetch analytics data from the server." />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <PageHeader
        title="Cost Analytics"
        description="Track your platform API usage and infrastructure costs."
        icon="dollarSign"
      />

      <GridContainer columns={2}>
        <Card className="bg-gradient-to-br from-surface to-elevated border-brand-red/20 shadow-brand-glow">
          <div className="p-6">
            <div className="flex items-center gap-3 text-text-muted mb-2">
              <Icon name="calendar" size={18} className="text-brand-red" />
              <span className="text-sm font-semibold uppercase tracking-wider">Total Monthly Spend</span>
            </div>
            <div className="text-4xl font-black text-text-primary mt-2">
              ${summary.monthly_spend.toFixed(2)}
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-surface to-elevated">
          <div className="p-6">
            <div className="flex items-center gap-3 text-text-muted mb-2">
              <Icon name="activity" size={18} className="text-blue-500" />
              <span className="text-sm font-semibold uppercase tracking-wider">Active Jobs</span>
            </div>
            <div className="text-4xl font-black text-text-primary mt-2">
              {summary.daily_history.length > 0 ? summary.daily_history[summary.daily_history.length - 1].jobs : 0}
              <span className="text-lg text-text-muted font-medium ml-2">today</span>
            </div>
          </div>
        </Card>
      </GridContainer>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend by Channel */}
        <Card title="Spend by Channel" className="flex flex-col h-full">
          <div className="p-6 flex-1">
            {summary.by_channel.length === 0 ? (
              <div className="text-center text-text-muted py-8 text-sm">No channel costs recorded yet.</div>
            ) : (
              <div className="space-y-4">
                {summary.by_channel.map(ch => (
                  <div key={ch.channel_id} className="flex items-center justify-between p-3 rounded-xl bg-elevated border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-red/10 flex items-center justify-center">
                        <Icon name="hash" size={14} className="text-brand-red" />
                      </div>
                      <span className="font-semibold text-sm">{getChannelName(ch.channel_id)}</span>
                    </div>
                    <span className="font-mono text-sm">${ch.amount.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Spend by Operation */}
        <Card title="Spend by Provider/Operation" className="flex flex-col h-full">
          <div className="p-6 flex-1">
            {summary.by_operation.length === 0 ? (
              <div className="text-center text-text-muted py-8 text-sm">No operation costs recorded yet.</div>
            ) : (
              <div className="space-y-4">
                {summary.by_operation.map(op => (
                  <div key={op.operation} className="flex items-center justify-between p-3 rounded-xl bg-elevated border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Icon name="cpu" size={14} className="text-blue-500" />
                      </div>
                      <span className="font-semibold text-sm capitalize">{op.operation.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="font-mono text-sm">${op.amount.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card title="Compute History (Last 7 Days)">
        <div className="p-6 overflow-x-auto">
          {summary.daily_history.length === 0 ? (
             <div className="text-center text-text-muted py-8 text-sm">No compute history available.</div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-border/50 text-text-muted uppercase text-xs tracking-wider">
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold text-right">Jobs Processed</th>
                  <th className="pb-3 font-semibold text-right">Compute Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {summary.daily_history.map(row => (
                  <tr key={row.date} className="hover:bg-elevated/50 transition-colors">
                    <td className="py-3 font-mono text-text-primary">{row.date}</td>
                    <td className="py-3 text-right">{row.jobs}</td>
                    <td className="py-3 text-right text-brand-red font-semibold">${row.amount.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
