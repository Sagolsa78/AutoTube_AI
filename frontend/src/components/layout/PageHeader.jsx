import React from 'react';

/**
 * PageHeader
 * Standardized header component across all pages:
 * provides title, subtitle, optional badge, and right-hand action controls.
 */
export default function PageHeader({ 
  title, 
  description, 
  badge = null, 
  actions = null,
  className = ''
}) {
  return (
    <header className={`flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-border mb-6 ${className}`}>
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
            {title}
          </h1>
          {badge && <div>{badge}</div>}
        </div>
        {description && (
          <p className="text-sm text-text-secondary max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </header>
  );
}
