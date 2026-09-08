import React from 'react';
import Icon from './Icon';

/**
 * EmptyState Component
 * Content-sized empty states (Section 3.3) avoiding giant void containers.
 */
export default function EmptyState({
  icon = 'inbox',
  title = 'Nothing here yet',
  description = 'There are currently no items to display.',
  action = null,
  secondary = null,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-8 px-6 bg-surface/40 border border-border border-dashed rounded-xl ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-elevated border border-border flex items-center justify-center text-text-muted mb-3 shadow-inner">
        <Icon name={icon} size={22} />
      </div>
      <h3 className="text-base font-bold text-text-primary tracking-tight mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-text-secondary max-w-sm leading-relaxed mb-4">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-1">
          {action}
        </div>
      )}
      {secondary && (
        <div className="mt-4 pt-3 border-t border-border/60 w-full max-w-xs text-xs text-text-muted">
          {secondary}
        </div>
      )}
    </div>
  );
}
