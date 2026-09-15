import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import Icon from '../Icon';
import TopBar from './TopBar';

const workspaceNav = [
  { to: '/app', label: 'Home', icon: 'home' },
  { to: '/app/create', label: 'Create', icon: 'plus-circle', primary: true },
  { to: '/app/ideas', label: 'Ideas', icon: 'lightbulb' },
  { to: '/app/scripts', label: 'Scripts', icon: 'fileText' },
  { to: '/app/videos', label: 'Library', icon: 'video' },
];

const publishNav = [
  { to: '/app/publications', label: 'Publications', icon: 'youtube' },
];

const insightsNav = [
  { to: '/app/analytics', label: 'Analytics', icon: 'barChart' },
];

const systemNav = [
  { to: '/app/channels', label: 'Channels', icon: 'hash' },
  { to: '/app/logs', label: 'Activity Logs', icon: 'activity' },
  { to: '/app/health', label: 'System Health', icon: 'heart' },
  { to: '/app/profile', label: 'Settings', icon: 'settings' },
];

// Mobile bottom nav items
const mobileNav = [
  { to: '/app', label: 'Home', icon: 'home' },
  { to: '/app/videos', label: 'Library', icon: 'video' },
  { to: '/app/create', label: 'Create', icon: 'plus-circle', isCenter: true },
  { to: '/app/ideas', label: 'Ideas', icon: 'lightbulb' },
  { to: '/app/profile', label: 'More', icon: 'menu' },
];

function NavItem({ to, label, icon, primary, collapsed }) {
  const loc = useLocation();
  const active = to === '/app' ? loc.pathname === '/app' : loc.pathname.startsWith(to);

  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all select-none ${
        active
          ? (primary 
              ? 'bg-brand-red text-white shadow-brand-glow' 
              : 'bg-elevated text-text-primary border border-border')
          : (primary
              ? 'text-brand-red hover:bg-brand-red/10 border border-brand-red/20'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover')
      } ${collapsed ? 'justify-center px-2' : ''}`}
    >
      <Icon name={icon} size={17} className={active ? 'text-current' : primary ? 'text-brand-red' : 'text-text-muted'} />
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

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('autotube_sidebar_collapsed', String(next));
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col md:flex-row antialiased">
      {/* ── Desktop Sidebar ─────── */}
      <aside 
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen bg-surface border-r border-border z-40 select-none transition-all duration-300 ${
          collapsed ? 'w-[68px]' : 'w-[230px]'
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border">
          <Link to="/app" className="flex items-center gap-2.5 group overflow-hidden">
            <span className="w-8 h-8 rounded-lg bg-brand-red flex items-center justify-center text-white shadow-brand-glow transition-transform group-hover:scale-105 shrink-0">
              <Icon name="film" size={16} />
            </span>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm text-text-primary tracking-tight leading-tight truncate">
                  AutoTube<span className="text-brand-red">.AI</span>
                </span>
                <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                  OS v1.0
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={toggleCollapse}
            className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-surface-hover transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={14} />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5 hide-scrollbar">
          {/* Workspace */}
          <nav className="space-y-1">
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Workspace
              </div>
            )}
            {workspaceNav.map(n => <NavItem key={n.to} {...n} collapsed={collapsed} />)}
          </nav>

          {/* Publish */}
          <nav className="space-y-1">
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Publish
              </div>
            )}
            {publishNav.map(n => <NavItem key={n.to} {...n} collapsed={collapsed} />)}
          </nav>

          {/* Insights */}
          <nav className="space-y-1">
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Insights
              </div>
            )}
            {insightsNav.map(n => <NavItem key={n.to} {...n} collapsed={collapsed} />)}
          </nav>

          {/* System */}
          <nav className="space-y-1">
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                System
              </div>
            )}
            {systemNav.map(n => <NavItem key={n.to} {...n} collapsed={collapsed} />)}
          </nav>
        </div>

        {/* System Footer Status */}
        <div className="p-2.5 border-t border-border bg-surface/60">
          <Link
            to="/app/health"
            className="flex items-center justify-between p-2 rounded-lg bg-elevated/70 text-xs border border-border hover:border-border-strong transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              {!collapsed && (
                <span className="text-[11px] font-medium text-text-secondary truncate">Engine Online</span>
              )}
            </div>
            {!collapsed && (
              <span className="text-[10px] text-text-muted font-mono">
                Cluster
              </span>
            )}
          </Link>
        </div>
      </aside>

      {/* ── Main Content Area ─────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-20 md:pb-8">
        <TopBar />
        <main className="flex-1 w-full pt-4 sm:pt-6">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar (<= 768px only) ─────────── */}
      <nav 
        className="mobile-only md:hidden fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur-lg border-t border-border z-50 flex items-center justify-around h-[60px] safe-area-bottom select-none shadow-dropdown"
        aria-label="Mobile Navigation"
      >
        {mobileNav.map(n => {
          const active = n.to === '/app' ? loc.pathname === '/app' : loc.pathname.startsWith(n.to);
          
          if (n.isCenter) {
            return (
              <Link 
                key={n.to} 
                to={n.to}
                className="flex flex-col items-center justify-center -mt-4 group"
              >
                <div className="w-12 h-12 rounded-full bg-brand-red text-white flex items-center justify-center shadow-brand-glow transition-transform active:scale-95 border-2 border-canvas">
                  <Icon name={n.icon} size={22} />
                </div>
                <span className="text-[10px] font-bold text-brand-red mt-1">Create</span>
              </Link>
            );
          }

          return (
            <Link 
              key={n.to} 
              to={n.to}
              className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors ${
                active ? 'text-brand-red' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
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
