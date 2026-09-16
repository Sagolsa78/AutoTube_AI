import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../Icon';

const COMMANDS = [
  { id: 'create', title: 'Create New Video', subtitle: 'Launch Studio workflow', icon: 'plus-circle', path: '/app/create', section: 'Creation' },
  { id: 'ideas', title: 'Idea Generator', subtitle: 'Explore viral concepts and trends', icon: 'lightbulb', path: '/app/ideas', section: 'Creation' },
  { id: 'scripts', title: 'Script Studio', subtitle: 'Scene drafting and editing', icon: 'fileText', path: '/app/scripts', section: 'Creation' },
  { id: 'videos', title: 'Video Library', subtitle: 'Review rendered shorts and drafts', icon: 'video', path: '/app/videos', section: 'Production' },
  { id: 'publications', title: 'Publishing & Schedule', subtitle: 'YouTube uploads and calendar', icon: 'youtube', path: '/app/publications', section: 'Publishing' },
  { id: 'analytics', title: 'Channel Analytics', subtitle: 'Monetization & view telemetry', icon: 'barChart', path: '/app/analytics', section: 'Insights' },
  { id: 'channels', title: 'Channels & YouTube', subtitle: 'Manage active channels and OAuth', icon: 'hash', path: '/app/channels', section: 'System' },
  { id: 'settings', title: 'Settings & Profile', subtitle: 'AI models, watermarks, brand setup', icon: 'settings', path: '/app/profile', section: 'System' },
  { id: 'health', title: 'System Health & Workers', subtitle: 'Compute plane and cluster diagnostics', icon: 'heart', path: '/app/health', section: 'Operator' },
  { id: 'logs', title: 'Activity Logs', subtitle: 'Backend log stream', icon: 'activity', path: '/app/logs', section: 'Operator' },
];

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const filteredCommands = COMMANDS.filter(cmd =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.subtitle.toLowerCase().includes(query.toLowerCase()) ||
    cmd.section.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filteredCommands.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          navigate(selected.path);
          onClose();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, navigate, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-sm animate-in fade-in-50">
      <div
        className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Bar Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-border gap-3">
          <Icon name="search" size={18} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or jump to page..."
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono bg-elevated text-text-muted border border-border rounded">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-border/20">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-text-muted text-xs">
              No matching commands found for "{query}"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={() => {
                    navigate(cmd.path);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isSelected ? 'bg-elevated text-text-primary border border-border' : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-brand-red text-white' : 'bg-elevated border border-border text-text-muted'
                    }`}>
                      <Icon name={cmd.icon} size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate text-text-primary">
                        {cmd.title}
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        {cmd.subtitle}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted px-2 py-0.5 rounded bg-surface border border-border/60">
                    {cmd.section}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-border/80 bg-elevated/40 flex items-center justify-between text-[11px] text-text-muted">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span className="font-mono">AutoTube Command Center</span>
        </div>
      </div>
    </div>
  );
}
