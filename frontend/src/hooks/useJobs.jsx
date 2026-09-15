import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { toast } from 'sonner';

const JobsContext = createContext(null);

export function JobsProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const [activeVideos, setActiveVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const prevStatusesRef = useRef(new Map());

  const fetchJobsAndVideos = useCallback(async () => {
    try {
      const [jobsData, videosData] = await Promise.all([
        api.getJobs('?limit=15').catch(() => []),
        api.getVideos().catch(() => [])
      ]);

      const jobsList = Array.isArray(jobsData) ? jobsData : [];
      const videosList = Array.isArray(videosData) ? videosData : [];

      // Detect status changes for notifications
      videosList.forEach(video => {
        const prevStatus = prevStatusesRef.current.get(video.id);
        if (prevStatus && prevStatus !== video.status) {
          if (['ready', 'approved'].includes(video.status) && prevStatus === 'rendering') {
            toast.success(`Video Ready: "${video.selected_title || video.title_candidates?.[0] || 'Your Short'}" has finished rendering!`);
          } else if (video.status === 'failed' && prevStatus === 'rendering') {
            toast.error(`Render Failed: "${video.selected_title || 'Your Short'}" could not be completed.`);
          }
        }
        prevStatusesRef.current.set(video.id, video.status);
      });

      setJobs(jobsList);
      
      const inFlightVideos = videosList.filter(v => 
        ['rendering', 'queued', 'pending'].includes(v.status)
      );
      setActiveVideos(inFlightVideos);
    } catch (err) {
      console.warn('Jobs polling error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Compute active count (active videos + in-flight backend jobs)
  const activeComputeJobs = jobs.filter(j => 
    ['queued', 'dispatching', 'running', 'waiting_for_local_worker'].includes(j.status)
  );
  const activeCount = activeVideos.length + activeComputeJobs.length;

  useEffect(() => {
    fetchJobsAndVideos();

    let intervalId;
    const updateInterval = () => {
      if (intervalId) clearInterval(intervalId);
      const isHidden = document.hidden;
      const delay = isHidden 
        ? 30000 
        : activeCount > 0 
          ? 3500 
          : 15000;
      intervalId = setInterval(fetchJobsAndVideos, delay);
    };

    updateInterval();
    const handleVisibilityChange = () => updateInterval();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchJobsAndVideos, activeCount]);

  const cancelJob = async (jobId) => {
    try {
      await api.cancelJob(jobId);
      toast.info('Job cancellation requested');
      fetchJobsAndVideos();
    } catch (err) {
      toast.error(`Failed to cancel job: ${err.message}`);
    }
  };

  const cancelVideo = async (videoId) => {
    try {
      await api.cancelVideo(videoId);
      toast.info('Render cancellation requested');
      fetchJobsAndVideos();
    } catch (err) {
      toast.error(`Failed to cancel render: ${err.message}`);
    }
  };

  return (
    <JobsContext.Provider value={{
      jobs,
      activeVideos,
      activeComputeJobs,
      activeCount,
      loading,
      refreshJobs: fetchJobsAndVideos,
      cancelJob,
      cancelVideo
    }}>
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs() {
  const context = useContext(JobsContext);
  if (!context) {
    throw new Error('useJobs must be used within a JobsProvider');
  }
  return context;
}
