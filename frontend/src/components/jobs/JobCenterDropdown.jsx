import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../Icon';
import { useJobs } from '../../hooks/useJobs';

const STAGE_LABELS = {
  queued: 'Queued in pipeline',
  dispatching: 'Dispatching worker',
  tts: 'Generating voiceover (TTS)',
  visuals: 'Generating & fetching visuals',
  assembly: 'FFmpeg assembly & captions',
  metadata: 'Optimizing titles & SEO',
  done: 'Render complete',
  failed: 'Render failed'
};

export default function JobCenterDropdown({ isEngineOnline, engineStatus, collapsed, toggleCollapse }) {
  const { activeVideos, activeComputeJobs, activeCount, jobs, cancelVideo, cancelJob } = useJobs();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Derived status for the chip
  let chipStatus = isEngineOnline ? 'Healthy' : 'Offline';
  if (isEngineOnline && activeCount > 0) chipStatus = `Busy (${activeCount})`;
  if (engineStatus === 'Checking...' || engineStatus === 'Waking Engine...') chipStatus = engineStatus;

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger Button in Sidebar Footer */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-2 rounded-lg text-sm hover:bg-surface-2 transition-colors group cursor-pointer"
        aria-label="System Status & Jobs"
      >
        <div className="relative flex h-3 w-3 shrink-0 items-center justify-center">
          {activeCount > 0 ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-warning"></span>
            </>
          ) : isEngineOnline ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </>
          ) : (
            <>
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-red"></span>
            </>
          )}
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0 flex-1 text-left">
             <span className={`text-xs font-semibold truncate ${!isEngineOnline ? 'text-brand-red' : activeCount > 0 ? 'text-warning' : 'text-text-primary'}`}>
               {chipStatus}
             </span>
             <span className="text-[10px] text-text-muted">System Status</span>
          </div>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setIsOpen(false)} />
          <div className="fixed inset-x-4 bottom-[70px] sm:absolute sm:inset-auto sm:left-full sm:bottom-0 sm:ml-2 w-auto sm:w-80 max-w-full sm:max-w-[320px] bg-surface border border-border rounded-xl shadow-dropdown py-2 z-50 animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/80">
            <div className="flex items-center gap-2">
              <Icon name="cpu" size={15} className="text-brand-red" />
              <span className="text-xs font-bold text-text-primary tracking-wide uppercase">
                Active Job Center
              </span>
            </div>
            <span className="text-[11px] font-mono text-text-muted">
              {activeCount} in-flight
            </span>
          </div>

          {/* Body: Active Video Renders */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/40 p-2 space-y-2">
            {activeVideos.length === 0 && activeComputeJobs.length === 0 ? (
              <div className="p-6 text-center text-text-muted text-xs space-y-1">
                <div className="w-8 h-8 rounded-full bg-surface-hover border border-border flex items-center justify-center mx-auto text-success mb-2">
                  <Icon name="check" size={16} />
                </div>
                <p className="font-medium text-text-secondary">Pipeline is clear</p>
                <p className="text-[11px]">No rendering or compute jobs in progress</p>
              </div>
            ) : (
              <>
                {activeVideos.map(v => {
                  const progress = Math.round(v.render_progress || 0);
                  const stageLabel = STAGE_LABELS[v.render_stage] || v.render_stage || 'Processing';
                  return (
                    <div
                      key={v.id}
                      className="p-3 bg-elevated/70 hover:bg-elevated rounded-lg border border-border/60 transition-colors flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/app/jobs/${v.id}`}
                            onClick={() => setIsOpen(false)}
                            className="text-xs font-bold text-text-primary hover:text-brand-red truncate block"
                          >
                            {v.selected_title || v.title_candidates?.[0] || `Short #${v.id.substring(0, 8)}`}
                          </Link>
                          <span className="text-[10px] text-warning font-medium flex items-center gap-1.5 mt-0.5">
                            <Icon name="loader" size={10} className="animate-spin" />
                            {stageLabel}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold text-warning">
                          {progress}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-canvas rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-warning h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-text-muted pt-1">
                        <span className="font-mono">ID: {v.id.substring(0, 6)}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => cancelVideo(v.id)}
                            className="text-text-muted hover:text-danger transition-colors"
                          >
                            Cancel
                          </button>
                          <Link
                            to={`/app/jobs/${v.id}`}
                            onClick={() => setIsOpen(false)}
                            className="text-brand-red hover:underline"
                          >
                            Details →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {activeComputeJobs.map(j => (
                  <div
                    key={j.id}
                    className="p-3 bg-elevated/70 rounded-lg border border-border/60 flex flex-col gap-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-text-primary uppercase tracking-wide text-[11px]">
                        {j.capability} Compute Job
                      </span>
                      <span className="badge badge-rendering text-[10px] py-0 px-1.5">
                        {j.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-text-muted">
                      <span>Worker: {j.worker_type || 'local'}</span>
                      <button
                        onClick={() => cancelJob(j.id)}
                        className="text-text-muted hover:text-danger"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer Metrics */}
          <div className="px-4 py-3 border-t border-border/80 bg-surface-2/50 flex flex-col gap-3 rounded-b-xl">
             <div className="flex items-center justify-between gap-4">
               <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex justify-between items-center text-[10px] text-text-secondary">
                     <span>Storage</span>
                     <span className="font-mono text-text-primary">42GB / 100GB</span>
                  </div>
                  <div className="w-full bg-canvas rounded-full h-1.5 border border-border/50">
                     <div className="bg-brand-red h-full rounded-full w-[42%]" />
                  </div>
               </div>
               <div className="w-px h-8 bg-border" />
               <div className="flex flex-col gap-1 min-w-[70px]">
                  <span className="text-[10px] text-text-secondary">AI Provider</span>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-success">
                     <span className="relative flex h-1.5 w-1.5">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                     </span>
                     Gemini
                  </div>
               </div>
             </div>

             <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
               <Link
                 to="/app/videos"
                 onClick={() => setIsOpen(false)}
                 className="text-text-secondary hover:text-text-primary transition-colors text-[11px]"
               >
                 Video Queue
               </Link>
               <Link
                 to="/app/health"
                 onClick={() => setIsOpen(false)}
                 className="text-brand-red hover:underline font-medium text-[11px]"
               >
                 Cluster Health →
               </Link>
             </div>
          </div>
          </div>
        </>
      )}
    </div>
  );
}
