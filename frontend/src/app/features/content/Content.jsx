import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Icon from '../../../components/Icon';
import { useChannel } from '../../../contexts/ChannelContext';
import useContentStore from '../../../store/contentStore';

const TABS = [
  { id: 'all', label: 'All Content' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'rendering', label: 'Rendering' },
  { id: 'failed', label: 'Failed' },
  { id: 'review', label: 'Review' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' }
];

export default function Content() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeChannelId } = useChannel();
  const { videos, loading, error, fetchContent } = useContentStore();

  const currentTab = searchParams.get('filter') || 'all';
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'board'

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchContent(activeChannelId);
  }, [activeChannelId, fetchContent]);

  const getCount = (tabId) => {
    if (tabId === 'all') return videos.length;
    if (tabId === 'drafts') return videos.filter(v => ['pending', 'concept', 'scripting'].includes(v.status)).length;
    if (tabId === 'rendering') return videos.filter(v => v.status === 'rendering').length;
    if (tabId === 'failed') return videos.filter(v => v.status === 'failed').length;
    if (tabId === 'review') return videos.filter(v => v.status === 'ready').length;
    if (tabId === 'scheduled') return videos.filter(v => v.status === 'approved').length;
    if (tabId === 'published') return videos.filter(v => v.status === 'uploaded').length;
    return 0;
  };

  const filteredVideos = videos.filter(v => {
    const matchesSearch = (v.title || v.topic || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (currentTab === 'all') return true;
    if (currentTab === 'drafts') return ['pending', 'concept', 'scripting'].includes(v.status);
    if (currentTab === 'rendering') return v.status === 'rendering';
    if (currentTab === 'failed') return v.status === 'failed';
    if (currentTab === 'review') return v.status === 'ready';
    if (currentTab === 'scheduled') return v.status === 'approved';
    if (currentTab === 'published') return v.status === 'uploaded';
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in pb-12 h-full flex flex-col">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Content Library</h1>
          <p className="text-xs text-text-secondary">Manage your video pipeline and past publications.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-border text-xs focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red w-48 transition-all"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-elevated border border-border p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >
              <Icon name="grid" size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >
              <Icon name="list" size={14} />
            </button>
          </div>

          <button
            onClick={() => navigate('/app/create')}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-text-primary hover:bg-white text-canvas transition-colors shadow-sm"
          >
            New Video
          </button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto hide-scrollbar border-b border-border/50 pb-px">
          {TABS.map(tab => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSearchParams(tab.id === 'all' ? {} : { filter: tab.id })}
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
                  isActive
                    ? 'border-text-primary text-text-primary'
                    : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border'
                }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${isActive ? 'bg-surface-2 text-text-primary' : 'bg-surface text-text-muted'}`}>
                  {getCount(tab.id)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Content Area ────────────────────────────────────────── */}
      <div className="flex-1 min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
            <Icon name="loader" size={24} className="animate-spin text-brand-red" />
            <p className="text-xs text-text-muted">Loading content library...</p>
          </div>
        ) : error ? (
          <div className="h-64 border border-dashed border-danger/30 bg-danger/5 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-3">
             <div className="w-12 h-12 bg-danger/10 rounded-xl flex items-center justify-center text-danger">
               <Icon name="alert-circle" size={24} />
             </div>
             <div>
               <p className="text-sm font-bold text-text-primary">Failed to load content</p>
               <p className="text-xs text-text-secondary mt-1">{error}</p>
             </div>
             <button
                onClick={() => fetchContent(activeChannelId, true)}
                className="mt-2 px-4 py-2 bg-surface hover:bg-surface-hover border border-border rounded-lg text-xs font-bold transition-colors"
             >
               Retry
             </button>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="h-64 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-3">
             <div className="w-12 h-12 bg-elevated rounded-xl flex items-center justify-center text-text-muted">
               <Icon name="folder" size={24} />
             </div>
             <div>
               <p className="text-sm font-bold text-text-primary">No content found</p>
               <p className="text-xs text-text-secondary mt-1">Try adjusting your filters or create a new video.</p>
             </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredVideos.map(video => (
              <ContentCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <ListView videos={filteredVideos} />
        )}
      </div>
    </div>
  );
}

function ContentCard({ video }) {
  const navigate = useNavigate();
  const dateStr = new Date(video.created_at || Date.now()).toLocaleDateString();
  const durationStr = "0:59"; // Mock duration

  return (
    <div
      onClick={() => navigate(`/app/videos`)}
      className="group cursor-pointer bg-elevated border border-border rounded-xl overflow-hidden hover:border-border-strong transition-all hover:shadow-card-subtle flex flex-col relative"
    >
      <div className="aspect-[9/16] bg-surface relative overflow-hidden flex-shrink-0 group-hover:opacity-90 transition-opacity">
         {video.final_video_url || video.thumbnail_url ? (
           <img src={video.thumbnail_url || video.final_video_url} className="w-full h-full object-cover" alt="thumbnail" />
         ) : (
           <div className="absolute inset-0 bg-gradient-to-br from-surface-2 to-surface flex flex-col items-center justify-center p-4 text-center">
             <Icon name="film" size={24} className="text-border mb-2" />
             <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{video.derivedTitle || 'Untitled'}</span>
           </div>
         )}
         <div className="absolute inset-0 bg-gradient-to-t from-canvas/90 via-canvas/20 to-transparent opacity-80" />

         <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] font-mono font-bold text-white">
           {durationStr}
         </div>

         <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
           <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
             video.status === 'ready' ? 'bg-brand-red text-white' :
             video.status === 'rendering' ? 'bg-warning text-canvas' :
             video.status === 'uploaded' ? 'bg-success text-canvas' :
             video.status === 'failed' ? 'bg-danger text-white' :
             'bg-surface-input text-text-muted'
           }`}>
             {video.status.toUpperCase()}
           </span>
         </div>

         {/* Hover Quick Actions */}
         <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-canvas/40 backdrop-blur-[2px]">
            <button className="p-2 bg-surface hover:bg-surface-hover rounded-full text-text-primary shadow-sm" title="Open">
              <Icon name="play" size={14} />
            </button>
            <button className="p-2 bg-surface hover:bg-surface-hover rounded-full text-text-primary shadow-sm" title="Duplicate">
              <Icon name="copy" size={14} />
            </button>
            <button className="p-2 bg-surface hover:bg-danger/20 rounded-full text-danger shadow-sm" title="Delete">
              <Icon name="trash" size={14} />
            </button>
         </div>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className="text-xs font-bold text-text-primary line-clamp-2 leading-tight">
          {video.derivedTitle || 'Untitled Project'}
        </h3>
        <div className="mt-auto pt-2 flex items-center justify-between text-[10px] text-text-muted">
           <span>{dateStr}</span>
           <div className="flex items-center gap-1.5 opacity-60">
              {video.status === 'uploaded' && (
                <>
                  <Icon name="youtube" size={12} className="text-text-primary" />
                </>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}

function ListView({ videos }) {
  return (
    <div className="bg-elevated border border-border/60 rounded-xl overflow-hidden">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-2/50 border-b border-border/60 text-[10px] uppercase font-bold text-text-muted tracking-wider">
          <tr>
            <th className="px-4 py-3 w-8"><input type="checkbox" className="rounded border-border bg-canvas text-brand-red focus:ring-brand-red" /></th>
            <th className="px-4 py-3">Video</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Duration</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {videos.map(v => (
            <tr key={v.id} className="hover:bg-surface-hover/50 group transition-colors">
              <td className="px-4 py-3"><input type="checkbox" className="rounded border-border bg-canvas text-brand-red focus:ring-brand-red" /></td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-14 bg-surface rounded overflow-hidden flex-shrink-0">
                      {v.thumbnail_url || v.final_video_url ? (
                        <img src={v.thumbnail_url || v.final_video_url} className="w-full h-full object-cover" alt="thumbnail" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-surface-2 to-surface flex items-center justify-center">
                          <Icon name="film" size={14} className="text-border" />
                        </div>
                      )}
                   </div>
                   <span className="font-bold text-text-primary line-clamp-2">{v.derivedTitle || 'Untitled Project'}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                  v.status === 'ready' ? 'bg-brand-red/10 text-brand-red' :
                  v.status === 'rendering' ? 'bg-warning/10 text-warning' :
                  v.status === 'uploaded' ? 'bg-success/10 text-success' :
                  v.status === 'failed' ? 'bg-danger/10 text-danger' :
                  'bg-surface-2 text-text-muted'
                }`}>
                  {v.status.toUpperCase()}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-[10px] text-text-secondary">0:59</td>
              <td className="px-4 py-3 text-text-secondary">{new Date(v.created_at || Date.now()).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface"><Icon name="play" size={14} /></button>
                  <button className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface"><Icon name="copy" size={14} /></button>
                  <button className="p-1.5 text-text-muted hover:text-danger rounded-md hover:bg-danger/10"><Icon name="trash" size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
          {videos.length === 0 && (
            <tr>
              <td colSpan="6" className="px-4 py-8 text-center text-text-muted">No videos found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
