import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '40px',
            color: '#ffffff',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', marginBottom: '12px' }}>Ocurrió un error en esta vista</h2>
          <pre
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '12px 16px',
              borderRadius: '8px',
              maxWidth: '600px',
              overflow: 'auto',
              fontSize: '0.82rem',
              color: '#f87171',
              marginBottom: '20px',
            }}
          >
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            type="button"
            className="settings__button settings__button--primary"
            onClick={this.handleReload}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
