import React from 'react';
import { Flag } from 'lucide-react';
import { EventRecord } from '../data/types';

interface Props {
  events: EventRecord[];
}

export const EventsPanel: React.FC<Props> = ({ events }) => (
  <div className="module-card space-y-3">
    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
      <Flag className="h-4 w-4" /> Recent Events
    </h3>
    <ul className="space-y-2 text-sm">
      {events.map((event) => (
        <li key={event.id} className="flex items-center justify-between rounded-md bg-slate-800 px-3 py-2">
          <span>{event.label}</span>
          <span className="text-xs text-slate-400">{event.outcome}</span>
        </li>
      ))}
    </ul>
  </div>
);
