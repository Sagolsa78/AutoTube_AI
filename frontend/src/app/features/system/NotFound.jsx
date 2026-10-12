import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../components/Icon';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-0 flex flex-col items-center justify-center p-6 text-center text-text-primary">
      <div className="w-16 h-16 rounded-2xl bg-bg-2 border border-border flex items-center justify-center text-brand mb-6 shadow-brand-glow">
        <Icon name="alert-triangle" size={32} />
      </div>
      <h1 className="text-3xl font-bold mb-2 tracking-tight">Page Not Found</h1>
      <p className="text-text-secondary max-w-md mb-8">
        The page you are looking for doesn't exist or has been moved. Let's get you back to the command center.
      </p>
      <Link to="/app" className="btn btn-primary btn-lg font-bold">
        <Icon name="home" size={18} />
        Back to Dashboard
      </Link>
    </div>
  );
}
