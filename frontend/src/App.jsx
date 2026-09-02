import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Ideas from './pages/Ideas';
import Scripts from './pages/Scripts';
import Videos from './pages/Videos';
import Profile from './pages/Profile';
import Icon from './components/Icon';
import './index.css';

const nav = [
  { to: '/',         label: 'Dashboard', icon: 'home' },
  { to: '/ideas',    label: 'Ideas',     icon: 'layers' },
  { to: '/scripts',  label: 'Scripts',   icon: 'fileText' },
  { to: '/videos',   label: 'Videos',    icon: 'video' },
];

const accountNav = [
  { to: '/profile',  label: 'Settings',  icon: 'settings' },
];

function NavItem({ to, label, icon }) {
  const loc = useLocation();
  const active = to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to);
  return (
    <Link to={to} className={`nav-item${active ? ' active' : ''}`}>
      <Icon name={icon} /> {label}
    </Link>
  );
}

export default function App() {
  const loc = useLocation();
  const titles = { '/': 'Dashboard', '/ideas': 'Ideas', '/scripts': 'Scripts', '/videos': 'Videos', '/profile': 'Settings' };
  const pageTitle = Object.entries(titles).find(([k]) => k === '/' ? loc.pathname === '/' : loc.pathname.startsWith(k));

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
          <div className="nav-section">Account</div>
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
            <Link to="/profile" className="btn btn-sm btn-secondary"><Icon name="settings" size={14} /> Settings</Link>
          </div>
        </header>
        <div className="page">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/ideas" element={<Ideas />} />
            <Route path="/scripts" element={<Scripts />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
