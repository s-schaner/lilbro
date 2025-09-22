import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { ModuleHealth } from '../data/types';

interface Props {
  modules: ModuleHealth[];
}

export const ModuleHealthList: React.FC<Props> = ({ modules }) => (
  <ul className="space-y-2">
    {modules.map((module) => (
      <li
        key={module.name}
        className="flex items-center justify-between rounded-md bg-slate-900 border border-slate-800 px-3 py-2"
      >
        <span className="text-sm font-medium capitalize">{module.name.replace('-', ' ')}</span>
        <span className="flex items-center gap-1 text-xs">
          {module.status === 'healthy' ? (
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          )}
          {module.status}
          {!module.enabled && <span className="text-slate-400">(off)</span>}
        </span>
      </li>
    ))}
  </ul>
);
