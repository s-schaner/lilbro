import { FC } from 'react';
import clsx from 'clsx';

import ModuleBoundary from '@components/ModuleBoundary';
import { downloadExport } from '@lib/api';

type Props = {
  gameId: string;
  ingestStatus?: string;
};

const FooterBar: FC<Props> = ({ gameId, ingestStatus }) => {
  const handleExport = (path: string, filename: string) => () => {
    void downloadExport(`${path}?game_id=${encodeURIComponent(gameId)}`, filename);
  };

  return (
    <footer className="mt-4 flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-900/60 px-6 py-4 text-sm text-slate-200">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 rounded-full bg-slate-800/80 px-4 py-1">
          <span className="text-sm font-semibold text-white">Team A</span>
          <span className="text-xs text-slate-400">2 sets</span>
        </div>
        <div className="flex items-center gap-3 rounded-full bg-slate-800/80 px-4 py-1">
          <span className="text-sm font-semibold text-white">Team B</span>
          <span className="text-xs text-slate-400">1 set</span>
        </div>
        <div
          className={clsx(
            'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
            ingestStatus === 'complete'
              ? 'bg-emerald-500/10 text-emerald-300'
              : ingestStatus
                  ? 'bg-amber-500/10 text-amber-300'
                  : 'bg-slate-800/80 text-slate-300'
          )}
        >
          Sync {ingestStatus ? `· ${ingestStatus}` : '· Idle'}
        </div>
      </div>
      <ModuleBoundary moduleId="exports">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExport('/export/summary.pdf', 'volley-summary.pdf')}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            Summary PDF
          </button>
          <button
            type="button"
            onClick={handleExport('/export/players.csv', 'player-stats.csv')}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            Player CSV
          </button>
          <button
            type="button"
            onClick={handleExport('/export/highlights.zip', 'highlight-reel.zip')}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            Highlight Reel
          </button>
        </div>
      </ModuleBoundary>
    </footer>
  );
};

export default FooterBar;
