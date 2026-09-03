import { useState } from 'react';
import Icon from '../components/Icon';

/*
 * Mock data — will be replaced by a real /api/logs or WebSocket feed
 * once the backend emits structured log events.
 */
const MOCK_LOGS = [
  { id: 1, severity: 'error',   source: 'SRT Generator',   message: 'SRT file had 0 cues — render aborted. Check audio alignment.',                           ts: '2 min ago' },
  { id: 2, severity: 'warning', source: 'LLM Fallback',    message: 'Gemini returned 429 (rate limited). Falling back to Groq.',                                ts: '8 min ago' },
  { id: 3, severity: 'error',   source: 'Clip Download',   message: 'Pexels clip timed out after 30s. Retrying (2/3)…',                                          ts: '12 min ago' },
  { id: 4, severity: 'success', source: 'Render Engine',   message: 'Video "AI in 1950s" rendered successfully — 00:58 duration, captions OK.',                   ts: '25 min ago' },
  { id: 5, severity: 'warning', source: 'Storage',         message: '/storage/audio contains 847MB of temp files. Consider cleanup.',                              ts: '1 hour ago' },
  { id: 6, severity: 'info',    source: 'YouTube Upload',  message: 'Video "Quantum Computing Basics" published. ID: dQw4w9WgXcQ',                               ts: '2 hours ago' },
  { id: 7, severity: 'success', source: 'Script Gen',      message: 'Script generated for "History of the Internet" using Ollama (llama3.2).',                   ts: '3 hours ago' },
  { id: 8, severity: 'info',    source: 'Edge-TTS',        message: 'Audio generated: 42.3s, voice en-US-ChristopherNeural.',                                     ts: '3 hours ago' },
  { id: 9, severity: 'error',   source: 'LLM Fallback',   message: 'Ollama unreachable at localhost:11434 — skipping to Gemini.',                                ts: '5 hours ago' },
  { id:10, severity: 'warning', source: 'Render Engine',   message: 'FFmpeg encode slower than expected: 0.4x realtime. Check CPU load.',                        ts: '6 hours ago' },
];

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
  { key: 'success', label: 'Success' },
  { key: 'info',    label: 'Info' },
];

export default function Logs() {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? MOCK_LOGS : MOCK_LOGS.filter(l => l.severity === filter);

  const errorCount   = MOCK_LOGS.filter(l => l.severity === 'error').length;
  const warningCount = MOCK_LOGS.filter(l => l.severity === 'warning').length;

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
        Events are currently simulated. Wire a <code className="mono" style={{ color: 'var(--accent-strong)' }}>/api/logs</code> endpoint to surface real pipeline output.
      </p>
    </div>
  );
}
