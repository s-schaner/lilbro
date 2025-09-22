import { FC } from 'react';
import { X, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { ModuleStatus } from '@lib/types';

const statusColor: Record<ModuleStatus['status'], string> = {
  healthy: 'bg-emerald-500/20 text-emerald-300',
  degraded: 'bg-amber-500/20 text-amber-300',
  error: 'bg-red-500/20 text-red-300',
  disabled: 'bg-slate-700 text-slate-300'
};

type Props = {
  open: boolean;
  modules: ModuleStatus[];
  onClose: () => void;
  onToggle: (moduleId: string, enabled: boolean) => void;
  onRefresh?: () => void;
};

const ModuleSettingsModal: FC<Props> = ({ open, modules, onClose, onToggle, onRefresh }) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Module Supervisor</h2>
            <p className="text-xs text-slate-400">Enable or disable optional capabilities. Core modules are always on.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <X className="h-4 w-4" aria-hidden />
              <span className="sr-only">Close settings</span>
            </button>
          </div>
        </header>
        <div className="mt-6 grid max-h-[400px] gap-3 overflow-y-auto pr-2">
          {modules.map((module) => (
            <div
              key={module.id}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-200 shadow-inner shadow-slate-950/40"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{module.name}</p>
                  <p className="text-xs text-slate-400">Version {module.version}</p>
                </div>
                <span className={clsx('rounded-full px-2 py-1 text-[11px] font-semibold', statusColor[module.status])}>
                  {module.status.toUpperCase()}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <div>
                  {module.last_checked ? <p>Last check: {new Date(module.last_checked).toLocaleTimeString()}</p> : null}
                  {module.last_error ? <p className="text-amber-300">{module.last_error}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Toggle</span>
                  <button
                    type="button"
                    disabled={!module.optional}
                    onClick={() => onToggle(module.id, !module.enabled)}
                    className={clsx(
                      'relative inline-flex h-6 w-12 items-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-primary-500',
                      module.enabled ? 'border-primary-500 bg-primary-500/70' : 'border-slate-700 bg-slate-800',
                      !module.optional && 'opacity-40'
                    )}
                  >
                    <span
                      className={clsx(
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
                        module.enabled ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                    <span className="sr-only">Toggle {module.name}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ModuleSettingsModal;
