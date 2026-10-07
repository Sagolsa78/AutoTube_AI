import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import Icon from '../../components/Icon';
import TopBar from '../../components/layout/TopBar';
import { api } from '../../services/api';
import { navConfig, getActiveNavItem } from '../../config/navConfig';
import useContentStore from '../../store/contentStore';
import { useChannel } from '../../contexts/ChannelContext';
import JobCenterDropdown from '../../components/jobs/JobCenterDropdown';

// Mobile bottom nav items
const mobileNav = [
  { to: '/app', label: 'Home', icon: 'home' },
  { to: '/app/videos', label: 'Content', icon: 'folder' },
  { to: '/app/create', label: 'Create', icon: 'plus', isCenter: true },
  { to: '/app/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/app/profile', label: 'More', icon: 'menu' },
];

function NavItem({ item, collapsed, counts }) {
  const loc = useLocation();
  const activeItem = getActiveNavItem(loc.pathname, loc.search);
  const active = activeItem?.id === item.id;

  const to = item.query ? `${item.path}${item.query}` : item.path;
  const count = item.badgeKey ? counts[item.badgeKey] : 0;

  // Style config based on badge type
  let badgeColor = 'bg-border text-text-secondary';
  if (count > 0) {
    if (item.badgeKey === 'failed') badgeColor = 'bg-brand-red text-white';
    else if (item.badgeKey === 'review') badgeColor = 'bg-warning/20 text-warning';
    else if (item.badgeKey === 'published') badgeColor = 'bg-success/20 text-success';
  }

  return (
    <Link
      to={to}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red ${
        active
          ? 'bg-surface text-text-primary font-bold'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-2 font-medium'
      } ${collapsed ? 'justify-center px-2' : ''}`}
    >
      {active && (
         <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-brand-red rounded-r-full" />
      )}

      <Icon name={item.icon} size={18} className={`shrink-0 ${active ? 'text-text-primary' : 'text-text-muted group-hover:text-text-primary transition-colors'}`} />

      {!collapsed && <span className="truncate flex-1">{item.label}</span>}

      {!collapsed && count > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono tracking-tight font-bold ml-auto ${badgeColor}`}>
          {count > 99 ? '99+' : count}
        </span>
      )}
      {collapsed && count > 0 && (
         <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-red border-2 border-canvas" />
      )}
    </Link>
  );
}

