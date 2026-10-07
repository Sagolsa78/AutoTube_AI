import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import Icon from '../../components/Icon';
import TopBar from '../../components/layout/TopBar';
import { api } from '../../services/api';

const contentNav = [
  { to: '/app/videos', label: 'All', icon: 'folder' },
  { to: '/app/ideas', label: 'Ideas', icon: 'lightbulb' },
  { to: '/app/scripts', label: 'Scripts', icon: 'fileText' },
  { to: '/app/videos?filter=review', label: 'Review', icon: 'eye' },
  { to: '/app/videos?filter=published', label: 'Published', icon: 'checkCircle' },
];

const publishingNav = [
  { to: '/app/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/app/publications', label: 'Queue', icon: 'list' },
];

const insightsNav = [
  { to: '/app/analytics', label: 'Analytics', icon: 'barChart2' },
];

const channelsNav = [
  { to: '/app/channels', label: 'Channels', icon: 'tv' },
];

const systemNav = [
  { to: '/app/profile', label: 'Plan / Usage', icon: 'settings' },
];

// Mobile bottom nav items
const mobileNav = [
  { to: '/app', label: 'Home', icon: 'home' },
  { to: '/app/videos', label: 'Content', icon: 'folder' },
  { to: '/app/create', label: 'Create', icon: 'plus', isCenter: true },
  { to: '/app/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/app/profile', label: 'More', icon: 'menu' },
];

function NavItem({ to, label, icon, primary, collapsed }) {
  const loc = useLocation();
  // Ensure we match exact routes or sub-routes correctly
  const pathWithoutQuery = to.split('?')[0];
  const active = to === '/app' ? loc.pathname === '/app' : loc.pathname.startsWith(pathWithoutQuery) && (to.includes('?') ? loc.search === to.split('?')[1] : true);

  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all select-none ${
        active
          ? (primary
              ? 'bg-brand-red text-white shadow-brand-glow'
              : 'bg-elevated text-text-primary')
          : (primary
              ? 'text-brand-red hover:bg-brand-red/10'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover')
      } ${collapsed ? 'justify-center px-2' : ''}`}
    >
      <Icon name={icon} size={18} className={active ? 'text-current' : primary ? 'text-brand-red' : 'text-text-muted'} />
      {!collapsed && <span>{label}</span>}
      {active && !primary && !collapsed && (
        <span className="w-1.5 h-1.5 rounded-full bg-brand-red ml-auto" />
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

  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        await api.getSystemHealth();
        if (mounted) {
          setIsEngineOnline(true);
          setEngineStatus('Engine Online');
        }
      } catch (e) {
        if (mounted) {
          setIsEngineOnline(false);
          setEngineStatus('Waking Engine...');
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
          <Link to="/app" className="flex items-center gap-2.5 group overflow-hidden">
            <span className="w-8 h-8 rounded-lg bg-brand-red flex items-center justify-center text-white shadow-brand-glow transition-transform group-hover:scale-105 shrink-0">
              <Icon name="film" size={16} />
            </span>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-base text-text-primary tracking-tight leading-tight truncate">
                  AutoTube
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto py-2 px-3 space-y-6 hide-scrollbar">

          <nav className="space-y-1">
            <NavItem to="/app" label="Home" icon="home" collapsed={collapsed} />
          </nav>

          {/* CREATE Action */}
          <nav className="space-y-2">
            {!collapsed && (
              <div className="px-2 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Create
              </div>
            )}
            <NavItem to="/app/create" label="New Video" icon="plus" primary collapsed={collapsed} />
          </nav>

          {/* Content */}
          <nav className="space-y-1">
            {!collapsed && (
              <div className="px-2 pb-1 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Content
              </div>
            )}
            {contentNav.map(n => <NavItem key={n.to} {...n} collapsed={collapsed} />)}
          </nav>

          {/* Publishing */}
          <nav className="space-y-1">
            {!collapsed && (
              <div className="px-2 pb-1 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Publishing
              </div>
            )}
            {publishingNav.map(n => <NavItem key={n.to} {...n} collapsed={collapsed} />)}
          </nav>

          {/* Insights */}
          <nav className="space-y-1">
            {!collapsed && (
              <div className="px-2 pb-1 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Insights
              </div>
            )}
            {insightsNav.map(n => <NavItem key={n.to} {...n} collapsed={collapsed} />)}
          </nav>

          {/* Channels */}
          <nav className="space-y-1">
            {channelsNav.map(n => <NavItem key={n.to} {...n} collapsed={collapsed} />)}
          </nav>

        </div>

        {/* System Footer Status */}
        <div className="p-3 border-t border-border/40 bg-canvas space-y-2">
          {systemNav.map(n => <NavItem key={n.to} {...n} collapsed={collapsed} />)}
          <Link
            to="/app/health"
            className="flex items-center justify-between p-2 rounded-lg text-xs hover:bg-elevated transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                {isEngineOnline ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                  </>
                ) : (
                  <>
                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-warning"></span>
                  </>
                )}
              </span>
              {!collapsed && (
                <span className={`text-[11px] font-medium truncate ${isEngineOnline ? 'text-text-secondary' : 'text-warning'}`}>Engine</span>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={(e) => { e.preventDefault(); toggleCollapse(); }}
                className="text-text-muted hover:text-text-primary p-1 rounded"
              >
                <Icon name="chevron-left" size={14} />
              </button>
            )}
          </Link>
          {collapsed && (
            <button
              onClick={toggleCollapse}
              className="w-full flex justify-center text-text-muted hover:text-text-primary p-1"
            >
              <Icon name="chevron-right" size={14} />
            </button>
          )}
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
