import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Icon from '../Icon';
import { useChannel } from '../../contexts/ChannelContext';
import JobCenterDropdown from '../jobs/JobCenterDropdown';
import CommandPalette from '../navigation/CommandPalette';

export default function TopBar() {
  const loc = useLocation();
  const { channels, activeChannel, setActiveChannelId, loadingChannels } = useChannel();
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const channelDropdownRef = useRef(null);

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

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (channelDropdownRef.current && !channelDropdownRef.current.contains(event.target)) {
        setChannelDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

        {/* Right: Persistent Channel Switcher + Job Center + Actions */}
        <div className="flex items-center gap-2.5 ml-auto">

          {/* Global Job Center */}
          <JobCenterDropdown />

          {/* Persistent Channel Switcher */}
          {!loadingChannels && channels.length > 0 && (
            <div className="relative" ref={channelDropdownRef}>
              <button
                onClick={() => setChannelDropdownOpen(!channelDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-border transition-colors text-xs font-medium select-none"
                aria-label="Active Channel"
              >
                <div className="w-5 h-5 rounded bg-brand-red flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {activeChannel?.name?.charAt(0).toUpperCase() || 'C'}
                </div>
                <span className="hidden sm:inline-block max-w-[110px] truncate text-text-primary font-semibold">
                  {activeChannel?.name || 'Channel'}
                </span>
                <Icon name="chevron-down" size={13} className="text-text-muted shrink-0" />
              </button>

              {channelDropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-surface border border-border rounded-xl shadow-dropdown py-1 z-50 animate-in fade-in-50 zoom-in-95">
                  <div className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border/80">
                    Active Channel
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1 divide-y divide-border/30">
                    {channels.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setActiveChannelId(c.id);
                          setChannelDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${
                          activeChannel?.id === c.id
                            ? 'bg-elevated text-brand-red font-bold'
                            : 'text-text-primary hover:bg-surface-hover'
                        }`}
                      >
                        <div className="w-5 h-5 rounded bg-surface border border-border flex items-center justify-center text-[10px] font-bold shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{c.name}</div>
                          <div className="text-[10px] text-text-muted truncate capitalize">{c.niche || 'general'}</div>
                        </div>
                        {activeChannel?.id === c.id && <Icon name="check" size={14} className="ml-auto text-brand-red" />}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-border/80 p-1">
                    <Link
                      to="/app/channels"
                      onClick={() => setChannelDropdownOpen(false)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                    >
                      <Icon name="plus" size={13} />
                      <span>Manage & Connect Channel</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Primary Quick Create CTA */}
          <Link
            to="/app/create"
            className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-brand-glow"
          >
            <Icon name="plus" size={14} />
            <span className="hidden sm:inline">Create Short</span>
            <span className="sm:hidden">Create</span>
          </Link>

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
