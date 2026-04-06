import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('MailFlow error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: 16, fontFamily: 'Arial, sans-serif',
          background: '#f8fafc', color: '#1e293b',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <h2 style={{ margin: 0, fontSize: 20 }}>Something went wrong</h2>
          <p style={{ margin: 0, color: '#64748b', maxWidth: 400, textAlign: 'center' }}>
            MailFlow encountered an unexpected error. Try refreshing the page.
          </p>
          {this.state.error && (
            <pre style={{
              margin: '8px 0 0', padding: '10px 14px', background: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: 6, fontSize: 12,
              color: '#dc2626', maxWidth: 480, overflowX: 'auto', textAlign: 'left',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '8px 20px', border: 'none', borderRadius: 6,
              background: '#1e3a5f', color: 'white', cursor: 'pointer', fontSize: 14,
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
