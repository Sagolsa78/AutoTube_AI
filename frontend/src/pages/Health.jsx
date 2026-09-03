import { useState } from 'react';
import Icon from '../components/Icon';

/*
 * Provider configuration — mirrors backend/settings.py
 * Will be replaced by a /api/system/health endpoint that reports live status.
 */
const PROVIDERS = [
  {
    name: 'Ollama',
    type: 'LLM',
    status: 'online',
    model: 'llama3.2',
    endpoint: 'localhost:11434',
    tier: 'Local',
    quota: 'Unlimited',
    note: 'Primary script generation. Runs locally — no rate limits.',
    priority: 1,
  },
  {
    name: 'Google Gemini',
    type: 'LLM',
    status: 'online',
    model: 'gemini-2.0-flash',
    endpoint: 'generativelanguage.googleapis.com',
    tier: 'Free',
    quota: '15 RPM / 1M TPD',
    note: 'Fallback #1. Rate-limited on free tier.',
    priority: 2,
  },
  {
    name: 'Groq',
    type: 'LLM',
    status: 'online',
    model: 'llama-3.3-70b-versatile',
    endpoint: 'api.groq.com',
    tier: 'Free',
    quota: '30 RPM / 14.4K RPD',
    note: 'Fallback #2. Very fast inference but strict daily caps.',
    priority: 3,
  },
  {
    name: 'OpenRouter',
    type: 'LLM',
    status: 'limited',
    model: 'Various',
    endpoint: 'openrouter.ai',
    tier: 'Free',
    quota: 'Model-dependent',
    note: 'Fallback #3 (last resort). Pay-per-use above free credits.',
    priority: 4,
  },
  {
    name: 'Edge-TTS',
    type: 'TTS',
    status: 'online',
    model: 'en-US-ChristopherNeural',
    endpoint: 'Microsoft Edge (local)',
    tier: 'Free',
    quota: 'Unlimited',
    note: 'Text-to-speech. No API key required.',
    priority: 1,
  },
  {
    name: 'Pexels',
    type: 'Stock Footage',
    status: 'online',
    model: '—',
    endpoint: 'api.pexels.com',
    tier: 'Free',
    quota: '200 req/hr',
    note: 'Primary stock footage source for visual clips.',
    priority: 1,
  },
  {
    name: 'Pixabay',
    type: 'Stock Footage',
    status: 'offline',
    model: '—',
    endpoint: 'pixabay.com/api',
    tier: 'Free',
    quota: '5000/day',
    note: 'Backup footage source. API key not configured.',
    priority: 2,
  },
  {
    name: 'YouTube Data API',
    type: 'Upload',
    status: 'online',
    model: '—',
    endpoint: 'youtube.googleapis.com',
    tier: 'OAuth',
    quota: '10K units/day',
    note: 'Video upload + metadata. 1600 units per upload.',
    priority: 1,
  },
];

const STATUS_CLASS = {
  online:  'status-online',
  offline: 'status-offline',
  limited: 'status-limited',
};

const TYPE_GROUPS = ['LLM', 'TTS', 'Stock Footage', 'Upload'];

export default function Health() {
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>System & Provider Health</h1>
          <p>Monitor your AI providers, stock footage APIs, and upload services. Fallback order follows your <code className="mono" style={{ color: 'var(--accent-strong)', fontSize: '12px' }}>SCRIPT_PROVIDER_ORDER</code> env variable.</p>
        </div>
      </div>

      {TYPE_GROUPS.map(group => {
        const groupProviders = PROVIDERS.filter(p => p.type === group).sort((a, b) => a.priority - b.priority);
        if (groupProviders.length === 0) return null;

        return (
          <div key={group} className="mb-4">
            <h3 className="card-title mb-3 flex items-center gap-2">
              {group === 'LLM' && <Icon name="sparkles" size={16} className="c-accent" />}
              {group === 'TTS' && <Icon name="activity" size={16} className="c-blue" />}
              {group === 'Stock Footage' && <Icon name="video" size={16} className="c-green" />}
              {group === 'Upload' && <Icon name="upload" size={16} className="c-amber" />}
              {group}
              <span className="text-xs text-muted" style={{ fontWeight: 400 }}>
                — {groupProviders.filter(p => p.status === 'online').length}/{groupProviders.length} online
              </span>
            </h3>
            <div className="provider-grid">
              {groupProviders.map(provider => (
                <div
                  key={provider.name}
                  className="provider-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpanded(expanded === provider.name ? null : provider.name)}
                >
                  <div className="provider-card-header">
                    <div>
                      <div className="provider-name">{provider.name}</div>
                      <div className="provider-type">Priority #{provider.priority} · {provider.tier}</div>
                    </div>
                    <span className={`status-badge ${STATUS_CLASS[provider.status]}`}>
                      <span className="dot" style={{
                        width: '6px', height: '6px', display: 'inline-block',
                        borderRadius: '50%', boxShadow: 'none', animation: 'none',
                        background: provider.status === 'online' ? 'var(--success)' :
                                    provider.status === 'offline' ? 'var(--error)' : 'var(--warning)'
                      }}></span>
                      {provider.status}
                    </span>
                  </div>

                  <div className="provider-stat">
                    <span>Model</span>
                    <span className="provider-stat-value">{provider.model}</span>
                  </div>
                  <div className="provider-stat">
                    <span>Quota</span>
                    <span className="provider-stat-value">{provider.quota}</span>
                  </div>
                  <div className="provider-stat">
                    <span>Endpoint</span>
                    <span className="provider-stat-value" style={{ fontSize: '11px' }}>{provider.endpoint}</span>
                  </div>

                  {expanded === provider.name && (
                    <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--surface-3)', borderRadius: 'var(--r-sm)', fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.6' }}>
                      {provider.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <p className="text-xs text-muted mt-4" style={{ textAlign: 'center' }}>
        Provider status is currently static. Wire a <code className="mono" style={{ color: 'var(--accent-strong)' }}>/api/system/health</code> endpoint to report live connectivity and quota usage.
      </p>
    </div>
  );
}
