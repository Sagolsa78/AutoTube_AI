import React from 'react';
import Icon from '../Icon';

export default function PipelineVisualizer({ 
  currentStep = 'render',
  video = null,
  script = null,
  idea = null,
  job = null,
  onStepClick = null
}) {
  const steps = [
    {
      id: 'idea',
      label: 'Idea',
      desc: idea ? idea.title : 'Concept',
      icon: 'lightbulb',
      status: idea ? 'completed' : 'completed',
    },
    {
      id: 'script',
      label: 'Script',
      desc: script?.scenes ? `${script.scenes.length} Scenes` : 'Drafted',
      icon: 'fileText',
      status: script ? 'completed' : 'completed',
    },
    {
      id: 'voice',
      label: 'Voice',
      desc: video?.voice_override || 'Edge-TTS',
      icon: 'mic',
      status: video?.render_stage && video.render_stage !== 'queued' && video.render_stage !== 'tts' ? 'completed' : video?.render_stage === 'tts' ? 'active' : 'completed',
    },
    {
      id: 'visuals',
      label: 'Visuals',
      desc: video?.style || 'Stock / AI',
      icon: 'image',
      status: ['assembly', 'metadata', 'done'].includes(video?.render_stage) ? 'completed' : video?.render_stage === 'visuals' ? 'active' : video?.render_stage === 'tts' || video?.render_stage === 'queued' ? 'pending' : 'completed',
    },
    {
      id: 'render',
      label: 'Render',
      desc: video?.render_stage === 'done' || ['ready', 'approved', 'uploaded'].includes(video?.status) ? '100%' : `${Math.round(video?.render_progress || 0)}%`,
      icon: 'film',
      status: ['ready', 'approved', 'uploaded'].includes(video?.status) || video?.render_stage === 'done' 
        ? 'completed' 
        : video?.status === 'failed' 
          ? 'failed' 
          : ['rendering', 'queued'].includes(video?.status)
            ? 'active'
            : 'pending',
    },
    {
      id: 'review',
      label: 'Review',
      desc: video?.status === 'uploaded' ? 'Approved' : video?.status === 'approved' ? 'Approved' : video?.status === 'ready' ? 'Action Req' : 'Pending',
      icon: 'check-circle',
      status: ['approved', 'uploaded'].includes(video?.status) 
        ? 'completed' 
        : video?.status === 'ready' 
          ? 'active' 
          : video?.status === 'rejected'
            ? 'failed'
            : 'pending',
    },
    {
      id: 'publish',
      label: 'Publish',
      desc: video?.status === 'uploaded' ? 'Live on YT' : 'Unpublished',
      icon: 'youtube',
      status: video?.status === 'uploaded' ? 'completed' : 'pending',
    }
  ];

  return (
    <div className="w-full bg-surface border border-border rounded-xl p-4 sm:p-6 overflow-x-auto select-none hide-scrollbar">
      <div className="flex items-center justify-between min-w-[680px] relative">
        
        {/* Background Connecting Line */}
        <div className="absolute top-4 left-6 right-6 h-0.5 bg-border -z-0" />

        {steps.map((step, idx) => {
          const isCompleted = step.status === 'completed';
          const isActive = step.status === 'active';
          const isFailed = step.status === 'failed';

          return (
            <div
              key={step.id}
              onClick={() => onStepClick && onStepClick(step.id)}
              className={`flex flex-col items-center text-center gap-2 relative z-10 transition-all ${
                onStepClick ? 'cursor-pointer group' : ''
              }`}
            >
              {/* Step Circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                  isCompleted
                    ? 'bg-success text-canvas shadow-[0_0_10px_rgba(50,196,141,0.3)]'
                    : isActive
                      ? 'bg-warning text-canvas animate-pulse shadow-[0_0_10px_rgba(232,176,75,0.4)]'
                      : isFailed
                        ? 'bg-danger text-white'
                        : 'bg-elevated border border-border text-text-muted'
                }`}
              >
                {isCompleted ? (
                  <Icon name="check" size={14} className="stroke-[3]" />
                ) : isFailed ? (
                  <Icon name="x" size={14} />
                ) : (
                  <Icon name={step.icon} size={14} />
                )}
              </div>

              {/* Step Labels */}
              <div className="flex flex-col items-center">
                <span
                  className={`text-xs font-bold tracking-tight ${
                    isCompleted
                      ? 'text-text-primary'
                      : isActive
                        ? 'text-warning'
                        : isFailed
                          ? 'text-danger'
                          : 'text-text-muted'
                  }`}
                >
                  {step.label}
                </span>
                <span className="text-[10px] font-mono text-text-muted truncate max-w-[90px]">
                  {step.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
