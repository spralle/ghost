import { Component, type ErrorInfo, type ReactNode } from "react";

export interface GhostNavigationErrorBoundaryProps {
  /** Component to render on error. Receives error and reset function. */
  readonly fallback: (props: { error: Error; resetError: () => void }) => ReactNode;
  readonly children: ReactNode;
}

interface State {
  error: Error | null;
}

export class GhostNavigationErrorBoundary extends Component<GhostNavigationErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[GhostNavigationErrorBoundary]", error, info.componentStack);
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback({ error: this.state.error, resetError: this.resetError });
    }
    return this.props.children;
  }
}
