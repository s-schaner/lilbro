import React, { useState } from 'react';
import { Wand2 } from 'lucide-react';

interface TrainerProposal {
  label: string;
  frame_timestamp: number;
  regions: { player_id: string; shape: string; points: { x: number; y: number }[] }[];
  notes: string;
}

export const EventTrainerPanel: React.FC = () => {
  const [label, setLabel] = useState('Quick tempo read');
  const [timestamp, setTimestamp] = useState(42.5);
  const [response, setResponse] = useState<TrainerProposal | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trainer/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frame_timestamp: timestamp,
          label,
          selected_player_ids: ['p1', 'p2'],
        }),
      });
      if (!res.ok) {
        throw new Error('Unable to propose training event');
      }
      const payload = (await res.json()) as TrainerProposal;
      setResponse(payload);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="module-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
          <Wand2 className="h-4 w-4" /> Event Trainer
        </h2>
        <button
          onClick={submit}
          disabled={loading}
          className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Submitting…' : 'Generate'}
        </button>
      </div>
      <div className="space-y-3 text-sm">
        <label className="block text-xs uppercase text-slate-400" htmlFor="label">
          Label
        </label>
        <input
          id="label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm"
        />
        <label className="block text-xs uppercase text-slate-400" htmlFor="timestamp">
          Timestamp (s)
        </label>
        <input
          id="timestamp"
          type="number"
          value={timestamp}
          onChange={(event) => setTimestamp(Number(event.target.value))}
          className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm"
        />
      </div>
      {response && (
        <div className="rounded-md border border-slate-800 bg-slate-950 p-3 text-xs space-y-2">
          <div className="uppercase text-slate-400">Suggested Regions</div>
          <ul className="space-y-1">
            {response.regions.map((region) => (
              <li key={region.player_id}>
                {region.player_id}: {region.points.length} control points ({region.shape})
              </li>
            ))}
          </ul>
          <div className="text-slate-300">{response.notes}</div>
        </div>
      )}
    </div>
  );
};
