import React from 'react';
import Icon from '../Icon';

export default function Select({
  label,
  value,
  onChange,
  options = [],
  disabled = false,
  className = '',
  required = false,
  error = null,
  icon = null,
  ...props
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-semibold text-text-secondary flex items-center gap-1.5">
          {icon && <Icon name={icon} size={14} className="text-text-muted" />}
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={`
            w-full appearance-none bg-bg-2 border rounded-lg px-3 py-2 text-sm text-text-primary
            focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-danger' : 'border-border hover:border-text-muted'}
          `}
          {...props}
        >
          {options.map((opt, i) => (
            <option key={i} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
          <Icon name="chevron-down" size={16} />
        </div>
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
