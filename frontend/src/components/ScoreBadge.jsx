import React from 'react';

/**
 * ScoreBadge Component
 * Formats QA scores, duration, virality ratings with high contrast monospace styling.
 */
export default function ScoreBadge({ score, max = 100, label = 'QA', className = '' }) {
  if (score === null || score === undefined) return null;

  const num = typeof score === 'number' ? score : parseFloat(score);
  const ratio = num / max;

  let colorClass = 'bg-elevated text-text-secondary border-border';
  if (ratio >= 0.8) {
    colorClass = 'bg-success/10 text-success border-success/30';
  } else if (ratio >= 0.6) {
    colorClass = 'bg-warning/10 text-warning border-warning/30';
  } else {
    colorClass = 'bg-danger/10 text-danger border-danger/30';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold border ${colorClass} ${className}`}>
      <span className="text-[10px] text-text-muted font-sans font-medium uppercase tracking-wider">{label}</span>
      <span>{num}</span>
    </span>
  );
}
