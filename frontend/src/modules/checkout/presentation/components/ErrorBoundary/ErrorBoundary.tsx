import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production the logger is a noop, so this won't leak to the console.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={s.page} role="alert" aria-live="assertive">
        <div style={s.card}>
          <span style={s.icon} aria-hidden="true">⚠</span>
          <h2 style={s.title}>Algo salió mal</h2>
          <p style={s.message}>
            Ocurrió un error inesperado. Por favor intenta de nuevo.
          </p>
          <button style={s.btn} onClick={this.handleRetry}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)', padding: '0 16px',
  },
  card: {
    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16,
    padding: '40px 32px', maxWidth: 360, width: '100%', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  },
  icon: { fontSize: 40 },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 },
  message: { fontSize: 14, color: 'var(--muted)', margin: 0, lineHeight: 1.5 },
  btn: {
    background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 10,
    padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
    marginTop: 8, fontFamily: 'inherit',
  },
};
