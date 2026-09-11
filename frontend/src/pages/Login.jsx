import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAuthToken } from '../services/api';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { toast } from 'sonner';

export default function Login() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      toast.error('Please enter an API Key');
      return;
    }
    setLoading(true);
    setAuthToken(apiKey.trim());
    toast.success('Key saved. Redirecting...');
    setTimeout(() => {
      navigate('/app');
    }, 500);
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Glow effect */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-brand-red opacity-10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-brand-red opacity-10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-surface-input rounded-2xl flex items-center justify-center border border-border mb-6">
            <Icon name="lock" size={28} className="text-brand-red" />
          </div>
          
          <h1 className="text-2xl font-black mb-2 tracking-tight text-center">AutoTube Cloud Login</h1>
          <p className="text-sm text-text-muted text-center mb-8">
            Enter your access token to continue to the studio.
          </p>

          <form onSubmit={handleLogin} className="w-full space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Access Token</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-surface-input border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-red focus:outline-none transition-colors"
                autoFocus
              />
            </div>
            
            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center shadow-brand-glow"
              loading={loading}
              disabled={loading}
            >
              Sign In
            </Button>
          </form>
          
          <div className="mt-8 text-center text-xs text-text-muted">
            <p>Running locally? Ensure AUTH_DISABLED=true is set in your backend.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
