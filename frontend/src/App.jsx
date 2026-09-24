import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { supabase } from './lib/supabase';
import { setAuthToken } from './services/api';
import { ChannelProvider } from './contexts/ChannelContext';
import { JobsProvider } from './hooks/useJobs';
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const StudioShell = lazy(() => import('./pages/Studio/StudioShell'));
const Ideas = lazy(() => import('./pages/Ideas'));
const Scripts = lazy(() => import('./pages/Scripts'));
const Videos = lazy(() => import('./pages/Videos'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const Profile = lazy(() => import('./pages/Profile'));
const Channels = lazy(() => import('./pages/Channels'));
const Publications = lazy(() => import('./pages/Publications'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Costs = lazy(() => import('./pages/Costs'));
const Logs = lazy(() => import('./pages/Logs'));
const Health = lazy(() => import('./pages/Health'));
import AppShell from './components/layout/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
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
        if (session?.access_token) setAuthToken(session.access_token);
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAuthenticated(!!session);
        if (session?.access_token) setAuthToken(session.access_token);
        else setAuthToken(null);
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
        <JobsProvider>
          <Outlet />
        </JobsProvider>
      </ChannelProvider>
  ) : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
    <ErrorBoundary>
      <Toaster position="bottom-right" richColors theme="dark" />
      <Suspense fallback={<div className="min-h-screen bg-canvas flex items-center justify-center text-text-muted">Loading app...</div>}>
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
            <Route path="jobs/:id" element={<JobDetail />} />
            <Route path="best" element={<Videos filter="best" />} />
            <Route path="publications" element={<Publications />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="costs" element={<Costs />} />
            <Route path="channels" element={<Channels />} />
            <Route path="logs" element={<Logs />} />
            <Route path="health" element={<Health />} />
                <Route path="profile" element={<Profile />} />
              </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
    </>
  );
}
