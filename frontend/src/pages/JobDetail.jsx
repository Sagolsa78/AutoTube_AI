import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import GridContainer from '../components/layout/GridContainer';
import PageHeader from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Icon from '../components/Icon';
import Button from '../components/Button';
import { useJobPolling } from '../hooks/useJobPolling';

export default function JobDetail() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  const { status, progress, stage, rawProg } = useJobPolling(id, true, {
    intervalMs: 2000
  });

  useEffect(() => {
    let mounted = true;
    api.getVideo(id).then(v => {
      if (mounted) {
        setVideo(v);
        setLoading(false);
      }
    }).catch(e => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div className="p-10 text-center">Loading Job Data...</div>;
  if (!video) return <div className="p-10 text-center">Video not found.</div>;

  const progData = rawProg || video;

  return (
    <GridContainer>
      <PageHeader 
        title={`Render Job Details`}
        description={`Tracking pipeline execution for ${video.title || video.id}`}
        actions={
          <Link to="/app/videos">
            <Button variant="secondary" icon="arrow-left">Back to Videos</Button>
          </Link>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-6">
          <Card variant="surface">
            <CardHeader title={<CardTitle>Pipeline Execution</CardTitle>} />
            <CardContent className="space-y-6">
              <div className="flex justify-between text-sm">
                <span>Status: <StatusBadge status={status} /></span>
                <span>Stage: <strong className="uppercase">{stage || 'Unknown'}</strong></span>
                <span>Progress: <strong className="text-warning">{Math.round(progress)}%</strong></span>
              </div>
              
              <div className="bg-canvas rounded-full h-2 overflow-hidden w-full">
                <div 
                  className="bg-warning h-full transition-all duration-500" 
                  style={{ width: `${Math.max(5, Math.min(100, progress))}%` }} 
                />
              </div>

              {status === 'failed' && (
                <div className="p-4 bg-brand-red/10 border border-brand-red/20 rounded-xl">
                  <h4 className="text-brand-red font-bold flex items-center gap-2">
                    <Icon name="alert-triangle" size={16} /> Error Details
                  </h4>
                  <p className="font-mono text-sm mt-2 text-text-secondary whitespace-pre-wrap">
                    {progData.notes || 'Unknown render failure.'}
                  </p>
                  <Button variant="primary" className="mt-4" onClick={() => {
                    api.updateVideo(id, { status: 'rendering', render_progress: 0, render_stage: 'init' })
                       .then(() => window.location.reload());
                  }}>
                    Retry Render
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card variant="surface">
            <CardHeader title={<CardTitle>Job Metadata</CardTitle>} />
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Video ID</span>
                <span className="font-mono">{id.substring(0,8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Started</span>
                <span>{new Date(video.created_at).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </GridContainer>
  );
}
