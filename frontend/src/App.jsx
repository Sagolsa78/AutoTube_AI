import { Routes, Route, Link, useLocation, Navigate, Outlet } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import StudioShell from './pages/Studio/StudioShell';
import Ideas from './pages/Ideas';
import Scripts from './pages/Scripts';
import Videos from './pages/Videos';
import Profile from './pages/Profile';
import Channels from './pages/Channels';
import Publications from './pages/Publications';
import Analytics from './pages/Analytics';
import Logs from './pages/Logs';
import Health from './pages/Health';
import Icon from './components/Icon';
import { Toaster } from 'sonner';
import './index.css';

const nav = [
  { to: '/app',             label: 'Dashboard',    icon: 'home' },
  { to: '/app/create',      label: 'Create Short',  icon: 'plus', primary: true },
  { to: '/app/videos',       label: 'Videos',       icon: 'video' },
  { to: '/app/publications', label: 'Publications', icon: 'youtube' },
  { to: '/app/analytics',    label: 'Analytics',    icon: 'activity' },
];

const libraryNav = [
  { to: '/app/ideas',        label: 'Ideas',        icon: 'layers' },
  { to: '/app/scripts',      label: 'Scripts',      icon: 'fileText' },
];

const accountNav = [
  { to: '/app/channels', label: 'Channels',  icon: 'hash' },
  { to: '/app/logs',     label: 'Activity',  icon: 'activity' },
  { to: '/app/health',   label: 'Health',    icon: 'heart' },
  { to: '/app/profile',  label: 'Settings',  icon: 'settings' },
];

function NavItem({ to, label, icon, primary }) {
  const loc = useLocation();
  const active = to === '/app' ? loc.pathname === '/app' : loc.pathname.startsWith(to);
  return (
    <Link to={to} className={`nav-item${active ? ' active' : ''}${primary ? ' nav-primary' : ''}`}>
      <Icon name={icon} /> {label}
    </Link>
  );
}

function StudioLayout() {
  const loc = useLocation();
  const titles = { 
    '/app': 'Dashboard', 
    '/app/create': 'Create Short',
    '/app/ideas': 'Ideas', 
    '/app/scripts': 'Scripts', 
    '/app/videos': 'Videos', 
    '/app/publications': 'Publications',
    '/app/analytics': 'Analytics & Telemetry',
    '/app/channels': 'Channels',
    '/app/logs': 'Activity & Logs',
    '/app/health': 'System Health',
    '/app/profile': 'Settings' 
  };
  const pageTitle = Object.entries(titles).find(([k]) => k === '/app' ? loc.pathname === '/app' : loc.pathname.startsWith(k));

  return (
    <div className="app">
      <aside className="sidebar" role="navigation" aria-label="Main navigation">
        <div className="sidebar-brand">
          <div className="brand-icon"><Icon name="sparkles" size={18} /></div>
          <div>
            <div className="brand-text">AutoShorts</div>
            <div className="brand-sub">Studio v2</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">Production</div>
          {nav.map(n => <NavItem key={n.to} {...n} />)}
          <div className="nav-section">Library</div>
          {libraryNav.map(n => <NavItem key={n.to} {...n} />)}
          <div className="nav-section">System</div>
          {accountNav.map(n => <NavItem key={n.to} {...n} />)}
        </nav>

        <div className="sidebar-footer">
          <div className="status-dot"><span className="dot" /> Engine Online</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span className="topbar-title">{pageTitle?.[1] || 'AutoShorts Studio'}</span>
          <div className="topbar-right">
            <Link to="/app/create" className="btn btn-sm btn-primary"><Icon name="plus" size={14} /> New Short</Link>
            <Link to="/app/profile" className="btn btn-sm btn-secondary"><Icon name="settings" size={14} /> Settings</Link>
          </div>
        </header>
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Toaster position="bottom-right" richColors theme="dark" />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<StudioLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="create" element={<StudioShell />} />
          <Route path="ideas" element={<Ideas />} />
          <Route path="scripts" element={<Scripts />} />
          <Route path="videos" element={<Videos />} />
          <Route path="publications" element={<Publications />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="channels" element={<Channels />} />
          <Route path="logs" element={<Logs />} />
          <Route path="health" element={<Health />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
