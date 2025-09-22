import React from 'react';
import { Layout } from 'lucide-react';
import { FormationSnapshot } from '../data/types';

interface Props {
  formation?: FormationSnapshot;
}

export const FormationPanel: React.FC<Props> = ({ formation }) => (
  <div className="module-card space-y-3">
    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
      <Layout className="h-4 w-4" /> Formation
    </h3>
    {formation ? (
      <div className="space-y-2 text-sm">
        <div>
          <h4 className="text-xs uppercase text-slate-400">Front Row</h4>
          <p>{formation.front_row.join(', ')}</p>
        </div>
        <div>
          <h4 className="text-xs uppercase text-slate-400">Back Row</h4>
          <p>{formation.back_row.join(', ')}</p>
        </div>
      </div>
    ) : (
      <p className="text-sm text-slate-400">Loading rotation snapshot…</p>
    )}
  </div>
);
