import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setAuthToken } from '../services/api';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // If already logged in, redirect to /app
  useEffect(() => {
    const localToken = localStorage.getItem('autotube_auth_token');
    if (localToken) {
      navigate('/app');
      return;
    }
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          navigate('/app');
        }
      });
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error('Please enter an email and password');
      return;
    }

    setLoading(true);

    try {
      // 1. Try Native Backend Auth
      const res = await api.login({ email: email.trim(), password: password.trim() });
      if (res && res.access_token) {
        setAuthToken(res.access_token);
        toast.success(`Welcome back, ${res.user?.display_name || 'Creator'}!`);
        setTimeout(() => {
          navigate('/app');
        }, 300);
        return;
      }
    } catch (apiErr) {
      // If native login fails, try Supabase if configured
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (!error && data?.session) {
          toast.success('Login successful. Redirecting...');
          setTimeout(() => {
            navigate('/app');
          }, 300);
          return;
        }
      }
      toast.error(apiErr.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleDevQuickLogin = async () => {
    setLoading(true);
    try {
      // Try to log in or register local dev user
      try {
        const res = await api.login({ email: 'user@local.dev', password: 'password123' });
        if (res?.access_token) {
          setAuthToken(res.access_token);
          toast.success('Local Dev Session initialized');
          navigate('/app');
          return;
        }
      } catch {
        // Try registering dev user
        const res = await api.register({
          email: 'user@local.dev',
          password: 'password123',
          display_name: 'Local Creator',
          channel_name: 'Local Shorts Channel'
        });
        if (res?.access_token) {
          setAuthToken(res.access_token);
          toast.success('Local Dev Account created');
          navigate('/app');
          return;
        }
      }
      // Fallback
      setAuthToken('default-user');
      toast.success('Logged in as default user');
      navigate('/app');
    } catch (e) {
      setAuthToken('default-user');
      navigate('/app');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        
        {/* Glow effect */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-brand-red opacity-10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-brand-red opacity-10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-surface-input rounded-2xl flex items-center justify-center border border-border mb-6">
            <Icon name="lock" size={28} className="text-brand-red" />
          </div>
          
          <h1 className="text-2xl font-black mb-1 tracking-tight text-center">AutoTube Studio Login</h1>
          <p className="text-xs text-text-muted text-center mb-6">
            Sign in to your creator workspace and production engine
          </p>

          <form onSubmit={handleLogin} className="w-full space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="creator@example.com"
                className="w-full bg-surface-input border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-red focus:outline-none transition-colors"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-input border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-red focus:outline-none transition-colors"
              />
            </div>
            
            <div className="pt-2 flex flex-col gap-3">
              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center shadow-brand-glow py-3"
                loading={loading}
                disabled={loading}
              >
                Sign In
              </Button>

              <Link
                to="/register"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-primary hover:bg-surface-hover transition-colors text-center"
              >
                <Icon name="user-plus" size={16} />
                <span>Create New Account</span>
              </Link>
            </div>
          </form>

          {/* Quick Local Dev Login */}
          <div className="mt-6 pt-4 border-t border-border w-full flex flex-col items-center">
            <button
              type="button"
              onClick={handleDevQuickLogin}
              className="text-xs text-text-muted hover:text-brand-red transition-colors flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-surface-input"
            >
              <Icon name="zap" size={13} className="text-brand-red" />
              <span>Quick Dev Login (Single-Click)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
