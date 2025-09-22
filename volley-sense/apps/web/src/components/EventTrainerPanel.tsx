import { FC } from 'react';
import { Switch } from '@headlessui/react';
import { Sparkles, FileText, Clapperboard } from 'lucide-react';
import clsx from 'clsx';
import { EventDefinition, ExplainPayload } from '@lib/types';
import ExplainPopover from './ExplainPopover';

type Props = {
  events: EventDefinition[];
  loadingMap: Record<string, boolean>;
  explainedId?: string;
  explainPayload?: ExplainPayload;
  onTeach: () => void;
  onToggle: (id: string) => void;
  onThresholdChange: (id: string, value: number) => void;
  onPreview: (id: string) => void;
  onExplain: (id: string) => void;
  onClips: (id: string) => void;
};

const EventTrainerPanel: FC<Props> = ({
  events,
  loadingMap,
  explainedId,
  explainPayload,
  onTeach,
  onToggle,
  onThresholdChange,
  onPreview,
  onExplain,
  onClips
}) => {
  return (
    <aside className="flex h-full w-80 flex-col gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Event Trainer</h2>
          <p className="text-xs text-slate-400">Configure detections, confidence thresholds, and shadow mode rules.</p>
        </div>
        <button
          type="button"
          onClick={onTeach}
          className="rounded-lg bg-primary-500 px-3 py-2 text-sm font-medium text-white shadow shadow-primary-500/40 transition hover:bg-primary-500/90 focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          Teach New Event
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {events.map((event) => (
          <div
            key={event.id}
            className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 shadow-inner shadow-slate-950/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{event.name}</p>
                <p className="text-xs text-slate-400">Template: {event.template}</p>
                <p className="text-[11px] text-slate-500">Shadow mode keeps detections silent until confidence stabilizes.</p>
              </div>
              <Switch
                checked={event.enabled}
                onChange={() => onToggle(event.id)}
                className={clsx(
                  'relative inline-flex h-6 w-11 items-center rounded-full border transition',
                  event.enabled
                    ? 'border-primary-500 bg-primary-500/80'
                    : 'border-slate-700 bg-slate-800'
                )}
              >
                <span
                  className={clsx(
                    'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
                    event.enabled ? 'translate-x-5' : 'translate-x-1'
                  )}
                />
                <span className="sr-only">Toggle {event.name}</span>
              </Switch>
            </div>
            <label className="block text-xs font-medium text-slate-300" htmlFor={`slider-${event.id}`}>
              Confidence Threshold
            </label>
            <input
              id={`slider-${event.id}`}
              type="range"
              min={0.1}
              max={0.99}
              step={0.01}
              value={event.threshold}
              role="slider"
              aria-valuemin={0.1}
              aria-valuemax={0.99}
              aria-valuenow={event.threshold}
              aria-label={`${event.name} threshold`}
              onChange={(e) => onThresholdChange(event.id, Number(e.target.value))}
              className="w-full accent-primary-500"
            />
            <p className="text-xs text-slate-400">{Math.round(event.threshold * 100)}% confidence</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPreview(event.id)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-accent/60"
              >
                <Sparkles className="h-4 w-4" />
                {loadingMap[event.id] ? 'Loading…' : 'Preview'}
              </button>
              <button
                type="button"
                onClick={() => onExplain(event.id)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <FileText className="h-4 w-4" /> Rules
              </button>
              <button
                type="button"
                onClick={() => onClips(event.id)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <Clapperboard className="h-4 w-4" /> Clips
              </button>
            </div>
            {explainedId === event.id && explainPayload ? (
              <ExplainPopover payload={explainPayload} />
            ) : null}
          </div>
        ))}
      </div>
    </aside>
  );
};

export default EventTrainerPanel;
