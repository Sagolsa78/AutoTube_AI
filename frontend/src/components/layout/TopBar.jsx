import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import Icon from '../Icon';
import { useChannel } from '../../contexts/ChannelContext';

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
  
  const { channels, activeChannel, setActiveChannelId, loadingChannels } = useChannel();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
        
        {/* Channel Switcher */}
        {!loadingChannels && channels.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-border transition-colors text-sm font-medium select-none"
            >
              <div className="w-5 h-5 rounded bg-brand-red flex items-center justify-center text-white text-[10px] font-bold">
                 {activeChannel?.name?.charAt(0).toUpperCase() || 'C'}
              </div>
              <span className="hidden sm:inline-block max-w-[120px] truncate">
                {activeChannel?.name || 'Select Channel'}
              </span>
              <Icon name="chevron-down" size={14} className="text-text-muted" />
            </button>
            
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-elevated border border-border rounded-xl shadow-dropdown py-1 z-50">
                <div className="px-3 py-2 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border mb-1">
                  Your Channels
                </div>
                <div className="max-h-64 overflow-y-auto hide-scrollbar">
                  {channels.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setActiveChannelId(c.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-hover transition-colors ${activeChannel?.id === c.id ? 'text-brand-red font-semibold' : 'text-text-primary'}`}
                    >
                       <div className="w-5 h-5 rounded bg-surface border border-border flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                         {c.name.charAt(0).toUpperCase()}
                       </div>
                       <span className="truncate">{c.name}</span>
                       {activeChannel?.id === c.id && <Icon name="check" size={14} className="ml-auto" />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-border mt-1 pt-1">
                  <Link 
                    to="/app/channels" 
                    onClick={() => setDropdownOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                  >
                    <Icon name="plus" size={14} />
                    <span>Manage Channels</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

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
