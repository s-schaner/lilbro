import { FC } from 'react';
import { HelpCircle, Settings, Upload } from 'lucide-react';
import clsx from 'clsx';

const matches = [
  { id: 'demo-1', name: 'Demo Match — Cougars vs Hawks' },
  { id: 'demo-2', name: 'Demo Match — Tigers vs Owls' }
];

type Props = {
  activeMatch: string;
  onMatchChange: (value: string) => void;
  onUpload?: () => void;
  onSettings?: () => void;
  onHelp?: () => void;
};

const TopBar: FC<Props> = ({ activeMatch, onMatchChange, onUpload, onSettings, onHelp }) => {
  return (
    <header className="flex items-center justify-between bg-slate-900/60 px-6 py-4 shadow-lg shadow-slate-950/40">
      <div className="flex items-center gap-6">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-white">VolleySense – Auto-Stats & Trainer</p>
          <p className="text-xs text-slate-400">Modular volleyball insights, event training, and AI summaries.</p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 shadow-inner shadow-slate-950/60">
          <span className="text-xs uppercase tracking-wide text-slate-500">Match</span>
          <select
            value={activeMatch}
            onChange={(event) => onMatchChange(event.target.value)}
            className="bg-transparent text-sm font-semibold text-white focus:outline-none"
          >
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {match.name}
              </option>
            ))}
          </select>
        </label>
        <span className="flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-400">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400" aria-hidden />
          Live
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onUpload}
          className="inline-flex items-center gap-2 rounded-lg border border-primary-500/40 bg-primary-500/10 px-4 py-2 text-sm font-medium text-primary-500 transition hover:bg-primary-500/20 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <Upload className="h-4 w-4" aria-hidden /> Upload Video
        </button>
        <div className="flex items-center gap-2 text-slate-400">
          <button
            type="button"
            className={clsx(
              'rounded-lg border border-slate-700 bg-slate-800/60 p-2 transition hover:border-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-500'
            )}
            aria-label="Open settings"
            onClick={onSettings}
          >
            <Settings className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={clsx(
              'rounded-lg border border-slate-700 bg-slate-800/60 p-2 transition hover:border-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-500'
            )}
            aria-label="Open help"
            onClick={onHelp}
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
