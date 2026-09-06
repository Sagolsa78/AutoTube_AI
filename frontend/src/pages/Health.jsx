import { useState, useEffect } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';
import Badge from '../components/Badge';

const STATUS_CLASS = {
  online:  'status-online',
  offline: 'status-offline',
  limited: 'status-limited',
};

const TYPE_GROUPS = ['LLM', 'TTS', 'Stock Footage', 'Upload'];

export default function Health() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getSystemHealth();
        setProviders(data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>System & Provider Health</h1>
          <p>Monitor your AI providers, stock footage APIs, and upload services. Fallback order follows your <code className="mono" style={{ color: 'var(--accent-strong)', fontSize: '12px' }}>SCRIPT_PROVIDER_ORDER</code> env variable.</p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><span className="spinner spinner-lg" /></div>
      ) : TYPE_GROUPS.map(group => {
        const groupProviders = providers.filter(p => p.type === group).sort((a, b) => a.priority - b.priority);
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
                    <Badge variant="default" className={`status-badge ${STATUS_CLASS[provider.status]}`}>
                      <span className="dot" style={{
                        width: '6px', height: '6px', display: 'inline-block',
                        borderRadius: '50%', boxShadow: 'none', animation: 'none',
                        background: provider.status === 'online' ? 'var(--success)' :
                                    provider.status === 'offline' ? 'var(--error)' : 'var(--warning)'
                      }}></span>
                      {provider.status}
                    </Badge>
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
        Provider status fetched live from <code className="mono" style={{ color: 'var(--accent-strong)' }}>/api/system/health</code>.
      </p>
    </div>
  );
}
