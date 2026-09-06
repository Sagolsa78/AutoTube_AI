import React from 'react';

export function Card({ children, className = '', style = {}, onClick }) {
  return (
    <div 
      className={`card ${className}`} 
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={e => onClick && e.key === 'Enter' && onClick(e)}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', title, action }) {
  if (title) {
    return (
      <div className={`card-header ${className}`}>
        <h3 className="card-title flex items-center gap-2">{title}</h3>
        {action && <div>{action}</div>}
      </div>
    );
  }
  return (
    <div className={`card-header ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', icon }) {
  return (
    <h3 className={`card-title flex items-center gap-2 ${className}`}>
      {icon && icon}
      {children}
    </h3>
  );
}
