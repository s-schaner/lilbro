import React, { useEffect, useMemo, useState } from 'react';
import { IngestJob } from '../data/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const initialJob: IngestJob | null = null;

export const UploadModal: React.FC<Props> = ({ open, onClose }) => {
  const [job, setJob] = useState<IngestJob | null>(initialJob);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!job || job.progress >= 1) {
      return undefined;
    }
    const interval = setInterval(async () => {
      const response = await fetch(`/api/ingest/${job.job_id}`);
      if (!response.ok) {
        setError('Unable to update ingest status');
        clearInterval(interval);
        return;
      }
      const payload = (await response.json()) as IngestJob;
      setJob(payload);
    }, 1200);
    return () => clearInterval(interval);
  }, [job]);

  const startUpload = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: 'demo-match.mp4' }),
      });
      if (!response.ok) {
        throw new Error('Failed to start ingest');
      }
      const payload = (await response.json()) as IngestJob;
      setJob(payload);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const progressLabel = useMemo(() => {
    if (!job) return 'Waiting to start';
    return `${Math.round(job.progress * 100)}% – ${job.state}`;
  }, [job]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Upload &amp; Ingest</h2>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm bg-slate-800 hover:bg-slate-700"
          >
            Close
          </button>
        </div>
        <p className="text-sm text-slate-300 mb-4">
          Kick off a mocked ingest pipeline. Status will loop through deterministic stages.
        </p>
        <div className="space-y-3">
          <button
            disabled={loading}
            onClick={startUpload}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Starting…' : 'Start Ingest Job'}
          </button>
          <div className="h-2 rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, Math.round((job?.progress ?? 0) * 100))}%` }}
            />
          </div>
          <div className="text-xs text-slate-400">{progressLabel}</div>
          {job && (
            <div className="text-xs text-slate-400 flex gap-2 flex-wrap">
              {job.states.map((state) => (
                <span
                  key={state}
                  className={`rounded-full border px-2 py-1 ${
                    job.state === state ? 'border-emerald-400 text-emerald-300' : 'border-slate-700'
                  }`}
                >
                  {state}
                </span>
              ))}
            </div>
          )}
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
      </div>
    </div>
  );
};
