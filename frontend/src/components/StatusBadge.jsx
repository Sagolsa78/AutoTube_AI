import React from 'react';
import Icon from './Icon';

/**
 * StatusBadge Component
 * WCAG AA compliant status indicators: ALWAYS text + icon + color (Section 11 & 22)
 */
export default function StatusBadge({ 
  status = 'pending', 
  label = null, 
  size = 'md',
  className = '' 
}) {
  const normalized = (status || '').toLowerCase().trim();

  const configs = {
    ready: {
      label: 'Ready',
      icon: 'check',
      classes: 'badge-ready',
    },
    approved: {
      label: 'Approved',
      icon: 'check',
      classes: 'badge-approved',
    },
    uploaded: {
      label: 'Published',
      icon: 'youtube',
      classes: 'badge-uploaded',
    },
    published: {
      label: 'Published',
      icon: 'check',
      classes: 'badge-published',
    },
    rendering: {
      label: 'Rendering',
      icon: 'loader',
      spin: true,
      classes: 'badge-rendering',
    },
    pending: {
      label: 'Pending',
      icon: 'alert-triangle',
      classes: 'badge-pending',
    },
    failed: {
      label: 'Failed',
      icon: 'x',
      classes: 'badge-failed',
    },
    rejected: {
      label: 'Rejected',
      icon: 'x',
      classes: 'badge-rejected',
    },
    scripted: {
      label: 'Scripted',
      icon: 'fileText',
      classes: 'badge-scripted',
    },
    draft: {
      label: 'Draft',
      icon: 'fileText',
      classes: 'badge-draft',
    },
    promoted: {
      label: 'In Studio',
      icon: 'film',
      classes: 'badge-scripted',
    },
    discarded: {
      label: 'Discarded',
      icon: 'x',
      classes: 'badge-rejected',
    },
    best: {
      label: 'Best Short',
      icon: 'star',
      classes: 'bg-brand-red/15 text-brand-red border-brand-red/30',
    },
    online: {
      label: 'Online',
      icon: 'check',
      classes: 'badge-ready',
    },
    offline: {
      label: 'Offline',
      icon: 'x',
      classes: 'badge-failed',
    },
    limited: {
      label: 'Limited',
      icon: 'alert-triangle',
      classes: 'badge-pending',
    },
  };

  const config = configs[normalized] || {
    label: normalized.charAt(0).toUpperCase() + normalized.slice(1) || 'Unknown',
    icon: 'activity',
    classes: 'badge-neutral',
  };

  const displayText = label || config.label;
  const iconSize = size === 'sm' ? 10 : 12;

  return (
    <span className={`badge ${config.classes} ${size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : ''} ${className}`}>
      <Icon 
        name={config.icon} 
        size={iconSize} 
        className={config.spin ? 'animate-spin' : ''} 
      />
      <span>{displayText}</span>
    </span>
  );
}
