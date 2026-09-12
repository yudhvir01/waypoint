import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

// Without this, any render-time exception unmounts the whole tree and
// leaves a blank white page with nothing to act on.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Waypoint crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Waypoint hit an error it couldn't recover from. Your data is safe in
          your Supabase project — reloading usually clears it.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          {this.state.error.message}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Reload
        </button>
      </div>
    );
  }
}
