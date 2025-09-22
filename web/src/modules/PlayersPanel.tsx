import React from 'react';
import { UserCircle2 } from 'lucide-react';
import { Player } from '../data/types';

interface Props {
  players: Player[];
}

export const PlayersPanel: React.FC<Props> = ({ players }) => (
  <div className="module-card space-y-3">
    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
      <UserCircle2 className="h-4 w-4" /> Roster
    </h3>
    <ul className="space-y-2 text-sm">
      {players.map((player) => (
        <li key={player.id} className="flex items-center justify-between rounded-md bg-slate-800 px-3 py-2">
          <span>{player.name}</span>
          <span className="text-xs text-slate-400">{player.position}</span>
        </li>
      ))}
    </ul>
  </div>
);
