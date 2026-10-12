import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon';
import { useChannel } from '../../contexts/ChannelContext';

export default function ChannelSwitcher() {
  const { channels, activeChannel, setActiveChannelId, loadingChannels } = useChannel();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loadingChannels || channels.length === 0) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-border transition-colors select-none"
        aria-label="Active Channel"
      >
        <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-white text-[11px] font-bold shrink-0 overflow-hidden">
          {activeChannel?.logo_url ? (
             <img src={activeChannel.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
             activeChannel?.name?.charAt(0).toUpperCase() || 'C'
          )}
        </div>
        <div className="flex flex-col items-start">
          <span className="truncate text-xs font-semibold text-text-primary max-w-[120px]">
            {activeChannel?.name || 'Channel'}
          </span>
          <span className="truncate text-[9px] text-text-muted flex items-center gap-1">
             <Icon name="youtube" size={10} className="text-brand-red" />
             {activeChannel?.youtube_connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <Icon name="chevron-down" size={14} className="text-text-muted shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-border rounded-xl shadow-dropdown py-1 z-50 animate-in fade-in zoom-in-95">
          <div className="px-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border/80 flex items-center justify-between">
            <span>Switch Workspace</span>
            <Link to="/app/channels" className="hover:text-brand transition-colors flex items-center gap-1" title="Manage Channels">
               <Icon name="plus" size={12} />
               <span className="sr-only">Add Channel</span>
            </Link>
          </div>
          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-border/30 hide-scrollbar">
            {channels.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveChannelId(c.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${
                  activeChannel?.id === c.id
                    ? 'bg-bg-2 text-brand font-bold'
                    : 'text-text-primary hover:bg-bg-2'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                  {c.logo_url ? (
                     <img src={c.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                     c.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1 flex flex-col">
                  <div className="truncate">{c.name}</div>
                  <div className="truncate text-[9px] font-normal text-text-muted flex items-center gap-1 mt-0.5">
                     <Icon name="youtube" size={9} className="text-brand-red opacity-80" />
                     {c.youtube_connected ? 'Connected' : 'Not connected'}
                  </div>
                </div>
                {activeChannel?.id === c.id && <Icon name="check" size={14} className="ml-auto text-brand" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
