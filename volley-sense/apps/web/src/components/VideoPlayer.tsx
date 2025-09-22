import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Eye, Info, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import clsx from 'clsx';

import { analyzeScreenshot, fetchOverlays } from '@lib/api';
import { EventMarker, OverlayBox, OverlayPayload, ScreenSnapResponse } from '@lib/types';
import { useEventBus } from '@context/EventBusContext';
import { useVideoStore } from '@store/useVideoStore';

import ScreenSnapDrawer from './ScreenSnapDrawer';

const BASE_PROMPT = `You are a volleyball technique analyst. Analyze a single still image in context of the provided focus. Be concrete and concise. Use bullets. Offer 1–2 actionable corrections. If the evidence is insufficient, explicitly say so.`;

const focusDefault = 'Blocking technique of #14';

type Props = {
  gameId: string;
  onExplainLast: () => void;
};

const VideoPlayer: FC<Props> = ({ gameId, onExplainLast }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const suppressTimeUpdate = useRef(false);
  const bus = useEventBus();

  const currentTime = useVideoStore((state) => state.currentTime);
  const duration = useVideoStore((state) => state.duration);
  const playing = useVideoStore((state) => state.playing);
  const overlaysEnabled = useVideoStore((state) => state.overlays);
  const seek = useVideoStore((state) => state.seek);
  const setPlaying = useVideoStore((state) => state.setPlaying);
  const setDuration = useVideoStore((state) => state.setDuration);
  const setCurrentTime = useVideoStore((state) => state.setCurrentTime);
  const toggleOverlays = useVideoStore((state) => state.toggleOverlays);
  const source = useVideoStore((state) => state.source);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snapImage, setSnapImage] = useState<string | null>(null);
  const [snapFocus, setSnapFocus] = useState(focusDefault);
  const [snapPrompt, setSnapPrompt] = useState(BASE_PROMPT);
  const [analysis, setAnalysis] = useState<ScreenSnapResponse | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [overlayPayload, setOverlayPayload] = useState<OverlayPayload | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);

  const durationLabel = useMemo(() => (duration ? duration.toFixed(0) : '0'), [duration]);

  const handleTogglePlay = useCallback(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    if (playing) {
      element.pause();
      setPlaying(false);
    } else {
      const promise = element.play();
      setPlaying(true);
      if (promise) {
        promise.catch(() => {
          setPlaying(false);
        });
      }
    }
  }, [playing, setPlaying]);

  const handleSeekDelta = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(duration || 0, currentTime + delta));
      seek(next);
      const element = videoRef.current;
      if (element) {
        suppressTimeUpdate.current = true;
        element.currentTime = next;
      }
    },
    [currentTime, duration, seek]
  );

  const handleScreenshot = useCallback(() => {
    const element = videoRef.current;
    if (!element || element.videoWidth === 0) {
      bus.emit('snackbar', 'Load a video to capture a frame.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      bus.emit('snackbar', 'Unable to capture frame.');
      return;
    }
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    setSnapImage(dataUrl);
    setAnalysis(null);
    setDrawerOpen(true);
  }, [bus]);

  const handleAnalyze = useCallback(async () => {
    if (!snapImage) {
      return;
    }
    setLoadingAnalysis(true);
    try {
      const result = await analyzeScreenshot(snapFocus, snapImage, {
        timestamp: currentTime,
        game_id: gameId
      });
      setAnalysis(result);
      bus.emit('snackbar', 'Technique analysis ready.');
    } catch (error) {
      console.error(error);
      bus.emit('snackbar', 'Unable to reach Screenshot Insights module.');
    } finally {
      setLoadingAnalysis(false);
    }
  }, [snapImage, snapFocus, currentTime, gameId, bus]);

  const handleSaveAnalysis = useCallback(() => {
    if (!analysis) {
      return;
    }
    const note = { ...analysis, focus: snapFocus, timestamp: currentTime };
    const marker: EventMarker = {
      t: currentTime,
      label: `ScreenSnap – ${analysis.summary}`,
      kind: 'custom',
      conf: analysis.confidence
    };
    bus.emit('analysis:add', { note });
    bus.emit('timeline:pin', marker);
    bus.emit('snackbar', 'Pinned to timeline and Image Analysis tab.');
    setDrawerOpen(false);
  }, [analysis, snapFocus, currentTime, bus]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return undefined;
    }
    const handleLoaded = () => {
      setDuration(element.duration || 0);
    };
    const handleTimeUpdate = () => {
      if (suppressTimeUpdate.current) {
        suppressTimeUpdate.current = false;
        return;
      }
      setCurrentTime(element.currentTime);
    };
    const handleEnded = () => {
      setPlaying(false);
    };
    element.addEventListener('loadedmetadata', handleLoaded);
    element.addEventListener('timeupdate', handleTimeUpdate);
    element.addEventListener('ended', handleEnded);
    return () => {
      element.removeEventListener('loadedmetadata', handleLoaded);
      element.removeEventListener('timeupdate', handleTimeUpdate);
      element.removeEventListener('ended', handleEnded);
    };
  }, [setCurrentTime, setDuration, setPlaying]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    if (playing && element.paused) {
      void element.play().catch(() => {
        setPlaying(false);
      });
    }
    if (!playing && !element.paused) {
      element.pause();
    }
  }, [playing, setPlaying]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    if (Math.abs(element.currentTime - currentTime) > 0.25) {
      suppressTimeUpdate.current = true;
      element.currentTime = currentTime;
    }
  }, [currentTime]);

  const overlayBucket = useMemo(() => Math.floor(currentTime / 5), [currentTime]);

  useEffect(() => {
    let active = true;
    if (!overlaysEnabled) {
      setOverlayPayload(null);
      return undefined;
    }
    const sampleTime = overlayBucket * 5;
    const load = async () => {
      try {
        const payload = await fetchOverlays(gameId, sampleTime);
        if (!active) {
          return;
        }
        setOverlayPayload(payload);
        setOverlayError(null);
      } catch (error) {
        console.warn('Overlay module unavailable', error);
        if (active) {
          setOverlayError('Overlay stream unavailable');
        }
      }
    };
    void load();
    const interval = window.setInterval(load, 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [gameId, overlaysEnabled, overlayBucket]);

  const renderOverlayBox = (box: OverlayBox) => (
    <div
      key={box.jersey}
      className="absolute rounded-lg border border-emerald-400/80 bg-emerald-500/20 backdrop-blur-sm"
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.width * 100}%`,
        height: `${box.height * 100}%`
      }}
    >
      <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-emerald-950">
        #{box.jersey}
      </span>
    </div>
  );

  return (
    <div className="relative flex h-full flex-1 flex-col rounded-2xl border border-slate-800/60 bg-slate-900/60">
      <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-gradient-to-br from-slate-800 to-slate-900">
        {source ? (
          <video ref={videoRef} src={source} className="h-full w-full object-cover" preload="metadata" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
            <span className="rounded-full bg-slate-800/60 px-4 py-2 text-sm font-medium uppercase tracking-wide text-slate-300">
              Upload a match video to begin
            </span>
          </div>
        )}
        {overlaysEnabled && overlayPayload ? (
          <div className="pointer-events-none absolute inset-0">
            {overlayPayload.players.map(renderOverlayBox)}
            <div
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
              style={{ left: `${overlayPayload.ball.x * 100}%`, top: `${overlayPayload.ball.y * 100}%` }}
            />
            {overlayPayload.trail.map((point, index) => (
              <div
                key={`${point.x}-${point.y}-${index}`}
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40"
                style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
              />
            ))}
          </div>
        ) : null}
        {overlayError ? (
          <div className="absolute left-4 top-4 rounded-lg bg-red-500/80 px-3 py-1 text-xs font-semibold text-white">
            {overlayError}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSeekDelta(-5)}
              className="rounded-full border border-slate-700 p-3 text-slate-200 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Rewind 5 seconds"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleTogglePlay}
              className="rounded-full border border-primary-500/60 bg-primary-500/20 p-4 text-white transition hover:bg-primary-500/30 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label={playing ? 'Pause playback' : 'Start playback'}
            >
              {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </button>
            <button
              type="button"
              onClick={() => handleSeekDelta(5)}
              className="rounded-full border border-slate-700 p-3 text-slate-200 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Forward 5 seconds"
            >
              <SkipForward className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={toggleOverlays}
              className={clsx(
                'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary-500',
                overlaysEnabled
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
          </div>
          <button
            type="button"
            onClick={handleScreenshot}
            className="inline-flex items-center gap-2 rounded-full border border-purple-400 bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-200 transition hover:bg-purple-500/20 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <Camera className="h-4 w-4" /> Screenshot → Analyze
          </button>
        </div>
        <div>
          <div className="h-2 w-full rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-primary-500 transition-all"
              style={{ width: `${duration ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>{currentTime.toFixed(0)}s</span>
            <span>{durationLabel}s</span>
          </div>
        </div>
      </div>
      <ScreenSnapDrawer
        open={drawerOpen}
        image={snapImage}
        timestamp={currentTime}
        focus={snapFocus}
        prompt={snapPrompt}
        loading={loadingAnalysis}
        result={analysis}
        onFocusChange={setSnapFocus}
        onPromptChange={setSnapPrompt}
        onAnalyze={handleAnalyze}
        onSave={handleSaveAnalysis}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
};

export default VideoPlayer;
