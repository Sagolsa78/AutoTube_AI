import React from 'react';
import Icon from './Icon';

/**
 * FilterBar Component
 * Accessible tabs / filter strip with badges and smooth indicator
 */
export default function FilterBar({
  tabs = [],
  activeTab,
  onChange,
  className = '',
}) {
  return (
    <div className={`flex gap-1.5 border-b border-border pb-px overflow-x-auto hide-scrollbar ${className}`}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors select-none ${
              isActive
                ? 'border-brand-red text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong'
            }`}
            onClick={() => onChange(tab.id)}
          >
            {tab.icon && <Icon name={tab.icon} size={15} className={isActive ? 'text-brand-red' : 'text-text-muted'} />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span 
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isActive ? 'bg-brand-red/15 text-brand-red' : 'bg-elevated text-text-muted'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
