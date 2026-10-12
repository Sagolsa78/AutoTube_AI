import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import Icon from '../../components/Icon';
import TopBar from '../../components/layout/TopBar';
import { api } from '../../services/api';
import { navConfig, getActiveNavItem } from '../../config/navConfig';
import useContentStore from '../../store/contentStore';

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
          ? 'bg-bg-1 text-text-primary font-bold'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-2 font-medium'
      } ${collapsed ? 'justify-center px-2' : ''}`}
    >
      {active && (
         <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-brand rounded-r-full" />
      )}

      <Icon name={item.icon} size={18} className={`shrink-0 ${active ? 'text-text-primary' : 'text-text-muted group-hover:text-text-primary transition-colors'}`} />

      {!collapsed && <span className="truncate flex-1">{item.label}</span>}

      {!collapsed && count > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono tracking-tight font-bold ml-auto ${badgeColor}`}>
          {count > 99 ? '99+' : count}
        </span>
      )}
      {collapsed && count > 0 && (
         <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand border-2 border-bg-0" />
      )}
    </Link>
  );
}

export default function AppShell() {
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('autotube_sidebar_collapsed') === 'true';
  });

  const { getMetrics } = useContentStore();
  const counts = getMetrics();

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('autotube_sidebar_collapsed', String(next));
  };

  return (
    <div className="min-h-screen bg-bg-0 text-text-primary flex flex-col md:flex-row antialiased font-sans">
      {/* ── Desktop Sidebar ─────── */}
      <aside
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen bg-bg-0 border-r border-border z-40 select-none transition-all duration-300 ${
          collapsed ? 'w-[72px]' : 'w-[240px]'
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4">
          <Link to="/app" className="flex items-center gap-2.5 group overflow-hidden" title="AutoTube">
            <span className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white shadow-brand-glow transition-transform group-hover:scale-105 shrink-0">
              <Icon name="film" size={16} />
            </span>
            {!collapsed && (
              <span className="font-bold text-base text-text-primary tracking-tight truncate">
                AutoTube<span className="text-brand">.AI</span>
              </span>
            )}
          </Link>
        </div>

        {/* Primary Action */}
        <div className="px-3 pb-2 pt-2">
           <Link
             to="/app/create"
             className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-brand hover:bg-brand-hover text-white transition-all shadow-brand-glow hover:shadow-lg font-bold group ${collapsed ? 'px-0' : ''}`}
           >
             <Icon name="plus" size={18} className="group-hover:scale-110 transition-transform" />
             {!collapsed && <span>Create video</span>}
           </Link>
        </div>

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
        <div className="p-3 border-t border-border/40 bg-bg-0 space-y-2 shrink-0">
          <button
            onClick={toggleCollapse}
            className={`w-full flex ${collapsed ? 'justify-center' : 'justify-start px-2 gap-3'} items-center p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-2 transition-colors`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={16} />
            {!collapsed && <span className="text-xs font-medium">Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-20 md:pb-8 bg-bg-1">
        <TopBar />
        <main className={`flex-1 w-full flex flex-col ${loc.pathname.startsWith('/app/create') ? '' : 'p-6 lg:p-8 w-full max-w-[1680px] mx-auto'}`}>
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar (<= 768px only) ─────────── */}
      <nav
        className="mobile-only md:hidden fixed bottom-0 inset-x-0 bg-bg-1/95 backdrop-blur-lg border-t border-border z-50 flex items-center justify-around h-[60px] safe-area-bottom select-none shadow-dropdown"
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
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-brand-glow transition-transform active:scale-95 border-2 border-bg-0 ${
                  active ? 'bg-brand text-white' : 'bg-bg-1 text-brand border-brand/20'
                }`}>
                  <Icon name={n.icon} size={22} />
                </div>
                <span className={`text-[10px] font-bold mt-1 ${active ? 'text-brand' : 'text-text-muted'}`}>Create</span>
              </Link>
            );
          }

          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors relative ${
                active ? 'text-brand' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {active && <div className="absolute top-0 inset-x-2 h-[3px] bg-brand rounded-b-md shadow-[0_0_8px_rgba(255,90,77,0.5)]" />}
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
