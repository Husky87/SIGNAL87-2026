import React from 'react';

interface Props { children: React.ReactNode; }
interface State { error: Error | null; componentStack: string; }

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Signal87 application error:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack || '' });
  }

  private reload = () => window.location.reload();

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message || String(this.state.error);
    const details = this.state.componentStack
      ? `${message}\n\nComponent stack:\n${this.state.componentStack}`
      : message;

    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#FAFAF8', color: '#1B1B18', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
        <section style={{ width: 'min(560px, 100%)', background: '#fff', border: '1px solid #E4E2DB', borderRadius: 16, padding: 28, boxShadow: '0 10px 30px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#B3690F', marginBottom: 10 }}>Signal87 recovered from an application error</div>
          <h1 style={{ margin: '0 0 10px', fontSize: 24 }}>The app hit a browser compatibility error.</h1>
          <p style={{ margin: '0 0 18px', lineHeight: 1.6, color: '#55534C' }}>
            Reload the page. If the problem continues, the technical error is shown below so it can be diagnosed without leaving you with a blank screen.
          </p>
          <pre style={{ margin: '0 0 18px', padding: 14, borderRadius: 10, background: '#F2F1EC', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12, color: '#55534C', maxHeight: 320, overflow: 'auto' }}>
            {details}
          </pre>
          <button type="button" onClick={this.reload} style={{ border: 0, borderRadius: 999, padding: '11px 18px', background: '#0E7C8C', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Reload Signal87
          </button>
        </section>
      </main>
    );
  }
}
