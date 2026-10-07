import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Icon from '../Icon';
import JobCenterDropdown from '../jobs/JobCenterDropdown';
import CommandPalette from '../navigation/CommandPalette';

export default function TopBar() {
  const loc = useLocation();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const titles = {
    '/app': 'Command Center',
    '/app/create': 'Creation Studio',
    '/app/ideas': 'Idea Lab',
    '/app/scripts': 'Script Studio',
    '/app/videos': 'Video Library',
    '/app/best': 'Best Content',
    '/app/publications': 'Publishing',
    '/app/analytics': 'Analytics',
    '/app/channels': 'Channels',
    '/app/logs': 'Activity Logs',
    '/app/health': 'System Health',
    '/app/profile': 'Settings'
  };

  const currentEntry = Object.entries(titles).find(([path]) =>
    path === '/app' ? loc.pathname === '/app' : loc.pathname.startsWith(path)
  );
  const currentTitle = currentEntry ? currentEntry[1] : 'Studio';

  // Global Ctrl/Cmd + K shortcut
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <>
      <header className="h-14 border-b border-border bg-canvas/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Mobile Branding & View Title / Desktop Breadcrumb */}
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

          {/* Desktop Breadcrumbs */}
          <div className="hidden md:flex items-center gap-2 text-xs font-medium text-text-muted">
            <span className="text-text-secondary">Workspace</span>
            <span>/</span>
            <span className="text-text-primary font-semibold">{currentTitle}</span>
          </div>
        </div>

        {/* Center: Command Palette Trigger */}
        <div className="hidden sm:flex items-center flex-1 max-w-xs mx-4">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-border text-xs text-text-muted transition-colors shadow-sm"
          >
            <span className="flex items-center gap-2">
              <Icon name="search" size={14} />
              <span>Search commands...</span>
            </span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-elevated border border-border rounded text-text-muted">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: Job Center + Actions */}
        <div className="flex items-center gap-2.5 ml-auto">

          {/* Global Job Center */}
          <JobCenterDropdown />

          {/* Settings / Profile Link */}
          <Link
            to="/app/profile"
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            title="Settings & Profile"
            aria-label="Settings"
          >
            <Icon name="settings" size={18} />
          </Link>
        </div>
      </header>

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </>
  );
}
