import React from 'react';

export default function Badge({ 
  children, 
  variant = 'default', 
  className = '', 
  style = {} 
}) {
  const variantClass = variant !== 'default' ? `badge-${variant}` : '';
  
  return (
    <span 
      className={`badge ${variantClass} ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}
