import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import Button from './Button';
import GridContainer from './layout/GridContainer';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Frontend UI Crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <GridContainer>
          <div className="min-h-[80vh] flex items-center justify-center py-20">
            <div className="bg-surface border border-border rounded-xl p-8 max-w-md w-full text-center space-y-6 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-brand-red/10 flex items-center justify-center mx-auto text-brand-red">
                <Icon name="alert-triangle" size={32} />
              </div>
              
              <div>
                <h2 className="text-xl font-bold text-text-primary mb-2">Something went wrong</h2>
                <p className="text-sm text-text-secondary">
                  The application encountered an unexpected error. Technical details have been logged to the console.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <Button variant="primary" icon="refresh-cw" onClick={() => window.location.reload()}>
                  Retry & Reload
                </Button>
                <Link to="/app">
                  <Button variant="secondary" icon="home" className="w-full">
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </GridContainer>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
