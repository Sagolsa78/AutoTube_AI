import React from 'react';

export default function Tabs({
  tabs = [],
  activeId,
  onChange,
  variant = 'line', // 'line' | 'pills'
  className = ''
}) {
  return (
    <div className={`flex items-center ${variant === 'line' ? 'border-b border-border' : 'gap-2'} ${className}`} role="tablist">
      {tabs.map(tab => {
        const isActive = activeId === tab.id;
        if (variant === 'line') {
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`
                px-4 py-2 text-sm font-medium transition-colors relative
                ${isActive ? 'text-brand' : 'text-text-secondary hover:text-text-primary'}
              `}
            >
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-brand" />
              )}
            </button>
          );
        }
        // Pills variant
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`
              px-3 py-1.5 text-sm font-medium transition-colors rounded-lg
              ${isActive ? 'bg-brand/10 text-brand' : 'bg-transparent text-text-secondary hover:bg-bg-2 hover:text-text-primary'}
            `}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
