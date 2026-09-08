import React from 'react';
import Icon from './Icon';

/**
 * Metric Card Component
 * Monospace telemetry display for numbers, storage, subscribers, velocity.
 */
export default function Metric({
  label,
  value,
  unit = '',
  icon = null,
  iconColor = 'text-text-muted',
  subtitle = null,
  progress = null,
  progressColor = 'bg-brand-red',
  className = '',
}) {
  return (
    <div className={`bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-card-subtle ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <span className={iconColor}>
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>

      <div className="my-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-text-primary tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          {unit && (
            <span className="text-xs text-text-muted font-sans font-medium">
              {unit}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-text-secondary mt-1">
            {subtitle}
          </p>
        )}
      </div>

      {progress !== null && (
        <div className="mt-3 pt-3 border-t border-border/60">
          <div className="w-full bg-elevated rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
