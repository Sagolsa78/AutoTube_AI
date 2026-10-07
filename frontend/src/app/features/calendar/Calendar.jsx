import React, { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addMonths, subMonths, isSameDay, isSameMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/Icon';
import { useChannel } from '../../../contexts/ChannelContext';
import { toast } from 'sonner';
import Skeleton from '../../../components/Skeleton';
import useContentStore from '../../../store/contentStore';

export default function Calendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const { activeChannelId } = useChannel();
  const { publications, videos, loading, fetchContent } = useContentStore();
  const [view, setView] = useState('week'); // 'week' or 'month'
  const [activePlatform, setActivePlatform] = useState('all');
  const [localItems, setLocalItems] = useState([]);

  useEffect(() => {
    fetchContent(activeChannelId);
  }, [activeChannelId, fetchContent]);

  // Combine publications and approved videos into calendar items
  useEffect(() => {
    const items = publications.map(p => ({
      id: p.id,
      video_id: p.video?.id,
      scheduled_at: p.scheduled_at || p.published_at || p.created_at,
      platform: p.platform || 'youtube',
      title: p.video?.derivedTitle || p.title || 'Untitled',
      schedule_status: p.schedule_status || (p.status === 'published' ? 'published' : 'scheduled')
    }));
    setLocalItems(items);
  }, [publications]);

  const calendarItems = React.useMemo(() => {
    return localItems.filter(item => activePlatform === 'all' || item.platform === activePlatform);
  }, [localItems, activePlatform]);

  const handleDragStart = (e, item) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetDate) => {
    e.preventDefault();
    try {
      const draggedItem = JSON.parse(e.dataTransfer.getData('application/json'));
      // Keep time, change date
      const originalDate = new Date(draggedItem.scheduled_at);
      const newDate = new Date(targetDate);
      newDate.setHours(originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds());

      setLocalItems(prev => prev.map(item =>
        item.id === draggedItem.id ? { ...item, scheduled_at: newDate.toISOString() } : item
      ));
      toast.success(`Rescheduled to ${format(newDate, 'MMM d')}`);
    } catch (err) {
      console.error(err);
    }
  };

  const startDate = view === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
  const daysToShow = view === 'week' ? 7 : 35; // 5 weeks for month view
  const days = Array.from({ length: daysToShow }).map((_, i) => addDays(startDate, i));

  const handleDayClick = (day) => {
    if (view === 'month') {
      setCurrentDate(day);
      setView('week');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in h-full flex flex-col">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Content Calendar</h1>
          <p className="text-xs text-text-secondary">Plan and visualize your multi-platform schedule.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-elevated border border-border p-1 rounded-lg mr-2">
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${view === 'week' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >
              Week
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${view === 'month' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >
              Month
            </button>
          </div>

          <button
            onClick={() => navigate('/app/create')}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-text-primary hover:bg-white text-canvas transition-colors shadow-sm flex items-center gap-1.5"
          >
            <Icon name="plus" size={14} /> Schedule
          </button>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-2">
        <button
          onClick={() => setActivePlatform('all')}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${activePlatform === 'all' ? 'bg-text-primary text-canvas' : 'bg-elevated text-text-secondary border border-border hover:border-text-muted'}`}
        >All Platforms</button>
        <button
          onClick={() => setActivePlatform('youtube')}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${activePlatform === 'youtube' ? 'bg-text-primary text-canvas' : 'bg-elevated text-text-secondary border border-border hover:border-text-muted'}`}
        >YouTube</button>
        <button
          onClick={() => setActivePlatform('instagram')}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${activePlatform === 'instagram' ? 'bg-text-primary text-canvas' : 'bg-elevated text-text-secondary border border-border hover:border-text-muted'}`}
        >Instagram</button>
        <button
          onClick={() => setActivePlatform('tiktok')}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${activePlatform === 'tiktok' ? 'bg-text-primary text-canvas' : 'bg-elevated text-text-secondary border border-border hover:border-text-muted'}`}
        >TikTok</button>
      </div>

      {/* ── Calendar Grid ───────────────────────────────────────── */}
      <div className="flex-1 bg-elevated border border-border rounded-2xl overflow-hidden flex flex-col min-h-[500px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/60 bg-surface/50">
          <h2 className="text-lg font-bold">{format(view === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate, 'MMMM yyyy')}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentDate(view === 'week' ? addDays(currentDate, -7) : subMonths(currentDate, 1))}
              className="p-1.5 hover:bg-surface rounded-lg text-text-muted hover:text-text-primary"
            >
              <Icon name="chevron-left" size={18} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-xs font-semibold hover:bg-surface rounded-lg text-text-muted hover:text-text-primary border border-transparent hover:border-border"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate(view === 'week' ? addDays(currentDate, 7) : addMonths(currentDate, 1))}
              className="p-1.5 hover:bg-surface rounded-lg text-text-muted hover:text-text-primary"
            >
              <Icon name="chevron-right" size={18} />
            </button>
          </div>
        </div>

        {false ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <Icon name="alert-triangle" size={32} className="text-warning mb-4" />
            <p className="text-sm font-bold mb-4">We couldn't load your calendar</p>
            <button onClick={() => fetchContent(activeChannelId, true)} className="px-4 py-2 bg-surface border border-border rounded text-xs font-bold hover:bg-elevated">Retry</button>
          </div>
        ) : (
          <div className={`grid grid-cols-7 flex-1 ${view === 'month' ? 'auto-rows-fr' : ''}`}>
            {days.map((day, idx) => {
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentDate);

              const dayItems = calendarItems.filter(item => isSameDay(new Date(item.scheduled_at), day))
                .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(day)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                  className={`border-r border-b border-border/40 p-2 flex flex-col gap-2 relative group
                    ${idx % 7 === 6 ? 'border-r-0' : ''}
                    ${isToday ? 'bg-brand-red/5' : ''}
                    ${!isCurrentMonth && view === 'month' ? 'opacity-40 bg-surface/30' : ''}
                    ${view === 'month' ? 'cursor-pointer hover:bg-surface-hover/30' : ''}
                  `}
                >
                  <div className={`flex justify-between items-start ${view === 'month' ? 'pr-2' : ''}`}>
                    <div className="flex flex-col">
                      {(view === 'week' || idx < 7) && (
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block text-center mb-1">{format(day, 'EEE')}</span>
                      )}
                      <span className={`text-sm font-medium inline-flex w-7 h-7 items-center justify-center rounded-full ${isToday ? 'bg-brand-red text-white font-bold' : 'text-text-primary'}`}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    {/* + Button for empty day scheduling */}
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate('/app/create'); }}
                      className="opacity-0 group-hover:opacity-100 p-1 bg-surface-hover hover:bg-surface-2 rounded text-text-muted hover:text-text-primary transition-opacity"
                      title="Schedule on this day"
                    >
                      <Icon name="plus" size={14} />
                    </button>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto hide-scrollbar">
                    {loading ? (
                      <div className="space-y-2">
                        <Skeleton height="60px" rounded="rounded-lg" />
                      </div>
                    ) : (
                      <>
                        {dayItems.map((item, i) => (
                          <div
                            key={item.id || i}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item)}
                            onClick={(e) => { e.stopPropagation(); navigate(`/app/create?video=${item.video_id}`); }}
                            className={`bg-surface border border-border p-2 rounded-lg cursor-grab active:cursor-grabbing hover:border-brand-red/50 transition-colors group relative ${item.schedule_status === 'published' ? 'opacity-70 grayscale hover:grayscale-0' : ''}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                               <span className="text-[9px] font-bold text-text-muted">{format(new Date(item.scheduled_at), 'p')}</span>
                               <div className="flex gap-1">
                                 {item.platform === 'youtube' && <Icon name="youtube" size={10} className="text-text-muted group-hover:text-[#FF0000]" />}
                                 {item.platform === 'instagram' && <Icon name="instagram" size={10} className="text-text-muted group-hover:text-[#E1306C]" />}
                                 {item.platform === 'tiktok' && <Icon name="music" size={10} className="text-text-muted group-hover:text-[#00F2FE]" />}
                               </div>
                            </div>
                            <p className="text-[10px] font-bold text-text-primary line-clamp-2 leading-tight">
                              {item.title}
                            </p>

                            <div className={`mt-2 h-0.5 rounded-full ${item.schedule_status === 'published' ? 'bg-success' : item.schedule_status === 'failed' ? 'bg-brand-red' : 'bg-warning'}`} />
                          </div>
                        ))}

                        {isToday && dayItems.length === 0 && view === 'week' && (
                          <div className="h-20 border border-dashed border-border/60 rounded-lg flex items-center justify-center text-[10px] text-text-muted flex-col gap-2">
                            <span>No posts</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
