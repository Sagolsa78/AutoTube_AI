import { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import { api } from '../services/api';

const SEVERITY_ICON = {
  error:   { name: 'x',        className: 'c-accent' },
  warning: { name: 'alertTriangle', className: 'c-amber' },
  success: { name: 'check',    className: 'c-green' },
  info:    { name: 'activity',  className: 'c-blue' },
};

const FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'error',   label: 'Errors' },
  { key: 'warning', label: 'Warnings' },
];

export default function Logs() {
  const [filter, setFilter] = useState('all');
  const [logs, setLogs] = useState([]);
  
  useEffect(() => {
    (async () => {
      try {
        const res = await api.getSystemLogs(100);
        // Map raw text lines to a semi-structured format
        const structuredLogs = res.logs.reverse().map((line, i) => {
          let severity = 'info';
          if (line.includes('ERROR') || line.includes('Failed')) severity = 'error';
          if (line.includes('WARN')) severity = 'warning';
          
          return {
            id: i,
            severity,
            source: 'System',
            message: line,
            ts: 'now'
          };
        });
        setLogs(structuredLogs);
      } catch (e) {
        console.error("Failed to fetch logs", e);
      }
    })();
  }, []);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.severity === filter);

  const errorCount   = logs.filter(l => l.severity === 'error').length;
  const warningCount = logs.filter(l => l.severity === 'warning').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Activity & Logs</h1>
          <p>Real-time feed of pipeline events, provider fallbacks, and rendering errors.</p>
        </div>
        <div className="flex gap-2 items-center">
          {errorCount > 0 && <span className="badge badge-failed">{errorCount} errors</span>}
          {warningCount > 0 && <span className="badge badge-pending">{warningCount} warnings</span>}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-1 mb-3">
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Event Feed */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">System Event Feed</span>
          <span className="status-badge status-online">
            <span className="dot" style={{ width: '6px', height: '6px' }}></span> Live
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 20px' }}>
            <Icon name="check" size={36} />
            <p>No events match this filter.</p>
          </div>
        ) : (
          <ul className="activity-feed">
            {filtered.map(log => {
              const icon = SEVERITY_ICON[log.severity];
              return (
                <li key={log.id} className={`activity-item severity-${log.severity}`}>
                  <div style={{ paddingTop: '2px' }}>
                    <Icon name={icon.name} size={15} className={icon.className} />
                  </div>
                  <div className="activity-source">{log.source}</div>
                  <div className="activity-message">{log.message}</div>
                  <div className="activity-time">{log.ts}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted mt-3" style={{ textAlign: 'center' }}>
        Live system logs. Showing the last 100 events from the backend.
      </p>
    </div>
  );
}
