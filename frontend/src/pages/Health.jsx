import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';
import GridContainer from '../components/layout/GridContainer';
import PageHeader from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Skeleton from '../components/Skeleton';

const TYPE_GROUPS = ['LLM', 'TTS', 'Stock Footage', 'Upload'];

export default function Health() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await api.getSystemHealth();
        if (isMounted) setProviders(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <GridContainer>
        <div className="space-y-6">
          <Skeleton height="60px" rounded="rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton height="160px" rounded="rounded-xl" />
            <Skeleton height="160px" rounded="rounded-xl" />
            <Skeleton height="160px" rounded="rounded-xl" />
          </div>
        </div>
      </GridContainer>
    );
  }

  const onlineCount = providers.filter(p => p.status === 'online').length;

  return (
    <GridContainer>
      <div className="space-y-8">
        <PageHeader
          title="System Health"
          description="Real-time operational status, quotas, and cluster priorities of AI models and media pipelines."
          badge={
            <span className="text-xs font-mono font-semibold text-success bg-success/10 border border-success/30 px-2.5 py-1 rounded">
              {onlineCount}/{providers.length} Clusters Online
            </span>
          }
        />

        {TYPE_GROUPS.map(group => {
          const groupProviders = providers
            .filter(p => p.type === group)
            .sort((a, b) => a.priority - b.priority);

          if (groupProviders.length === 0) return null;
          
          const groupIcons = {
            'LLM': { icon: 'sparkles', color: 'text-brand-red' },
            'TTS': { icon: 'mic', color: 'text-info' },
            'Stock Footage': { icon: 'video', color: 'text-success' },
            'Upload': { icon: 'upload', color: 'text-warning' }
          };
          const gIcon = groupIcons[group] || { icon: 'activity', color: 'text-brand-red' };

          return (
            <div key={group} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-text-primary uppercase tracking-wider">
                  <span className={gIcon.color}><Icon name={gIcon.icon} size={16} /></span>
                  <span>{group} Cluster</span>
                </h2>
                <span className="text-xs font-mono text-text-muted">
                  {groupProviders.filter(p => p.status === 'online').length}/{groupProviders.length} active
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupProviders.map(provider => (
                  <Card 
                    key={provider.name} 
                    variant="surface" 
                    className="flex flex-col justify-between overflow-hidden relative"
                  >
                    {provider.status === 'offline' && (
                      <div className="absolute top-0 left-0 bottom-0 w-1 bg-danger" />
                    )}
                    {provider.status === 'limited' && (
                      <div className="absolute top-0 left-0 bottom-0 w-1 bg-warning" />
                    )}

                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-bold text-sm text-text-primary tracking-tight">
                            {provider.name}
                          </h3>
                          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                            Priority {provider.priority} • {provider.tier} Tier
                          </span>
                        </div>
                        <StatusBadge status={provider.status} size="sm" />
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-border/70 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-text-muted">Model ID</span>
                          <span className="font-mono font-semibold text-text-primary bg-elevated px-2 py-0.5 rounded text-[11px] border border-border">
                            {provider.model}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-text-muted">Quota Quorum</span>
                          <span className="font-semibold text-text-secondary">
                            {provider.quota}
                          </span>
                        </div>
                      </div>
                    </div>

                    {provider.note && (
                      <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] text-text-secondary leading-relaxed font-sans">
                        {provider.note}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </GridContainer>
  );
}
