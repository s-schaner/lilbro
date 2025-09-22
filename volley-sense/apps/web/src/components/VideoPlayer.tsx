import { FC, useEffect } from 'react';
import { Pause, Play, SkipBack, SkipForward, Eye } from 'lucide-react';
import clsx from 'clsx';
import { useVideoStore } from '@store/useVideoStore';

const VideoPlayer: FC = () => {
  const { currentTime, duration, playing, overlays, toggleOverlays, seek, togglePlay, setPlaying } =
    useVideoStore();

  useEffect(() => {
    const interval = playing
      ? window.setInterval(() => {
          seek(Math.min(duration, currentTime + 1));
        }, 1000)
      : undefined;
    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [playing, currentTime, duration, seek]);

  useEffect(() => {
    if (currentTime >= duration) {
      setPlaying(false);
    }
  }, [currentTime, duration, setPlaying]);

  const handleSeek = (delta: number) => {
    const next = Math.max(0, Math.min(duration, currentTime + delta));
    seek(next);
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative flex h-full flex-1 flex-col rounded-2xl border border-slate-800/60 bg-slate-900/60">
      <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-gradient-to-br from-slate-800 to-slate-900">
        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
          <span className="rounded-full bg-slate-800/60 px-4 py-2 text-sm font-medium uppercase tracking-wide text-slate-300">
            Match playback mock
          </span>
        </div>
        {overlays ? (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/4 top-1/3 h-16 w-16 rounded-lg border border-emerald-400/70 bg-emerald-500/10">
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-emerald-950">
                #12
              </span>
            </div>
            <div className="absolute right-1/4 bottom-1/4 h-16 w-16 rounded-lg border border-amber-400/70 bg-amber-500/10">
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">
                #7
              </span>
            </div>
            <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" aria-label="Ball position" />
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => handleSeek(-5)}
            className="rounded-full border border-slate-700 p-3 text-slate-200 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Rewind 5 seconds"
          >
            <SkipBack className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="rounded-full border border-primary-500/60 bg-primary-500/20 p-4 text-white transition hover:bg-primary-500/30 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label={playing ? 'Pause playback' : 'Start playback'}
          >
            {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </button>
          <button
            type="button"
            onClick={() => handleSeek(5)}
            className="rounded-full border border-slate-700 p-3 text-slate-200 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Forward 5 seconds"
          >
            <SkipForward className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={toggleOverlays}
            className={clsx(
              'ml-4 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary-500',
              overlays
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 bg-slate-800 text-slate-300'
            )}
          >
            <Eye className="h-4 w-4" /> Overlays
          </button>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-primary-500 transition-all"
              style={{ width: `${progress}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>{currentTime.toFixed(0)}s</span>
            <span>{duration.toFixed(0)}s</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
