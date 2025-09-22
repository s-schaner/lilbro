import { FC, FormEvent, useEffect, useMemo, useState } from 'react';
import { ScreenSnapResult } from '@lib/types';
import { Loader2, Pin, Sparkles } from 'lucide-react';

const focusTemplates = [
  'Blocking technique',
  'Approach footwork',
  'Serve toss height',
  'Defensive posture',
  'Transition spacing'
];

type Props = {
  open: boolean;
  image?: string;
  timestamp: number;
  loading?: boolean;
  analysis?: ScreenSnapResult | null;
  onClose: () => void;
  onAnalyze: (payload: { focus: string; prompt: string }) => void;
  onSave?: () => void;
};

const basePrompt =
  'You are a volleyball technique analyst. Analyze the still frame with respect to the selected focus. Provide bullet observations and actionable corrections. If evidence is insufficient, state it explicitly.';

const ScreenshotDrawer: FC<Props> = ({ open, image, timestamp, loading, analysis, onClose, onAnalyze, onSave }) => {
  const [focus, setFocus] = useState(focusTemplates[0]);
  const [prompt, setPrompt] = useState(basePrompt);

  useEffect(() => {
    if (open) {
      setFocus(focusTemplates[0]);
      setPrompt(basePrompt);
    }
  }, [open]);

  const formattedTimestamp = useMemo(() => `${timestamp.toFixed(1)}s`, [timestamp]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAnalyze({ focus, prompt });
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/60">
      <div className="flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <header className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">ScreenSnap Analyzer</h3>
            <p className="text-xs text-slate-400">Frame captured at {formattedTimestamp}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            Close
          </button>
        </header>
        <div className="mt-4 flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
          {image ? (
            <img
              src={image}
              alt="Captured frame"
              className="w-full rounded-xl border border-slate-800 object-cover"
            />
          ) : null}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-xs font-semibold text-slate-300">
              Focus area
              <select
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {focusTemplates.map((template) => (
                  <option key={template} value={template}>
                    {template}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              System prompt
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="mt-2 h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500/90 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate Analysis
            </button>
          </form>
          {analysis ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">Technique readout</h4>
                <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">{Math.round(analysis.confidence * 100)}% confidence</span>
              </div>
              <p className="mt-2 text-slate-300">{analysis.summary}</p>
              <div className="mt-3">
                <p className="text-xs font-semibold text-white">Observations</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-300">
                  {analysis.observations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold text-white">Corrections</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-300">
                  {analysis.corrections.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              {onSave ? (
                <button
                  type="button"
                  onClick={onSave}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <Pin className="h-4 w-4" /> Save to notes
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ScreenshotDrawer;
