import { Component, type ErrorInfo, type ReactNode } from 'react';

import { useModule, useModules } from '@context/ModuleContext';

class InternalErrorBoundary extends Component<
  {
    onRetry: () => void;
    children: ReactNode;
    moduleName: string;
  },
  { hasError: boolean }
> {
  public state = { hasError: false };

  public static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Module render failure', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onRetry();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center text-sm text-red-200">
          <p className="font-semibold">{this.props.moduleName} encountered an error.</p>
          <p className="mt-1 text-xs text-red-100">Module unavailable (retry).</p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-3 rounded-lg border border-red-400 px-3 py-1 text-xs font-semibold text-red-100 transition hover:bg-red-500/20"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const ModuleBoundary = ({ moduleId, children }: { moduleId: string; children: ReactNode }) => {
  const module = useModule(moduleId);
  const { refresh } = useModules();

  if (!module || !module.enabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-300">
        <p className="font-semibold">Module disabled</p>
        <p className="mt-1 text-xs text-slate-400">Enable it in settings to resume.</p>
      </div>
    );
  }

  if (module.status !== 'healthy') {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-center text-sm text-amber-100">
        <p className="font-semibold">{module.name} is {module.status}.</p>
        <p className="mt-1 text-xs text-amber-200">
          {module.last_error ? module.last_error : 'Watchdog marked the module degraded. Try again shortly.'}
        </p>
        <button
          type="button"
          onClick={() => {
            void refresh();
          }}
          className="mt-3 rounded-lg border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/20"
        >
          Refresh status
        </button>
      </div>
    );
  }

  return (
    <InternalErrorBoundary onRetry={refresh} moduleName={module.name}>
      {children}
    </InternalErrorBoundary>
  );
};

export default ModuleBoundary;
