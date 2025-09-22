import { FC, FormEvent, useState } from 'react';
import { TrainerTemplate } from '@lib/types';

const templateDescriptions: Record<TrainerTemplate, string> = {
  Contact: 'Detect collisions, touches, and impacts between players.',
  'Injury Risk': 'Model load + acceleration to surface risky motions.',
  Formation: 'Track player alignment, overlaps, and rotation timing.',
  General: 'Custom classifier for any other cues you need.'
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; template: TrainerTemplate; threshold: number }) => void;
};

const TeachEventModal: FC<Props> = ({ open, onClose, onSubmit }) => {
  const [template, setTemplate] = useState<TrainerTemplate>('Contact');
  const [name, setName] = useState('');
  const [threshold, setThreshold] = useState(0.7);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({ name, template, threshold });
    setName('');
    setThreshold(0.7);
    setTemplate('Contact');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white">Teach New Event</h3>
        <p className="mt-1 text-sm text-slate-400">Pair video cues with a detection template to shadow test.</p>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-200">
            Template
            <select
              value={template}
              onChange={(event) => setTemplate(event.target.value as TrainerTemplate)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {Object.keys(templateDescriptions).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-xs text-slate-400">{templateDescriptions[template]}</span>
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Event name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Collision"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Confidence threshold
            <input
              type="range"
              min={0.1}
              max={0.99}
              step={0.01}
              value={threshold}
              role="slider"
              aria-valuemin={0.1}
              aria-valuemax={0.99}
              aria-valuenow={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
              className="mt-2 w-full accent-primary-500"
            />
            <span className="mt-1 block text-xs text-slate-400">{Math.round(threshold * 100)}%</span>
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-500/90 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              Save & Shadow Test
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeachEventModal;
