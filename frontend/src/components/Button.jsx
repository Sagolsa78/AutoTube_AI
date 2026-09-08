import React from 'react';
import Icon from './Icon';

/**
 * Button Component
 * Standardized creator studio button system
 */
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
  
  if (variant === 'primary') btnClass += ' btn-primary';
  else if (variant === 'secondary') btnClass += ' btn-secondary';
  else if (variant === 'ghost') btnClass += ' btn-ghost';
  else if (variant === 'danger') btnClass += ' btn-danger';
  else if (variant === 'success') btnClass += ' btn-success';
  else if (variant === 'outline') btnClass += ' bg-transparent border border-border text-text-primary hover:bg-surface-hover';
  else btnClass += ` btn-${variant}`;

  if (size === 'sm') btnClass += ' btn-sm';
  else if (size === 'lg') btnClass += ' btn-lg';
  else if (size === 'icon') btnClass += ' btn-icon';

  if (className) btnClass += ` ${className}`;

  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;

  return (
    <button 
      type={type}
      className={btnClass}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <span className="spinner" />}
      {!loading && icon && iconPosition === 'left' && (
        <Icon name={icon} size={iconSize} />
      )}
      {children}
      {!loading && icon && iconPosition === 'right' && (
        <Icon name={icon} size={iconSize} />
      )}
    </button>
  );
}
