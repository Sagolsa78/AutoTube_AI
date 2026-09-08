import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import Icon from '../Icon';
import TopBar from './TopBar';

const primaryNav = [
  { to: '/app', label: 'Home', icon: 'home' },
  { to: '/app/create', label: 'Create', icon: 'plus-circle', primary: true },
  { to: '/app/ideas', label: 'Ideas', icon: 'lightbulb' },
  { to: '/app/scripts', label: 'Scripts', icon: 'fileText' },
  { to: '/app/videos', label: 'Videos', icon: 'video' },
  { to: '/app/best', label: 'Best', icon: 'star' },
  { to: '/app/publications', label: 'Publications', icon: 'youtube' },
  { to: '/app/analytics', label: 'Analytics', icon: 'barChart' },
];

const secondaryNav = [
  { to: '/app/channels', label: 'Channels', icon: 'hash' },
  { to: '/app/logs', label: 'Activity', icon: 'activity' },
  { to: '/app/health', label: 'Health', icon: 'heart' },
  { to: '/app/profile', label: 'Settings', icon: 'settings' },
];

// Mobile bottom nav items (Section 15: Home, Queue, Create, Library, More)
const mobileNav = [
  { to: '/app', label: 'Home', icon: 'home' },
  { to: '/app/videos', label: 'Queue', icon: 'video' },
  { to: '/app/create', label: 'Create', icon: 'plus-circle', isCenter: true },
  { to: '/app/scripts', label: 'Library', icon: 'folder' },
  { to: '/app/profile', label: 'More', icon: 'menu' },
];

function NavItem({ to, label, icon, primary }) {
  const loc = useLocation();
  const active = to === '/app' ? loc.pathname === '/app' : loc.pathname.startsWith(to);

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all select-none ${
        active
          ? (primary 
              ? 'bg-brand-red text-white shadow-brand-glow' 
              : 'bg-elevated text-text-primary border border-border')
          : (primary
              ? 'text-brand-red hover:bg-brand-red/10 border border-brand-red/20'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover')
      }`}
    >
      <Icon name={icon} size={16} className={active ? 'text-current' : primary ? 'text-brand-red' : 'text-text-muted'} />
      <span>{label}</span>
      {active && !primary && (
        <span className="w-1.5 h-1.5 rounded-full bg-brand-red ml-auto" />
      )}
    </Link>
  );
}

export default function AppShell() {
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col md:flex-row antialiased">
      {/* ── Desktop Sidebar (Fixed 240px, strictly hidden on mobile) ─────── */}
      <aside 
        className="hidden md:flex flex-col w-[240px] shrink-0 sticky top-0 h-screen bg-surface border-r border-border z-40 select-none"
        aria-label="Sidebar Navigation"
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center px-5 border-b border-border">
          <Link to="/app" className="flex items-center gap-2.5 group">
            <span className="w-8 h-8 rounded-lg bg-brand-red flex items-center justify-center text-white shadow-brand-glow transition-transform group-hover:scale-105">
              <Icon name="film" size={16} />
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-text-primary tracking-tight leading-tight">
                AutoTube<span className="text-brand-red">.AI</span>
              </span>
              <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                Studio v2.0
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 hide-scrollbar">
          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">
              Production
            </div>
            {primaryNav.map(n => <NavItem key={n.to} {...n} />)}
          </nav>

          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">
              System
            </div>
            {secondaryNav.map(n => <NavItem key={n.to} {...n} />)}
          </nav>
        </div>

        {/* System Footer Status */}
        <div className="p-3 border-t border-border bg-surface/50">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-elevated/60 text-xs border border-border/60">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span className="text-[11px] font-medium text-text-secondary">Engine Online</span>
            </div>
            <Link to="/app/health" className="text-[10px] text-text-muted hover:text-text-primary font-mono transition-colors">
              Cluster
            </Link>
          </div>
        </div>
      </aside>

      {/* ── Main Workspace Area (Fluid width across 1024, 1440, 1920) ─────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-20 md:pb-8">
        <TopBar />
        <main className="flex-1 w-full pt-4 sm:pt-6">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar (Strictly <= 768px only) ─────────── */}
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
