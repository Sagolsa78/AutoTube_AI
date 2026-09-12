import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setAuthToken } from '../services/api';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { toast } from 'sonner';

export default function Register() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [channelName, setChannelName] = useState('');
  const [niche, setNiche] = useState('science_wow');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Email and password are required');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({
        email: email.trim(),
        password: password.trim(),
        display_name: displayName.trim() || email.split('@')[0],
        channel_name: channelName.trim() || 'My Shorts Channel',
        niche: niche
      });

      if (res && res.access_token) {
        setAuthToken(res.access_token);
        toast.success('Account created successfully! Welcome to AutoTube.');
        setTimeout(() => {
          navigate('/app');
        }, 300);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        
        {/* Ambient Glow */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-brand-red opacity-10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-brand-red opacity-10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-14 h-14 bg-surface-input rounded-2xl flex items-center justify-center border border-border mb-4">
            <Icon name="user" size={26} className="text-brand-red" />
          </div>
          
          <h1 className="text-2xl font-black mb-1 tracking-tight text-center">Create Creator Account</h1>
          <p className="text-xs text-text-muted text-center mb-6">
            Multi-user studio workspace with isolated channels & AI pipelines
          </p>

          <form onSubmit={handleRegister} className="w-full space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                  Creator Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Hunter"
                  className="w-full bg-surface-input border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:border-brand-red focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                  Channel Name
                </label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="e.g. Quantum Curiosities"
                  className="w-full bg-surface-input border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:border-brand-red focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="creator@example.com"
                className="w-full bg-surface-input border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:border-brand-red focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                Password * (min 6 chars)
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-input border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:border-brand-red focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                Default Content Niche
              </label>
              <select
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="w-full bg-surface-input border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:border-brand-red focus:outline-none transition-colors cursor-pointer"
              >
                <option value="science_wow">Science & Mind-Blowing Facts</option>
                <option value="tech_mysteries">Technology & Cyber Mysteries</option>
                <option value="kids_facts">Curious Kids Facts</option>
                <option value="history_secrets">Historical Enigmas</option>
              </select>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center shadow-brand-glow py-3"
                loading={loading}
                disabled={loading}
              >
                Register & Enter Studio
              </Button>

              <div className="text-center pt-2">
                <span className="text-xs text-text-muted">Already have an account? </span>
                <Link to="/login" className="text-xs text-brand-red font-semibold hover:underline">
                  Sign In
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
