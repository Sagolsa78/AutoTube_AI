import React from 'react';

export default function TimelineTrack({ title, color, scenes, selectedIndex, onSelect, type }) {
  // If there are no scenes, render empty track placeholder
  if (!scenes || scenes.length === 0) {
    return (
      <div className="flex h-14 bg-surface rounded-lg border border-border overflow-hidden">
        <div className="w-20 shrink-0 bg-elevated border-r border-border flex items-center justify-center">
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{title}</span>
        </div>
        <div className="flex-1 flex items-center px-4">
          <span className="text-xs text-border border border-dashed border-border px-3 py-1 rounded">Empty Track</span>
        </div>
      </div>
    );
  }

  // Assuming each scene has an equal duration for the UI mockup
  const totalScenes = scenes.length;

  return (
    <div className="flex h-14 bg-surface rounded-lg border border-border overflow-hidden relative">
      {/* Track Header */}
      <div className="w-20 shrink-0 bg-elevated border-r border-border flex items-center justify-center z-10">
        <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{title}</span>
      </div>

      {/* Track Content */}
      <div className="flex-1 flex relative">
        {scenes.map((scene, idx) => {
          const isSelected = selectedIndex === idx;
          const widthPercent = 100 / totalScenes;

          return (
            <div
              key={idx}
              onClick={() => onSelect(idx)}
              className={`h-full border-r border-border/50 p-1 flex items-center cursor-pointer transition-colors relative group ${
                isSelected ? 'bg-surface-hover' : 'hover:bg-surface-hover/50'
              }`}
              style={{ width: `${widthPercent}%` }}
            >
              <div className={`w-full h-full rounded-md border ${isSelected ? `border-white ${color}/20` : `border-transparent ${color}/10`} overflow-hidden relative`}>

                {/* Active Selection Indicator */}
                {isSelected && <div className={`absolute top-0 inset-x-0 h-0.5 ${color}`} />}

                {/* Visual Track: Show thumbnail */}
                {type === 'visual' && (
                  <div className="w-full h-full bg-surface-input flex items-center justify-center">
                    {scene.image_url ? (
                       <img src={scene.image_url} className="h-full w-auto object-cover opacity-60" alt="scene" />
                    ) : (
                       <span className="text-[10px] text-text-muted font-bold">V{idx + 1}</span>
                    )}
                  </div>
                )}

                {/* Audio Track: Show waveform mock */}
                {type === 'audio' && (
                  <div className="w-full h-full flex items-center gap-[1px] px-1 overflow-hidden opacity-50">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className={`w-1 rounded-full ${color}`} style={{ height: `${Math.max(20, Math.random() * 100)}%` }} />
                    ))}
                  </div>
                )}

                {/* Text Track: Show caption text */}
                {type === 'text' && (
                  <div className="w-full h-full flex items-center px-2">
                    <span className="text-[9px] font-bold text-text-secondary truncate">
                      {scene.text || '...'}
                    </span>
                  </div>
                )}

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
