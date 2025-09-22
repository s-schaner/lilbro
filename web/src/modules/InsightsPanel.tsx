import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

interface InsightResponse {
  provider: string;
  prompt: string;
  insight: string;
}

export const InsightsPanel: React.FC = () => {
  const [prompt, setPrompt] = useState('What is the biggest adjustment for set two?');
  const [response, setResponse] = useState<InsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, context: [] }),
      });
      if (!res.ok) {
        throw new Error('Unable to request insight');
      }
      const payload = (await res.json()) as InsightResponse;
      setResponse(payload);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="module-card space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
        <Sparkles className="h-4 w-4" /> LLM Insights
      </h3>
      <label className="text-xs uppercase text-slate-400" htmlFor="prompt">
        Prompt
      </label>
      <textarea
        id="prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm"
        rows={4}
      />
      <button
        onClick={submit}
        disabled={loading}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? 'Requesting…' : 'Generate Insight'}
      </button>
      {error && <div className="text-xs text-red-400">{error}</div>}
      {response && (
        <div className="rounded-md border border-slate-800 bg-slate-950 p-3 text-sm">
          <div className="text-xs uppercase text-slate-400">Provider</div>
          <div className="text-xs text-slate-300 mb-2">{response.provider}</div>
          <div className="text-xs uppercase text-slate-400">Insight</div>
          <p className="text-sm leading-6 text-slate-100">{response.insight}</p>
        </div>
      )}
    </div>
  );
};
