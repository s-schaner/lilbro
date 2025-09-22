import { FC, useMemo, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import clsx from 'clsx';
import { EventMarker } from '@lib/types';

const COLORS: Record<EventMarker['kind'], string> = {
  serve: 'bg-orange-400',
  kill: 'bg-emerald-400',
  dig: 'bg-sky-400',
  custom: 'bg-purple-400',
  error: 'bg-red-500'
};

type Props = {
  markers: EventMarker[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onTeachAt?: (time: number) => void;
};

const Timeline: FC<Props> = ({ markers, currentTime, duration, onSeek, onTeachAt }) => {
  const sortedMarkers = useMemo(
    () => [...markers].sort((a, b) => a.t - b.t),
    [markers]
  );
  const safeDuration = duration > 0 ? duration : 1;
  const containerRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onTeachAt) {
      return;
    }
    event.preventDefault();
    if (!containerRef.current) {
      return;
    }
    const bounds = containerRef.current.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    const clamped = Math.max(0, Math.min(1, ratio));
    const time = clamped * safeDuration;
    onTeachAt(time);
  };

  return (
    <div
      ref={containerRef}
      onContextMenu={handleContextMenu}
      className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4"
    >
      <div className="relative h-12">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-800" aria-hidden />
        <button
          type="button"
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-primary-500 shadow"
          style={{ left: `${(currentTime / safeDuration) * 100}%` }}
          aria-label={`Current time ${currentTime.toFixed(0)} seconds`}
          onClick={() => onSeek(currentTime)}
        />
        {sortedMarkers.map((marker) => (
          <button
            key={`${marker.kind}-${marker.t}-${marker.label}`}
            type="button"
            className={clsx(
              'group absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 text-xs text-slate-100',
              marker.kind === 'custom' && 'font-semibold'
            )}
            style={{ left: `${(marker.t / safeDuration) * 100}%` }}
            onClick={() => onSeek(marker.t)}
          >
            <span
              className={clsx(
                'h-3 w-3 rounded-full border-2 border-slate-950 shadow transition group-hover:scale-125',
                COLORS[marker.kind]
              )}
              aria-hidden
            />
            <span className="hidden min-w-[140px] rounded-lg bg-slate-900/90 px-3 py-2 text-[11px] shadow-lg group-hover:block">
              <strong>{marker.label}</strong>
              <br />
              {marker.jersey ? `Jersey #${marker.jersey}` : 'Team Event'}
              <br />
              {Math.round(marker.conf * 100)}% @ {marker.t.toFixed(0)}s
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Timeline;
