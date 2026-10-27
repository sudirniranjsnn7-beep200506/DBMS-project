// ==============================================================================
// AssetVault: Global React Error Boundary
// Course: BCSE307L Database Systems (Fall 2026-27)
// Gracefully catches rendering errors with a user-friendly recovery interface
// ==============================================================================

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/40 shadow-sm m-4">
          <div className="w-14 h-14 flex items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mb-4">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
            An unexpected error occurred while rendering this component.
            {this.state.error?.message && (
              <span className="block mt-2 font-mono text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2 rounded border border-rose-200 dark:border-rose-900/30">
                {this.state.error.message}
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <Home className="w-4 h-4" />
              Go to Dashboard
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
