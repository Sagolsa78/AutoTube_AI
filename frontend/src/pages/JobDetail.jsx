import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import GridContainer from '../components/layout/GridContainer';
import PageHeader from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Icon from '../components/Icon';
import Button from '../components/Button';
import Skeleton from '../components/Skeleton';
import PipelineVisualizer from '../components/pipeline/PipelineVisualizer';
import { useJobPolling } from '../hooks/useJobPolling';
import { toast } from 'sonner';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [script, setScript] = useState(null);
  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);

  const { status, progress, stage, rawProg } = useJobPolling(id, true, {
    intervalMs: 2000
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const v = await api.getVideo(id);
        if (!mounted) return;
        setVideo(v);

        if (v.script_id) {
          const s = await api.getScript(v.script_id).catch(() => null);
          if (mounted && s) {
            setScript(s);
            if (s.idea_id) {
              const allIdeas = await api.getIdeas().catch(() => []);
              const matchingIdea = (allIdeas || []).find(i => i.id === s.idea_id);
              if (mounted && matchingIdea) setIdea(matchingIdea);
            }
          }
        }
      } catch (e) {
        console.error('Error loading job details:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (loading) {
    return (
      <GridContainer>
        <div className="space-y-6">
          <Skeleton height="60px" rounded="rounded-xl" />
          <Skeleton height="100px" rounded="rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Skeleton height="320px" rounded="rounded-xl" />
            </div>
            <div>
              <Skeleton height="320px" rounded="rounded-xl" />
            </div>
          </div>
        </div>
      </GridContainer>
    );
  }

  if (!video) {
    return (
      <GridContainer>
        <div className="text-center py-20 space-y-4">
          <Icon name="alert-triangle" size={40} className="text-warning mx-auto" />
          <h2 className="text-xl font-bold text-text-primary">Production Not Found</h2>
          <p className="text-xs text-text-muted">The requested video production could not be found or has been removed.</p>
          <Link to="/app/videos">
            <Button variant="secondary" icon="arrow-left">Back to Video Library</Button>
          </Link>
        </div>
      </GridContainer>
    );
  }

  const progData = rawProg || video;
  const currentProgress = Math.round(progress || video.render_progress || 0);
  const currentStage = stage || video.render_stage || 'queued';
  const isDone = ['ready', 'approved', 'uploaded'].includes(status || video.status);

  const handleRetry = async () => {
    try {
      await api.updateVideo(id, { status: 'rendering', render_progress: 0, render_stage: 'queued' });
      toast.info('Render retry initiated...');
      window.location.reload();
    } catch (e) {
      toast.error(`Retry failed: ${e.message}`);
    }
  };

  return (
    <GridContainer>
      <div className="space-y-6">
        <PageHeader
          title={video.selected_title || video.title_candidates?.[0] || 'Production Tracking'}
          description="Track the real-time status of your video production."
          badge={<StatusBadge status={status || video.status} />}
          actions={
            <div className="flex items-center gap-2">
              <Link to="/app/videos">
                <Button variant="secondary" size="sm" icon="arrow-left">Review Queue</Button>
              </Link>
              {isDone && (
                <Link to="/app/videos">
                  <Button variant="primary" size="sm" icon="play">Review & Publish</Button>
                </Link>
              )}
            </div>
          }
        />

        {/* ── 1. Unified Pipeline Visualizer Component (§19) ───────── */}
        <PipelineVisualizer
          video={{ ...video, status: status || video.status, render_stage: currentStage, render_progress: currentProgress }}
          script={script}
          idea={idea}
        />

        {/* ── 2. Detailed Execution Grid ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main Execution Card (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <Card variant="surface">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="cpu" className="text-brand-red" size={16} />}>
                    Stage Execution Progress
                  </CardTitle>
                }
                action={
                  <span className="font-mono text-xs font-bold text-warning">
                    {currentProgress}% Completed
                  </span>
                }
              />
              <CardContent className="space-y-6">

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="w-full bg-canvas rounded-full h-3 overflow-hidden border border-border/60">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        status === 'failed' ? 'bg-danger' : isDone ? 'bg-success' : 'bg-warning'
                      }`}
                      style={{ width: `${Math.max(5, Math.min(100, currentProgress))}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted capitalize">Current Stage: <strong className="text-text-primary">{currentStage}</strong></span>
                    <span className="font-mono text-text-secondary">{currentProgress}%</span>
                  </div>
                </div>

                {/* Stage Steps Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {[
                    { id: 'tts', label: '1. Voiceover', desc: 'Synthesizing AI Voice' },
                    { id: 'visuals', label: '2. Visuals', desc: 'Generating stock & AI clips' },
                    { id: 'assembly', label: '3. Assembly', desc: 'Creating final video' },
                    { id: 'metadata', label: '4. Polishing', desc: 'Adding subtitles and SEO' }
                  ].map((st, i) => {
                    const stages = ['tts', 'visuals', 'assembly', 'metadata'];
                    const currentIdx = currentStage === 'done' ? stages.length : stages.indexOf(currentStage);
                    const isPast = i < currentIdx;
                    const isActive = i === currentIdx;

                    return (
                      <div
                        key={st.id}
                        className={`p-3 rounded-xl border text-xs flex flex-col justify-between gap-2 ${
                          isPast
                            ? 'bg-success/10 border-success/30 text-success'
                            : isActive
                              ? 'bg-warning/10 border-warning/30 text-warning animate-pulse'
                              : 'bg-elevated border-border text-text-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{st.label}</span>
                          {isPast && <Icon name="check" size={13} className="text-success" />}
                        </div>
                        <span className="text-[10px] opacity-75 font-mono">{st.desc}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Failed Error Details & Retry */}
                {status === 'failed' && (
                  <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl space-y-3 animate-in fade-in">
                    <h4 className="text-danger font-bold flex items-center gap-2 text-sm">
                      <Icon name="alert-triangle" size={16} /> Production Halted
                    </h4>
                    <p className="font-mono text-xs text-text-secondary whitespace-pre-wrap bg-surface p-3 rounded border border-border">
                      {progData.notes || 'An error occurred during video production.'}
                    </p>
                    <Button variant="primary" size="sm" icon="refresh-cw" onClick={handleRetry}>
                      Retry Production
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Metadata Sidebar Card (1 col) */}
          <div className="space-y-6">
            <Card variant="surface">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="info" className="text-text-muted" size={16} />}>
                    Job Specifications
                  </CardTitle>
                }
              />
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-text-muted">Target Platform</span>
                  <span className="font-mono font-bold text-text-primary">YouTube Shorts</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-text-muted">Created</span>
                  <span className="font-mono text-text-secondary">{new Date(video.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-text-muted">Caption Style</span>
                  <span className="font-semibold text-text-primary capitalize">{video.caption_style || 'Default'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-text-muted">Voice Talent</span>
                  <span className="font-semibold text-text-primary">{video.voice_override || 'Christopher (US)'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-text-muted">Aspect Ratio</span>
                  <span className="font-mono font-bold text-brand-red">9:16 Vertical</span>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </GridContainer>
  );
}
