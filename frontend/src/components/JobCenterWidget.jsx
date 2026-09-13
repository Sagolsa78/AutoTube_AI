import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { api } from '../services/api';

export default function JobCenterWidget() {
  const [activeJobs, setActiveJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchJobs = async () => {
      try {
        const videos = await api.getVideos();
        if (!mounted) return;
        const rendering = (videos || []).filter(v => v.status === 'rendering' || v.status === 'queued');
        setActiveJobs(rendering);
      } catch (e) {
        // quietly fail
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000); // Poll every 10s globally
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (activeJobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {activeJobs.map(job => (
        <Link 
          key={job.id}
          to={`/app/jobs/${job.id}`}
          className="bg-surface/90 backdrop-blur-lg border border-border shadow-2xl rounded-xl p-3 hover:border-brand-red/50 transition-colors flex flex-col gap-2 w-64 animate-in slide-in-from-bottom-4"
        >
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-text-primary truncate pr-2">
              {job.title || `Job #${job.id.substring(0, 8)}`}
            </span>
            <Icon name="loader" size={14} className="animate-spin text-warning shrink-0" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-canvas rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-warning h-full transition-all duration-500"
                style={{ width: `${Math.max(5, Math.min(100, job.render_progress || 0))}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-warning shrink-0 font-bold">
              {Math.round(job.render_progress || 0)}%
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
