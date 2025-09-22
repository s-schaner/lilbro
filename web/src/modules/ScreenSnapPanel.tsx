import React, { useState } from 'react';
import { Camera } from 'lucide-react';

interface ScreenSnapResponse {
  prompt: string;
  analysis: {
    rotation: string;
    focus_player: string;
    detected_formations: { type: string; confidence: number }[];
  };
  tokens_used: number;
}

const SAMPLE_FRAME = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';

export const ScreenSnapPanel: React.FC = () => {
  const [frame, setFrame] = useState<string | null>(null);
  const [response, setResponse] = useState<ScreenSnapResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const captureFrame = () => {
    setFrame(SAMPLE_FRAME);
    setResponse(null);
  };

  const analyze = async () => {
    if (!frame) return;
    setLoading(true);
    try {
      const res = await fetch('/api/screensnap/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame_base64: frame, system_prompt: 'Analyze rotation focus' }),
      });
      if (!res.ok) {
        throw new Error('Unable to analyze frame');
      }
      const payload = (await res.json()) as ScreenSnapResponse;
      setResponse(payload);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="module-card space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
        <Camera className="h-4 w-4" /> ScreenSnap
      </h3>
      <p className="text-xs text-slate-400">
        Capture a mock frame and send to the API with a contextual system prompt for structured feedback.
      </p>
      <div className="flex gap-2">
        <button
          onClick={captureFrame}
          className="rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
        >
          Capture Frame
        </button>
        <button
          onClick={analyze}
          disabled={!frame || loading}
          className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Analyzing…' : 'Send to ScreenSnap'}
        </button>
      </div>
      {frame && <div className="text-xs text-slate-400 break-all">{frame}</div>}
      {response && (
        <div className="space-y-2 rounded-md border border-slate-800 bg-slate-950 p-3 text-sm">
          <div className="text-xs uppercase text-slate-400">Rotation</div>
          <div>{response.analysis.rotation}</div>
          <div className="text-xs uppercase text-slate-400">Focus Player</div>
          <div>{response.analysis.focus_player}</div>
          <div className="text-xs uppercase text-slate-400">Detections</div>
          <ul className="space-y-1">
            {response.analysis.detected_formations.map((item) => (
              <li key={item.type} className="flex justify-between text-xs">
                <span>{item.type}</span>
                <span>{Math.round(item.confidence * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
