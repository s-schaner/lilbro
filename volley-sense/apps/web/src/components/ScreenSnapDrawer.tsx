import { FC } from 'react';
import { Loader2, Save, Sparkles } from 'lucide-react';

import { ScreenSnapResponse } from '@lib/types';

const focusOptions = [
  'Blocking technique of #14',
  'Arm swing mechanics',
  'Serve toss height',
  'Defensive positioning'
];

type Props = {
  open: boolean;
  image: string | null;
  timestamp: number;
  focus: string;
  prompt: string;
  loading: boolean;
  result: ScreenSnapResponse | null;
  onFocusChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onAnalyze: () => void;
  onSave: () => void;
  onClose: () => void;
};

const ScreenSnapDrawer: FC<Props> = ({
  open,
  image,
  timestamp,
  focus,
  prompt,
  loading,
  result,
  onFocusChange,
  onPromptChange,
  onAnalyze,
  onSave,
  onClose
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/60">
      <aside className="flex h-full w-full max-w-md flex-col gap-4 border-l border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">ScreenSnap Analysis</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
          >
            Close
          </button>
        </div>
        <div className="text-xs text-slate-400">Timestamp {timestamp.toFixed(1)}s</div>
        {image ? (
          <img src={image} alt="Captured frame" className="w-full rounded-lg border border-slate-800 object-contain" />
        ) : null}
        <label className="text-xs font-semibold text-slate-200">
          Skill focus
          <select
            value={focus}
            onChange={(event) => onFocusChange(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {focusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-200">
          System prompt
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </label>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate Analysis
        </button>
        {result ? (
          <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <div>
              <p className="font-semibold text-white">{result.summary}</p>
              <p className="mt-1 text-xs text-emerald-200">Confidence {(result.confidence * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Observations</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-emerald-100">
                {result.observations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Corrections</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-emerald-100">
                {result.corrections.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-400 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
            >
              <Save className="h-4 w-4" /> Save to Notes
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
};

export default ScreenSnapDrawer;
