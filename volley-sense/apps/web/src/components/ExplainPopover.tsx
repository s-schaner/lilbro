import { FC } from 'react';
import { ExplainPayload } from '@lib/types';

type Props = {
  payload: ExplainPayload;
};

const ExplainPopover: FC<Props> = ({ payload }) => {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-200">
      <p className="mb-2 font-semibold text-white">Why this triggered</p>
      <ul className="mb-2 list-disc space-y-1 pl-4 text-left text-slate-300">
        {payload.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <div className="space-y-1">
        {Object.entries(payload.features).map(([name, value]) => (
          <div className="flex justify-between" key={name}>
            <span className="font-medium text-slate-400">{name}</span>
            <span className="text-white">{value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExplainPopover;
