import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { setAuthToken, api } from './services/api';
import { ChannelProvider } from './contexts/ChannelContext';
import { JobsProvider } from './hooks/useJobs';
const Landing = lazy(() => import('./app/features/landing/Landing'));
const Login = lazy(() => import('./app/features/auth/Login'));
const Register = lazy(() => import('./app/features/auth/Register'));
const Dashboard = lazy(() => import('./app/features/dashboard/Dashboard'));
const StudioShell = lazy(() => import('./app/features/studio/StudioLayout'));
const Ideas = lazy(() => import('./app/features/ideation/Ideas'));
const Scripts = lazy(() => import('./app/features/ideation/Scripts'));
const Videos = lazy(() => import('./app/features/content/Content'));
const Calendar = lazy(() => import('./app/features/calendar/Calendar'));
const JobDetail = lazy(() => import('./app/features/system/JobDetail'));
const Profile = lazy(() => import('./app/features/settings/Profile'));
const Channels = lazy(() => import('./app/features/settings/Channels'));
const Publications = lazy(() => import('./app/features/publishing/Publications'));
const Analytics = lazy(() => import('./app/features/analytics/Analytics'));
const Costs = lazy(() => import('./app/features/settings/Costs'));
const Logs = lazy(() => import('./app/features/system/Logs'));
const Health = lazy(() => import('./app/features/system/Health'));
import AppShell from './app/layouts/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from 'sonner';
import './index.css';

// ProtectedRoute verifies auth via localStorage token or Supabase
function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const localToken = localStorage.getItem('autotube_auth_token');
      if (localToken) {
        try {
          // Phase 19: Cache / Stale Data - Ensure active user is consistent from backend
          const me = await api.getMe();
          if (me) {
            setIsAuthenticated(true);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.warn("Invalid or stale local token, redirecting to login");
          localStorage.removeItem('autotube_auth_token');
        }
      }

      setIsAuthenticated(false);
      setLoading(false);
    };

    checkAuth();
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
            <Route path="calendar" element={<Calendar />} />
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
