import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import GridContainer from '../components/layout/GridContainer';
import PageHeader from '../components/layout/PageHeader';
import FilterBar from '../components/FilterBar';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import Skeleton from '../components/Skeleton';
import { api } from '../services/api';

const SEVERITY_ICON = {
  error:   { name: 'x',        className: 'text-danger' },
  warning: { name: 'alert-triangle', className: 'text-warning' },
  success: { name: 'check',    className: 'text-success' },
  info:    { name: 'activity', className: 'text-info' },
};

export default function Logs() {
  const [filter, setFilter] = useState('all');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await api.getSystemLogs(100);
        if (!isMounted) return;
        const structuredLogs = (res?.logs || []).reverse().map((line, i) => {
          let severity = 'info';
          if (line.includes('ERROR') || line.includes('Failed')) severity = 'error';
          if (line.includes('WARN')) severity = 'warning';
          
          return {
            id: i,
            severity,
            source: 'Pipeline',
            message: line,
            ts: new Date().toLocaleTimeString()
          };
        });
        setLogs(structuredLogs);
      } catch (e) {
        console.error("Failed to fetch logs", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.severity === filter);
  const errorCount = logs.filter(l => l.severity === 'error').length;
  const warningCount = logs.filter(l => l.severity === 'warning').length;

  const tabs = [
    { id: 'all', label: 'All Events', count: logs.length, icon: 'activity' },
    { id: 'error', label: 'Errors', count: errorCount, icon: 'x' },
    { id: 'warning', label: 'Warnings', count: warningCount, icon: 'alert-triangle' }
  ];

  if (loading) {
    return (
      <GridContainer>
        <div className="space-y-6">
          <Skeleton height="60px" rounded="rounded-xl" />
          <Skeleton height="500px" rounded="rounded-xl" />
        </div>
      </GridContainer>
    );
  }

  return (
    <GridContainer>
      <div className="space-y-6">
        <PageHeader
          title="Activity Logs"
          description="Real-time telemetry stream of background tasks, worker rendering events, and API services."
          badge={
            <div className="flex items-center gap-2">
              {errorCount > 0 && (
                <span className="text-xs font-mono font-bold text-danger bg-danger/10 border border-danger/30 px-2 py-0.5 rounded">
                  {errorCount} Errors
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-xs font-mono font-bold text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded">
                  {warningCount} Warnings
                </span>
              )}
            </div>
          }
        />

        {/* Filter Strip */}
        <FilterBar tabs={tabs} activeTab={filter} onChange={setFilter} />

        {/* Console Event Feed Surface */}
        <Card variant="surface" className="overflow-hidden p-0">
          <div className="bg-elevated/70 px-4 py-2.5 border-b border-border flex justify-between items-center text-xs">
            <span className="font-mono text-text-muted text-[11px] uppercase tracking-wider">
              Telemetry Event Stream
            </span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[11px] font-mono text-text-secondary">Worker Listening</span>
            </div>
          </div>

          <div className="bg-black/90 p-4 font-mono text-xs overflow-y-auto max-h-[600px] space-y-1.5 hide-scrollbar">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-text-muted space-y-2">
                <Icon name="check" size={28} className="mx-auto text-success opacity-50" />
                <p>No log records match this filter condition.</p>
              </div>
            ) : (
              filtered.map(log => {
                const icon = SEVERITY_ICON[log.severity] || SEVERITY_ICON.info;
                const rowClasses = {
                  error: 'bg-danger/10 text-danger border-danger/20',
                  warning: 'bg-warning/10 text-warning border-warning/20',
                  info: 'text-text-secondary hover:bg-surface/50 border-transparent',
                  success: 'text-success hover:bg-surface/50 border-transparent'
                };

                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-3 p-2 rounded-lg border transition-colors ${rowClasses[log.severity]}`}
                  >
                    <span className="text-text-muted text-[10px] w-16 shrink-0 font-mono mt-0.5 opacity-60">
                      {log.ts}
                    </span>
                    <Icon name={icon.name} size={14} className={`shrink-0 mt-0.5 ${icon.className}`} />
                    <span className="uppercase text-[10px] font-bold w-16 shrink-0 mt-0.5">
                      {log.severity}
                    </span>
                    <span className="text-text-primary break-all leading-relaxed flex-1">
                      {log.message}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <p className="text-xs font-mono text-text-muted text-center">
          Showing last 100 pipeline events from the active background worker queue.
        </p>
      </div>
    </GridContainer>
  );
}
