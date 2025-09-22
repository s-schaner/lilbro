import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ModuleStatus } from '@lib/types';

const statusCopy: Record<ModuleStatus['status'], string> = {
  healthy: 'Module operating normally.',
  degraded: 'Module health degraded. Try again shortly.',
  error: 'Module failed to initialize.',
  disabled: 'Module disabled in configuration.'
};

type ModuleBoundaryProps = {
  moduleId: string;
  modules?: ModuleStatus[];
  onRetry?: () => void;
  children: ReactNode;
};

type ModuleBoundaryState = {
  hasError: boolean;
};

type ErrorBoundaryProps = {
  fallback: (reset: () => void) => ReactNode;
  children: ReactNode;
  onReset?: () => void;
};

class ModuleErrorBoundary extends Component<ErrorBoundaryProps, ModuleBoundaryState> {
  state: ModuleBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ModuleBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error('Module rendering error', error, errorInfo);
  }

  private reset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback(this.reset);
    }
    return this.props.children;
  }
}

type FallbackProps = {
  title: string;
  description: string;
  onRetry?: () => void;
};

const FallbackCard = ({ title, description, onRetry }: FallbackProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-6 text-center text-sm text-slate-300">
    <AlertTriangle className="h-6 w-6 text-amber-400" aria-hidden />
    <div>
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
    {onRetry ? (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <RefreshCw className="h-3 w-3" /> Retry
      </button>
    ) : null}
  </div>
);

const ModuleBoundary = ({ moduleId, modules = [], onRetry, children }: ModuleBoundaryProps) => {
  if (modules.length === 0) {
    return (
      <ModuleErrorBoundary
        onReset={onRetry}
        fallback={(reset) => (
          <FallbackCard title="Module loading" description="Initializing module registry…" onRetry={reset} />
        )}
      >
        {children}
      </ModuleErrorBoundary>
    );
  }
  const module = modules.find((item) => item.id === moduleId);
  if (!module) {
    return <FallbackCard title="Module unavailable" description="Module not registered in manifest." onRetry={onRetry} />;
  }
  if (!module.enabled) {
    return <FallbackCard title={`${module.name} disabled`} description="Enable this module from settings to continue." onRetry={onRetry} />;
  }
  if (module.status === 'error' || module.status === 'degraded') {
    const copy = statusCopy[module.status];
    return (
      <FallbackCard
        title={`${module.name} unavailable`}
        description={copy}
        onRetry={onRetry}
      />
    );
  }
  return (
    <ModuleErrorBoundary
      onReset={onRetry}
      fallback={(reset) => (
        <FallbackCard title={`${module.name} crashed`} description="Component error isolated. Reload to continue." onRetry={reset} />
      )}
    >
      {children}
    </ModuleErrorBoundary>
  );
};

export default ModuleBoundary;
