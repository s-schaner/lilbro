import { FC, useMemo, useState } from 'react';
import { EventMarker, Player } from '@lib/types';
import { ChevronRight, Users2 } from 'lucide-react';
import clsx from 'clsx';

type Props = {
  players: Player[];
  events: EventMarker[];
  onSeek: (time: number) => void;
};

const tabs = ['Players', 'Events', 'Formation'] as const;

type Tab = (typeof tabs)[number];

const RightPanel: FC<Props> = ({ players, events, onSeek }) => {
  const [activeTab, setActiveTab] = useState<Tab>('Players');

  const sortedEvents = useMemo(() => [...events].sort((a, b) => b.t - a.t), [events]);

  return (
    <aside className="flex h-full w-80 flex-col gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Match Insights</h2>
        <div className="inline-flex rounded-full border border-slate-700 bg-slate-800/60 p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary-500',
                activeTab === tab ? 'bg-primary-500 text-white' : 'text-slate-300'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'Players' ? (
          <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-1">
            {players.map((player) => (
              <div
                key={player.jersey}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 shadow-inner shadow-slate-950/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/20 text-lg font-bold text-primary-400">
                      #{player.jersey}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{player.name}</p>
                      <p className="text-xs text-slate-400">Kills {player.stats.kills} · Digs {player.stats.digs}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    Highlights <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] text-slate-300">
                  <div className="rounded-lg bg-slate-800/80 p-2">
                    <p className="font-bold text-white">{player.stats.kills}</p>
                    <p>Kills</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/80 p-2">
                    <p className="font-bold text-white">{player.stats.digs}</p>
                    <p>Digs</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/80 p-2">
                    <p className="font-bold text-white">{player.stats.blocks}</p>
                    <p>Blocks</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/80 p-2">
                    <p className="font-bold text-white">{player.stats.aces}</p>
                    <p>Aces</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {activeTab === 'Events' ? (
          <ul className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
            {sortedEvents.map((event) => (
              <li key={`${event.label}-${event.t}`}>
                <button
                  type="button"
                  onClick={() => onSeek(event.t)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-left text-xs text-slate-200 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={clsx('h-2 w-2 rounded-full', {
                        'bg-orange-400': event.kind === 'serve',
                        'bg-emerald-400': event.kind === 'kill',
                        'bg-sky-400': event.kind === 'dig',
                        'bg-purple-400': event.kind === 'custom',
                        'bg-red-500': event.kind === 'error'
                      })}
                    />
                    <span className="font-semibold text-white">{event.label}</span>
                    {event.jersey ? <span className="text-slate-400">#{event.jersey}</span> : null}
                  </span>
                  <span className="text-slate-400">{event.t.toFixed(0)}s · {Math.round(event.conf * 100)}%</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {activeTab === 'Formation' ? (
          <div className="flex h-full flex-col justify-between">
            <div className="relative flex-1 rounded-xl border border-slate-800 bg-gradient-to-br from-court/60 to-slate-900/60 p-4">
              <div className="absolute inset-4 grid grid-cols-3 gap-4">
                {players.slice(0, 6).map((player) => (
                  <div
                    key={player.jersey}
                    className="flex items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/20 text-xs font-semibold text-emerald-200"
                  >
                    #{player.jersey} · {player.name.split(' ')[0]}
                  </div>
                ))}
              </div>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-500/10 px-4 py-2 text-xs text-red-300">
                <Users2 className="h-4 w-4" /> Illegal formation @ 104s
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Formation heatmap leverages positional telemetry to flag overlaps and early rotations. Alerts
              surface below when thresholds exceed limits.
            </p>
          </div>
        ) : null}
      </div>
    </aside>
  );
};

export default RightPanel;
