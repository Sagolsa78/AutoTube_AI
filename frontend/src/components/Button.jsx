import React from 'react';
import Icon from './Icon';

export default function Button({ 
  children, 
  variant = 'secondary', 
  size = 'md', 
  icon = null,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className = '', 
  onClick,
  type = 'button',
  ...props 
}) {
  let btnClass = 'btn';
  if (variant) btnClass += ` btn-${variant}`;
  if (size === 'sm') btnClass += ' btn-sm';
  if (size === 'icon') btnClass += ' btn-icon';
  if (className) btnClass += ` ${className}`;

  return (
    <button 
      type={type}
      className={btnClass}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <span className="spinner" />}
      {!loading && icon && iconPosition === 'left' && <Icon name={icon} size={size === 'sm' ? 12 : 14} />}
      {children}
      {!loading && icon && iconPosition === 'right' && <Icon name={icon} size={size === 'sm' ? 12 : 14} />}
    </button>
  );
}
