import React from 'react';

/**
 * Skeleton Component
 * Loading state placeholder respecting dark mode tokens.
 */
export default function Skeleton({ className = '', height = '1rem', width = '100%', rounded = 'rounded-md' }) {
  return (
    <div 
      className={`bg-elevated animate-pulse ${rounded} ${className}`}
      style={{ height, width }}
    />
  );
}
