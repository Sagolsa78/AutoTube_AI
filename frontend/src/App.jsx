import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { ChannelProvider } from './contexts/ChannelContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
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

// ProtectedRoute verifies auth via localStorage token or Supabase
function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // 1. Check local native token
    const localToken = localStorage.getItem('autotube_auth_token');
    if (localToken) {
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    // 2. Supabase fallback check
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setIsAuthenticated(!!session);
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAuthenticated(!!session);
      });

      return () => subscription.unsubscribe();
    }

    setIsAuthenticated(false);
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-canvas flex items-center justify-center text-text-muted">Loading...</div>;
  }

  return isAuthenticated ? (
      <ChannelProvider>
          <Outlet />
      </ChannelProvider>
  ) : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <Toaster position="bottom-right" richColors theme="dark" />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Application Routes */}
        <Route element={<ProtectedRoute />}>
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
