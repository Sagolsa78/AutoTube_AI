import React from 'react';

/**
 * GridContainer
 * Layout primitive that enforces fluid-width across viewports (1024, 1440, 1920)
 * while maintaining intentional margins and avoiding dead right-hand whitespace.
 */
export default function GridContainer({ children, className = '', fluid = false }) {
  return (
    <div 
      className={`w-full mx-auto px-4 sm:px-6 lg:px-8 ${
        fluid ? 'max-w-none' : 'max-w-[1800px]'
      } ${className}`}
    >
      {children}
    </div>
  );
}
