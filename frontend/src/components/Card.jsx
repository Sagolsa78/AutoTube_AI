import React from 'react';

/**
 * Card Component Primitives
 * Styled according to Section 5 tokens (Surface #111318, Border #262A32, Elevated #171A20)
 */
export function Card({ 
  children, 
  className = '', 
  variant = 'surface', 
  hoverable = false, 
  onClick,
  ...props 
}) {
  const bgClass = variant === 'elevated' ? 'bg-elevated' : 'bg-surface';
  const hoverClass = hoverable ? 'hover:border-border-strong transition-colors duration-150' : '';
  const clickableClass = onClick ? 'cursor-pointer select-none' : '';

  return (
    <div 
      className={`${bgClass} border border-border rounded-xl p-5 shadow-card-subtle ${hoverClass} ${clickableClass} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={e => onClick && e.key === 'Enter' && onClick(e)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', title, action }) {
  if (title || action) {
    return (
      <div className={`flex items-center justify-between pb-3 mb-4 border-b border-border/80 ${className}`}>
        {title && (
          typeof title === 'string' ? (
            <h3 className="font-bold text-sm text-text-primary tracking-tight">{title}</h3>
          ) : title
        )}
        {action && <div>{action}</div>}
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-between pb-3 mb-4 border-b border-border/80 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', icon }) {
  return (
    <h3 className={`font-bold text-sm text-text-primary flex items-center gap-2 ${className}`}>
      {icon}
      <span>{children}</span>
    </h3>
  );
}

export function CardDescription({ children, className = '' }) {
  return (
    <p className={`text-xs text-text-secondary leading-relaxed ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`pt-3 mt-4 border-t border-border/80 flex items-center justify-between ${className}`}>
      {children}
    </div>
  );
}
