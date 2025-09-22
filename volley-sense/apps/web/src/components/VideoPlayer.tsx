import { FC, useEffect, useMemo, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward, Eye, Camera, Info } from 'lucide-react';
import clsx from 'clsx';
import { fetchOverlaySnapshot } from '@lib/api';
import { ModuleStatus, OverlaySnapshot } from '@lib/types';
import { useVideoStore } from '@store/useVideoStore';

type Props = {
  gameId: string;
  modules: ModuleStatus[];
  onCaptureFrame: (payload: { image: string; timestamp: number }) => void;
  onExplainLast: () => void;
};

const VideoPlayer: FC<Props> = ({ gameId, modules, onCaptureFrame, onExplainLast }) => {
  const { currentTime, duration, playing, overlays, toggleOverlays, seek, togglePlay, setPlaying } =
    useVideoStore();
  const [snapshot, setSnapshot] = useState<OverlaySnapshot | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [loadingOverlay, setLoadingOverlay] = useState(false);

  const overlaysModule = useMemo(() => modules.find((item) => item.id === 'overlays'), [modules]);
  const overlaysHealthy = overlaysModule?.enabled && overlaysModule.status === 'healthy';

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

  useEffect(() => {
    if (!overlaysHealthy) {
      setSnapshot(null);
      setLoadingOverlay(false);
      setOverlayError(null);
      return;
    }
    setLoadingOverlay(true);
    setOverlayError(null);
    void fetchOverlaySnapshot(gameId, currentTime)
      .then((data) => {
        setSnapshot(data);
      })
      .catch((error) => {
        console.warn('Overlay module unavailable', error);
        setOverlayError('Overlay stream temporarily unavailable.');
      })
      .finally(() => {
        setLoadingOverlay(false);
      });
  }, [gameId, currentTime, overlaysHealthy]);

  const handleSeek = (delta: number) => {
    const next = Math.max(0, Math.min(duration, currentTime + delta));
    seek(next);
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  const handleCapture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(1, '#1e293b');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '32px sans-serif';
      ctx.fillText(`VolleySense Frame @ ${currentTime.toFixed(1)}s`, 48, canvas.height - 60);
      if (snapshot) {
        ctx.strokeStyle = '#22c55e';
        snapshot.boxes.forEach((box) => {
          ctx.strokeRect(box.x * canvas.width, box.y * canvas.height, box.width * canvas.width, box.height * canvas.height);
        });
      }
    }
    const image = canvas.toDataURL('image/png');
    onCaptureFrame({ image, timestamp: currentTime });
  };

  return (
    <div className="relative flex h-full flex-1 flex-col rounded-2xl border border-slate-800/60 bg-slate-900/60">
      <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-gradient-to-br from-slate-800 to-slate-900">
        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
          <span className="rounded-full bg-slate-800/60 px-4 py-2 text-sm font-medium uppercase tracking-wide text-slate-300">
            Match playback mock
          </span>
        </div>
        {overlays && snapshot ? (
          <div className="pointer-events-none absolute inset-0">
            {snapshot.boxes.map((box) => (
              <div
                key={`${box.jersey}-${box.label}`}
                className="absolute rounded-lg border bg-slate-900/40"
                style={{
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.width * 100}%`,
                  height: `${box.height * 100}%`,
                  borderColor: box.color
                }}
              >
                <span
                  className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-xs font-bold"
                  style={{ backgroundColor: box.color, color: '#0f172a' }}
                >
                  #{box.jersey}
                </span>
              </div>
            ))}
            {snapshot.trail.map((point, index) => (
              <span
                key={`${point.t}-${index}`}
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90"
                style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, opacity: 1 - index * 0.15 }}
              />
            ))}
          </div>
        ) : null}
        {overlayError && overlays ? (
          <div className="absolute bottom-3 left-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
            {overlayError}
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
          <button
            type="button"
            onClick={onExplainLast}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <Info className="h-4 w-4" /> Explain Last Event
          </button>
          <button
            type="button"
            onClick={handleCapture}
            className="inline-flex items-center gap-2 rounded-full border border-primary-500/60 bg-primary-500/20 px-3 py-2 text-xs font-semibold text-primary-100 transition hover:bg-primary-500/30 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <Camera className="h-4 w-4" /> Screenshot → Analyze
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
          {loadingOverlay ? (
            <div className="mt-2 text-[11px] text-slate-500">Syncing overlays…</div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
