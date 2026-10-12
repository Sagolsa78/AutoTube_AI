import React from 'react';
import Icon from '../Icon';
import Button from '../Button';

export default function ErrorState({
  title = "Something went wrong",
  message = "An error occurred while loading this content.",
  icon = "alert-triangle",
  actionLabel,
  onAction,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-bg-1 border border-danger/20 rounded-xl ${className}`}>
      <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center text-danger mb-4">
        <Icon name={icon} size={24} />
      </div>
      <h3 className="text-lg font-bold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-secondary max-w-md mb-6">{message}</p>

      {actionLabel && onAction && (
        <Button variant="outline" onClick={onAction} icon="refresh-cw">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
