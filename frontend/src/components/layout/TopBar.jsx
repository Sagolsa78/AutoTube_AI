import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import Icon from '../Icon';

/**
 * TopBar Component
 * Streamlined header with exactly one persistent primary CTA per Section 3.4 & Section 10.
 */
export default function TopBar() {
  const loc = useLocation();

  const titles = { 
    '/app': 'Command Center', 
    '/app/create': 'Production Studio',
    '/app/ideas': 'Idea Generator', 
    '/app/scripts': 'Script Library', 
    '/app/videos': 'Review Queue',
    '/app/best': 'Best Content',
    '/app/publications': 'Publications',
    '/app/analytics': 'Channel Telemetry',
    '/app/channels': 'Channels & Niches',
    '/app/logs': 'Activity Logs',
    '/app/health': 'System Health',
    '/app/profile': 'Settings' 
  };

  const currentEntry = Object.entries(titles).find(([path]) => 
    path === '/app' ? loc.pathname === '/app' : loc.pathname.startsWith(path)
  );
  const currentTitle = currentEntry ? currentEntry[1] : 'Studio';

  return (
    <header className="h-14 border-b border-border bg-canvas/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      {/* Mobile Branding & View Title */}
      <div className="flex items-center gap-3">
        <Link to="/app" className="md:hidden flex items-center gap-2 text-brand-red font-bold tracking-tight">
          <span className="w-7 h-7 rounded-lg bg-brand-red flex items-center justify-center text-white shadow-brand-glow">
            <Icon name="film" size={15} />
          </span>
          <span className="text-text-primary text-base">AutoTube<span className="text-brand-red">.AI</span></span>
        </Link>
        <span className="hidden sm:inline-block md:hidden text-text-muted">/</span>
        <span className="hidden sm:inline-block md:hidden text-xs font-semibold text-text-secondary uppercase tracking-wider">
          {currentTitle}
        </span>
      </div>

      {/* Desktop Context Path / Breadcrumb */}
      <div className="hidden md:flex items-center gap-2 text-xs font-medium text-text-muted">
        <span className="text-text-secondary">Workspace</span>
        <span>/</span>
        <span className="text-text-primary font-semibold">{currentTitle}</span>
      </div>

      {/* Persistent Actions */}
      <div className="flex items-center gap-3 ml-auto">
        {/* EXACTLY ONE Persistent Primary Action per §3.4 & §10 */}
        <Link 
          to="/app/create" 
          className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-brand-glow"
        >
          <Icon name="plus" size={14} />
          <span>New Short</span>
        </Link>

        {/* Quick link to Settings/Profile */}
        <Link 
          to="/app/profile"
          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          title="Settings"
        >
          <Icon name="settings" size={18} />
        </Link>
      </div>
    </header>
  );
}