export default function AppShell() {
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('autotube_sidebar_collapsed') === 'true';
  });

  const [engineStatus, setEngineStatus] = useState('Checking...');
  const [isEngineOnline, setIsEngineOnline] = useState(false);
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false);

  const { getMetrics } = useContentStore();
  const counts = getMetrics();
  const { channels, activeChannel, setActiveChannelId, loadingChannels } = useChannel();

  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        await api.getSystemHealth();
        if (mounted) {
          setIsEngineOnline(true);
          setEngineStatus('Healthy');
        }
      } catch (e) {
        if (mounted) {
          setIsEngineOnline(false);
          setEngineStatus('Offline');
        }
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('autotube_sidebar_collapsed', String(next));
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col md:flex-row antialiased font-sans">
      {/* ── Desktop Sidebar ─────── */}
      <aside
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen bg-canvas border-r border-border/40 z-40 select-none transition-all duration-300 ${
          collapsed ? 'w-[72px]' : 'w-[240px]'
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4">
          <Link to="/app" className="flex items-center gap-2.5 group overflow-hidden" title="AutoTube">
            <span className="w-8 h-8 rounded-lg bg-brand-red flex items-center justify-center text-white shadow-brand-glow transition-transform group-hover:scale-105 shrink-0">
              <Icon name="film" size={16} />
            </span>
            {!collapsed && (
              <span className="font-bold text-base text-text-primary tracking-tight truncate">
                AutoTube<span className="text-brand-red">.AI</span>
              </span>
            )}
          </Link>
        </div>

        {/* Channel Switcher */}
        {!loadingChannels && channels.length > 0 && (
          <div className="px-3 pb-4">
            <div className="relative">
              <button
                onClick={() => setChannelDropdownOpen(!channelDropdownOpen)}
                className={`w-full flex items-center gap-2 p-1.5 rounded-lg bg-surface border border-border hover:bg-surface-hover transition-colors select-none ${collapsed ? 'justify-center' : 'justify-between'}`}
                aria-label="Active Channel"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-6 h-6 rounded-md bg-brand-red flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                    {activeChannel?.name?.charAt(0).toUpperCase() || 'C'}
                  </div>
                  {!collapsed && (
                    <span className="truncate text-xs font-semibold text-text-primary">
                      {activeChannel?.name || 'Channel'}
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <Icon name="chevron-down" size={14} className="text-text-muted shrink-0 mr-1" />
                )}
              </button>

              {channelDropdownOpen && !collapsed && (
                <div className="absolute left-0 top-full mt-1 w-[216px] bg-surface border border-border rounded-xl shadow-dropdown py-1 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border/80">
                    Switch Workspace
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1 divide-y divide-border/30 hide-scrollbar">
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
                        </div>
                        {activeChannel?.id === c.id && <Icon name="check" size={14} className="ml-auto text-brand-red" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-6 hide-scrollbar">
          {navConfig.map((section, idx) => (
             <nav key={section.id} className="space-y-1" aria-label={section.label}>
                {!collapsed && section.label && (
                   <div className="px-2 pb-1.5 text-[11px] font-bold text-text-muted uppercase tracking-[0.04em]">
                     {section.label}
                   </div>
                )}
                {collapsed && section.label && idx > 0 && (
                   <div className="mx-2 my-2 h-px bg-border/50" />
                )}
                {section.items.map(item => (
                   <NavItem key={item.id} item={item} collapsed={collapsed} counts={counts} />
                ))}
             </nav>
          ))}
        </div>

        {/* System Footer Status */}
        <div className="p-3 border-t border-border/40 bg-canvas space-y-2 shrink-0">
          <JobCenterDropdown
             isEngineOnline={isEngineOnline}
             engineStatus={engineStatus}
             collapsed={collapsed}
             toggleCollapse={toggleCollapse}
          />

          <button
            onClick={toggleCollapse}
            className={`w-full flex ${collapsed ? 'justify-center' : 'justify-start px-2 gap-3'} items-center p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={16} />
            {!collapsed && <span className="text-xs font-medium">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ─────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-20 md:pb-8 bg-surface">
        <TopBar />
        <main className="flex-1 w-full p-4 sm:p-6 sm:px-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar (<= 768px only) ─────────── */}
      <nav
        className="mobile-only md:hidden fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur-lg border-t border-border z-50 flex items-center justify-around h-[60px] safe-area-bottom select-none shadow-dropdown"
        aria-label="Mobile Navigation"
      >
        {mobileNav.map(n => {
          const path = loc.pathname.replace(/\/$/, '');
          const active = n.to === '/app' ? path === '/app' : path.startsWith(n.to.split('?')[0]);

          if (n.isCenter) {
            return (
              <Link
                key={n.to}
                to={n.to}
                className="flex flex-col items-center justify-center -mt-4 group"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-brand-glow transition-transform active:scale-95 border-2 border-canvas ${
                  active ? 'bg-brand-red text-white' : 'bg-surface text-brand-red border-brand-red/20'
                }`}>
                  <Icon name={n.icon} size={22} />
                </div>
                <span className={`text-[10px] font-bold mt-1 ${active ? 'text-brand-red' : 'text-text-muted'}`}>Create</span>
              </Link>
            );
          }

          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors relative ${
                active ? 'text-brand-red' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {active && <div className="absolute top-0 inset-x-2 h-[3px] bg-brand-red rounded-b-md shadow-[0_0_8px_rgba(255,59,48,0.5)]" />}
              <Icon name={n.icon} size={20} />
              <span className={`text-[10px] font-medium tracking-tight ${active ? 'font-bold' : ''}`}>
                {n.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
