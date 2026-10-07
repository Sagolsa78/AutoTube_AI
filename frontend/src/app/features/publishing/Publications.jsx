import React, { useEffect } from 'react';
import { api } from '../../../services/api';
import Icon from '../../../components/Icon';
import GridContainer from '../../../components/layout/GridContainer';
import PageHeader from '../../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../../components/Card';
import StatusBadge from '../../../components/StatusBadge';
import EmptyState from '../../../components/EmptyState';
import Skeleton from '../../../components/Skeleton';
import Button from '../../../components/Button';
import { Link, useSearchParams } from 'react-router-dom';
import useContentStore from '../../../store/contentStore';
import { useChannel } from '../../../contexts/ChannelContext';

export default function Publications() {
  const { activeChannelId } = useChannel();
  const { publications, fetchContent, loading } = useContentStore();
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter') || 'live';

  useEffect(() => {
    fetchContent(activeChannelId);
  }, [activeChannelId, fetchContent]);

  // Sort and filter publications
  const filteredPubs = publications.filter(p => {
    if (filter === 'queue') {
       return p.status === 'scheduled' || p.status === 'queued' || p.video?.status === 'approved';
    }
    return p.status === 'published' || p.status === 'live' || p.video?.status === 'uploaded';
  });

  const sortedPubs = [...filteredPubs].sort((a, b) =>
    new Date(b.scheduled_at || b.published_at || b.video?.created_at || Date.now()) -
    new Date(a.scheduled_at || a.published_at || a.video?.created_at || Date.now())
  );

  if (loading) {
    return (
      <GridContainer>
        <div className="space-y-6">
          <Skeleton height="60px" rounded="rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton height="240px" rounded="rounded-xl" />
            <Skeleton height="240px" rounded="rounded-xl" />
            <Skeleton height="240px" rounded="rounded-xl" />
          </div>
        </div>
      </GridContainer>
    );
  }

  return (
    <GridContainer>
      <div className="space-y-6">
        <PageHeader
          title={filter === 'queue' ? "Publishing Queue" : "Publications"}
          description={filter === 'queue' ? "Content scheduled or waiting to be published." : "Verified YouTube Shorts published directly from your automated pipeline."}
          badge={
            <span className={`text-xs font-mono font-semibold px-2.5 py-1 rounded ${filter === 'queue' ? 'text-warning bg-warning/10 border border-warning/30' : 'text-success bg-success/10 border border-success/30'}`}>
              {sortedPubs.length} {filter === 'queue' ? 'In Queue' : 'Published Live'}
            </span>
          }
        />

        {sortedPubs.length === 0 ? (
          <EmptyState
            icon="youtube"
            title={filter === 'queue' ? "Queue is Empty" : "No Published Videos Yet"}
            description={filter === 'queue' ? "You have no videos scheduled or waiting to be published." : "You have not published any Shorts to YouTube. Review and approve rendered videos in the Review Queue to publish."}
            action={
              <Link to="/app/videos">
                <Button variant="primary" size="sm" icon="video">
                  Go to Review Queue
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedPubs.map(p => {
              const v = p.video;
              return (
              <Card key={p.id} variant="surface" className="flex flex-col justify-between overflow-hidden p-0">
                {/* Card Top Banner */}
                <div className="bg-elevated/70 px-4 py-2.5 border-b border-border flex justify-between items-center text-xs">
                  <StatusBadge status={filter === 'queue' ? 'approved' : 'uploaded'} size="sm" />
                  <span className="font-mono text-text-muted text-[11px]">
                    {p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString() : p.published_at ? new Date(p.published_at).toLocaleDateString() : filter === 'queue' ? 'Queued' : 'Published'}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col gap-4">
                  <div className="flex gap-4 items-start">
                    {/* Video Poster Placeholder */}
                    <div className="w-20 aspect-[9/16] bg-canvas rounded-lg border border-border overflow-hidden shrink-0 relative flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1">
                        <Icon name="play-circle" size={24} className="text-brand-red" />
                        <span className="text-[8px] font-mono text-text-muted">SHORTS</span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <h3 className="font-bold text-sm text-text-primary line-clamp-2 leading-tight">
                        {v?.derivedTitle || p.title || 'Untitled Short'}
                      </h3>
                      {v.niche && (
                        <span className="inline-block bg-elevated border border-border text-text-muted text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-bold">
                          {v.niche}
                        </span>
                      )}
                      <p className="text-xs text-text-secondary line-clamp-3 leading-relaxed">
                        {v.description}
                      </p>
                    </div>
                  </div>

                  {v.hashtags && v.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t border-border/60">
                      {v.hashtags.slice(0, 4).map((tag, i) => (
                        <span key={i} className="text-[10px] font-mono text-info bg-info/10 px-1.5 py-0.5 rounded">
                          #{tag}
                        </span>
                      ))}
                      {v.hashtags.length > 4 && (
                        <span className="text-[10px] font-mono text-text-muted self-center">
                          +{v.hashtags.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {(p.youtube_url || v?.youtube_id) && (
                  <div className="px-5 py-3 border-t border-border bg-elevated/30 flex justify-end">
                    <a
                      href={p.youtube_url || `https://youtube.com/shorts/${v?.youtube_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:text-brand-red-hover transition-colors"
                    >
                      <Icon name="youtube" size={14} />
                      <span>View on YouTube Shorts</span>
                      <Icon name="external-link" size={13} />
                    </a>
                  </div>
                )}
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </GridContainer>
  );
}
