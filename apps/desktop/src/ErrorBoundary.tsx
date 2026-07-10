import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="view">
          <h1>Error</h1>
          <p className="view-sub" style={{ color: "var(--error)" }}>{this.state.error.message}</p>
          <button className="settings-btn" onClick={() => this.setState({ error: null })} style={{ marginTop: 16 }}>Reintentar</button>
        </div>
      );
    }
    return this.props.children;
  }
}
