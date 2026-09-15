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

export default function JobCenterDropdown() {
  const { activeVideos, activeComputeJobs, activeCount, jobs, cancelVideo, cancelJob } = useJobs();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

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
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button in Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all select-none ${
          activeCount > 0
            ? 'bg-warning/10 border-warning/40 text-warning hover:bg-warning/20'
            : 'bg-surface border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover'
        }`}
        title="Global Job Center"
        aria-label="Job Center"
      >
        <span className="relative flex h-2 w-2">
          {activeCount > 0 ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-warning"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          )}
        </span>
        <span className="font-mono">Jobs</span>
        {activeCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-warning text-canvas font-bold text-[10px]">
            {activeCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface border border-border rounded-xl shadow-dropdown py-2 z-50 animate-in fade-in-50 zoom-in-95">
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

          {/* Footer */}
          <div className="px-3 pt-2 border-t border-border/80 flex items-center justify-between text-xs">
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
      )}
    </div>
  );
}
