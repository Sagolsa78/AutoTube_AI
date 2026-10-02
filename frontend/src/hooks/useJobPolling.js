import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { toast } from 'sonner';

export function useJobPolling(videoId, isPolling, options = {}) {
  const {
    intervalMs = 3000,
    maxIdleTimeMs = 15 * 60 * 1000, // 15 minutes stalled job detection
    onSuccess,
    onError,
    onStalled
  } = options;

  const [status, setStatus] = useState('pending');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [rawProg, setRawProg] = useState(null);
  
  const lastProgressRef = useRef(progress);
  const lastAdvanceTimeRef = useRef(Date.now());
  const timerRef = useRef(null);

  const DONE_STATUSES = ['ready', 'approved', 'uploaded'];

  const poll = useCallback(async () => {
    if (!videoId || !isPolling) return;
    try {
      const data = await api.getVideoProgress(videoId);
      
      setStatus(data.status);
      setStage(data.render_stage || '');
      setProgress(data.render_progress || 0);
      setRawProg(data);

      if (['failed', 'cancelled'].includes(data.status)) {
        if (onError) onError(data);
        return;
      }

      if (DONE_STATUSES.includes(data.status) || data.render_stage === 'done') {
        if (onSuccess) onSuccess(data);
        return;
      }

      // Check for stalled job
      if (data.render_progress > lastProgressRef.current) {
        lastProgressRef.current = data.render_progress;
        lastAdvanceTimeRef.current = Date.now();
      } else if (Date.now() - lastAdvanceTimeRef.current > maxIdleTimeMs) {
        if (onStalled) onStalled();
        else toast.error('Render seems stalled. The worker may have crashed.');
        setStatus('failed'); // Locally mark as failed to stop polling
        if (onError) onError({ notes: 'Render stalled timeout' });
        return;
      }

    } catch (err) {
      console.error('Job polling failed:', err);
    }
  }, [videoId, isPolling, maxIdleTimeMs, onError, onSuccess, onStalled]);

  useEffect(() => {
    if (!isPolling) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    
    // Reset trackers when starting
    lastProgressRef.current = 0;
    lastAdvanceTimeRef.current = Date.now();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(timerRef.current);
        timerRef.current = setInterval(poll, intervalMs * 3);
      } else {
        clearInterval(timerRef.current);
        poll(); 
        timerRef.current = setInterval(poll, intervalMs);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    timerRef.current = setInterval(poll, intervalMs);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPolling, poll, intervalMs]);

  return { status, progress, stage, rawProg, setStatus };
}
