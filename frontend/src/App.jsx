import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
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
import AppShell from './components/layout/AppShell';
import { Toaster } from 'sonner';
import './index.css';

export default function App() {
  return (
    <>
      <Toaster position="bottom-right" richColors theme="dark" />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="create" element={<StudioShell />} />
          <Route path="ideas" element={<Ideas />} />
          <Route path="scripts" element={<Scripts />} />
          <Route path="videos" element={<Videos />} />
          <Route path="best" element={<Videos filter="best" />} />
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
