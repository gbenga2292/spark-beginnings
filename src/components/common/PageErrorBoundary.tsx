import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Optional label shown in the fallback (e.g. "Payroll") */
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Lightweight per-page error boundary.
 * Catches render/lazy-load errors and shows a scoped recovery UI
 * instead of crashing the entire application.
 */
export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[PageErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const label = this.props.label ?? 'this page';

    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Something went wrong loading {label}
          </p>
          <p className="mt-1 text-xs text-slate-400 max-w-sm">
            {this.state.message}
          </p>
        </div>
        <button
          onClick={this.handleReset}
          className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg
                     bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700
                     text-slate-700 dark:text-slate-200 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      </div>
    );
  }
}
