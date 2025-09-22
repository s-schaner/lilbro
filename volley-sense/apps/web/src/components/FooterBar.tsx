import { FC } from 'react';
import { downloadExport } from '@lib/api';

const FooterBar: FC<{ gameId: string }> = ({ gameId }) => {
  const handleExport = (path: string, filename: string) => () => {
    void downloadExport(`${path}?game_id=${encodeURIComponent(gameId)}`, filename);
  };

  return (
    <footer className="mt-4 flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-900/60 px-6 py-4 text-sm text-slate-200">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1">
          <span className="font-semibold text-white">Team A</span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">Set 2</span>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1">
          <span className="font-semibold text-white">Team B</span>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Sync OK</span>
        </div>
      </div>
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
    </footer>
  );
};

export default FooterBar;
