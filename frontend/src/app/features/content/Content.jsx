import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Icon from '../../../components/Icon';
import { api } from '../../../services/api';
import { useChannel } from '../../../contexts/ChannelContext';

const TABS = [
  { id: 'all', label: 'All Content' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'rendering', label: 'Rendering' },
  { id: 'review', label: 'Review' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' }
];

export default function Content() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeChannelId } = useChannel();

  const currentTab = searchParams.get('filter') || 'all';
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'board'

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      try {
        const vids = await api.getVideos(activeChannelId);
        setVideos(vids || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [activeChannelId]);

  const filteredVideos = videos.filter(v => {
    if (currentTab === 'all') return true;
    if (currentTab === 'drafts') return ['pending', 'concept', 'scripting'].includes(v.status);
    if (currentTab === 'rendering') return v.status === 'rendering';
    if (currentTab === 'review') return ['ready', 'failed'].includes(v.status);
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
          {/* View Toggle */}
          <div className="flex items-center bg-elevated border border-border p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >
              <Icon name="grid" size={14} />
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'board' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >
              <Icon name="trello" size={14} />
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
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? 'border-text-primary text-text-primary'
                    : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Content Area ────────────────────────────────────────── */}
      <div className="flex-1 min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Icon name="loader" size={24} className="animate-spin text-text-muted" />
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
          <KanbanBoard videos={videos} />
        )}
      </div>
    </div>
  );
}

function ContentCard({ video }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/app/videos`)}
      className="group cursor-pointer bg-elevated border border-border rounded-xl overflow-hidden hover:border-border-strong transition-all hover:shadow-card-subtle flex flex-col"
    >
      <div className="aspect-[9/16] bg-surface relative overflow-hidden flex-shrink-0">
         {video.final_video_url ? (
           <video src={video.final_video_url} className="w-full h-full object-cover" />
         ) : (
           <div className="absolute inset-0 flex items-center justify-center text-border">
             <Icon name="film" size={32} />
           </div>
         )}
         <div className="absolute inset-0 bg-gradient-to-t from-canvas/80 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
         <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
           <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
             video.status === 'ready' ? 'bg-brand-red text-white' :
             video.status === 'rendering' ? 'bg-warning text-canvas' :
             video.status === 'uploaded' ? 'bg-success text-canvas' :
             'bg-surface-input text-text-muted'
           }`}>
             {video.status}
           </span>
         </div>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className="text-xs font-bold text-text-primary line-clamp-2 leading-tight">
          {video.title || 'Untitled Project'}
        </h3>
        <div className="mt-auto pt-2 flex items-center gap-1.5 opacity-50">
           {video.status === 'uploaded' && (
             <>
               <Icon name="youtube" size={12} className="text-text-primary" />
               <Icon name="instagram" size={12} className="text-text-primary" />
             </>
           )}
        </div>
      </div>
    </div>
  );
}

function KanbanBoard({ videos }) {
  const columns = [
    { id: 'drafts', label: 'Ideas & Scripts', statuses: ['pending', 'concept', 'scripting'] },
    { id: 'rendering', label: 'Rendering', statuses: ['rendering'] },
    { id: 'review', label: 'Review', statuses: ['ready', 'failed'] },
    { id: 'scheduled', label: 'Scheduled', statuses: ['approved'] },
  ];

  return (
    <div className="flex gap-4 overflow-x-auto h-[65vh] pb-4 hide-scrollbar">
      {columns.map(col => {
        const colVideos = videos.filter(v => col.statuses.includes(v.status));
        return (
          <div key={col.id} className="flex flex-col shrink-0 w-[280px] bg-elevated/30 rounded-xl border border-border/40 p-2">
            <div className="px-2 py-2 mb-2 flex items-center justify-between">
               <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{col.label}</h3>
               <span className="text-[10px] font-mono text-text-secondary">{colVideos.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto hide-scrollbar space-y-2 px-1">
              {colVideos.map(video => (
                <div key={video.id} className="bg-surface border border-border p-3 rounded-lg shadow-sm hover:border-border-strong cursor-grab">
                   <h4 className="text-xs font-bold text-text-primary line-clamp-2">{video.title || 'Untitled'}</h4>
                   <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted">
                     <span className="font-mono">{new Date(video.created_at || Date.now()).toLocaleDateString()}</span>
                   </div>
                </div>
              ))}
              {colVideos.length === 0 && (
                <div className="text-center p-4 text-[10px] text-border font-medium border border-dashed border-border/50 rounded-lg">
                  Empty
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
