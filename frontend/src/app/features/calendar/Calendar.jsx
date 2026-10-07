import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import Icon from '../../../components/Icon';
import { api } from '../../../services/api';
import { useChannel } from '../../../contexts/ChannelContext';

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { activeChannelId } = useChannel();
  const [view, setView] = useState('week');

  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      try {
        const vids = await api.getVideos(activeChannelId);
        // We consider scheduled (approved) and published (uploaded)
        setVideos((vids || []).filter(v => ['approved', 'uploaded'].includes(v.status)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [activeChannelId]);

  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

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
            <button className="px-3 py-1.5 rounded-md text-xs font-semibold bg-surface text-text-primary shadow-sm">Week</button>
            <button className="px-3 py-1.5 rounded-md text-xs font-semibold text-text-muted hover:text-text-primary">Month</button>
          </div>

          <button className="px-4 py-2 rounded-lg text-xs font-bold bg-text-primary hover:bg-white text-canvas transition-colors shadow-sm flex items-center gap-1.5">
            <Icon name="plus" size={14} /> Schedule
          </button>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-2">
        <button className="px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-text-primary text-canvas">All Platforms</button>
        <button className="px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-elevated text-text-secondary border border-border hover:border-text-muted">YouTube</button>
        <button className="px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-elevated text-text-secondary border border-border hover:border-text-muted">Instagram</button>
        <button className="px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-elevated text-text-secondary border border-border hover:border-text-muted">TikTok</button>
      </div>

      {/* ── Calendar Grid ───────────────────────────────────────── */}
      <div className="flex-1 bg-elevated border border-border rounded-2xl overflow-hidden flex flex-col min-h-[500px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/60 bg-surface/50">
          <h2 className="text-lg font-bold">{format(startDate, 'MMMM yyyy')}</h2>
          <div className="flex gap-2">
            <button onClick={() => setCurrentDate(addDays(currentDate, -7))} className="p-1.5 hover:bg-surface rounded-lg text-text-muted hover:text-text-primary"><Icon name="chevron-left" size={18} /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-xs font-semibold hover:bg-surface rounded-lg text-text-muted hover:text-text-primary border border-transparent hover:border-border">Today</button>
            <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-1.5 hover:bg-surface rounded-lg text-text-muted hover:text-text-primary"><Icon name="chevron-right" size={18} /></button>
          </div>
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 flex-1">
          {weekDays.map((day, idx) => {
            const isToday = isSameDay(day, new Date());
            // Fake some data positioning based on day for now if real data is missing schedule dates
            const dayVideos = videos.filter(v => {
               // We would check v.scheduled_for or v.created_at here
               // For demo purposes, we randomly place videos in the week if they are scheduled
               return true;
            }).slice(idx, idx + 1); // Mock placing 1 per day

            return (
              <div key={idx} className={`border-r border-border/40 p-3 flex flex-col gap-3 ${idx === 6 ? 'border-r-0' : ''} ${isToday ? 'bg-brand-red/5' : ''}`}>
                <div className="text-center">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">{format(day, 'EEE')}</span>
                  <span className={`text-sm font-medium mt-1 inline-flex w-7 h-7 items-center justify-center rounded-full ${isToday ? 'bg-brand-red text-white font-bold' : 'text-text-primary'}`}>
                    {format(day, 'd')}
                  </span>
                </div>

                <div className="flex-1 space-y-2">
                  {dayVideos.map((v, i) => (
                    <div key={v.id || i} className="bg-surface border border-border p-2 rounded-lg cursor-pointer hover:border-brand-red/50 transition-colors group relative">
                      <div className="flex items-center justify-between mb-1">
                         <span className="text-[9px] font-bold text-text-muted">10:00 AM</span>
                         <div className="flex gap-1">
                           <Icon name="youtube" size={10} className="text-text-muted group-hover:text-[#FF0000]" />
                           <Icon name="instagram" size={10} className="text-text-muted group-hover:text-[#E1306C]" />
                         </div>
                      </div>
                      <p className="text-[10px] font-bold text-text-primary line-clamp-2 leading-tight">
                        {v.title || 'Draft AI Video Project'}
                      </p>

                      {/* Status line */}
                      <div className={`mt-2 h-0.5 rounded-full ${v.status === 'uploaded' ? 'bg-success' : 'bg-warning'}`} />
                    </div>
                  ))}

                  {isToday && dayVideos.length === 0 && (
                    <div className="h-20 border border-dashed border-border/60 rounded-lg flex items-center justify-center text-[10px] text-text-muted">
                      No posts
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
