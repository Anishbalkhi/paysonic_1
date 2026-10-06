import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0f17',
          color: '#f8fafc',
          padding: '24px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <div style={{
            background: '#131b26',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            padding: '36px 32px',
            maxWidth: '520px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              fontSize: '24px',
            }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '10px', color: '#ffffff' }}>
              Application Error
            </h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '24px' }}>
              An unexpected render issue occurred. Your session is safe. Click below to refresh or return to the dashboard.
            </p>
            {this.state.error?.message && (
              <pre style={{
                background: '#0a0e14',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#f87171',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '20px',
              }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#1e293b',
                  color: '#cbd5e1',
                  border: '1px solid #334155',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
