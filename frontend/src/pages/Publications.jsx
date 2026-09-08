import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';
import GridContainer from '../components/layout/GridContainer';
import PageHeader from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import Button from '../components/Button';
import { Link } from 'react-router-dom';

export default function Publications() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const all = await api.getVideos();
        if (!isMounted) return;
        setVideos((all || [])
          .filter(v => v.status === 'uploaded')
          .sort((a, b) => new Date(b.uploaded_at || b.created_at) - new Date(a.uploaded_at || a.created_at))
        );
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
          title="Publications"
          description="Verified YouTube Shorts published directly from your automated pipeline."
          badge={
            <span className="text-xs font-mono font-semibold text-success bg-success/10 border border-success/30 px-2.5 py-1 rounded">
              {videos.length} Published Live
            </span>
          }
        />

        {videos.length === 0 ? (
          <EmptyState
            icon="youtube"
            title="No Published Videos Yet"
            description="You have not published any Shorts to YouTube. Review and approve rendered videos in the Review Queue to publish."
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
            {videos.map(v => (
              <Card key={v.id} variant="surface" className="flex flex-col justify-between overflow-hidden p-0">
                {/* Card Top Banner */}
                <div className="bg-elevated/70 px-4 py-2.5 border-b border-border flex justify-between items-center text-xs">
                  <StatusBadge status="uploaded" size="sm" />
                  <span className="font-mono text-text-muted text-[11px]">
                    {v.uploaded_at ? new Date(v.uploaded_at).toLocaleDateString() : 'Published'}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col gap-4">
                  <div className="flex gap-4 items-start">
                    {/* Video Poster */}
                    <div className="w-20 aspect-[9/16] bg-canvas rounded-lg border border-border overflow-hidden shrink-0 relative flex items-center justify-center">
                      <video 
                        src={`/api/videos/${v.id}/preview`} 
                        className="w-full h-full object-cover" 
                        muted 
                        preload="metadata"
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <h3 className="font-bold text-sm text-text-primary line-clamp-2 leading-tight">
                        {v.selected_title || v.title || 'Untitled Short'}
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

                {v.youtube_id && (
                  <div className="px-5 py-3 border-t border-border bg-elevated/30 flex justify-end">
                    <a
                      href={`https://youtube.com/shorts/${v.youtube_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:text-brand-red-hover transition-colors"
                    >
                      <span>View on YouTube Shorts</span>
                      <Icon name="external-link" size={13} />
                    </a>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </GridContainer>
  );
}
