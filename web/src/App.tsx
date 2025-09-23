import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UploadCloud, Video, Layers, Camera, MousePointer2, Square, PenTool, Ruler } from 'lucide-react';
import { FeatureFlagsProvider, useFeatureFlags } from './context/FeatureFlagsContext';
import { useVolleyData } from './hooks/useVolleyData';
import { useModuleHealth } from './hooks/useModuleHealth';
import { EventTrainerPanel } from './modules/EventTrainerPanel';
import { PlayersPanel } from './modules/PlayersPanel';
import { EventsPanel } from './modules/EventsPanel';
import { FormationPanel } from './modules/FormationPanel';
import { InsightsPanel } from './modules/InsightsPanel';
import { ScreenSnapPanel } from './modules/ScreenSnapPanel';
import { ModuleHealthList } from './components/ModuleHealthList';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UploadDialog } from './components/UploadDialog';
import { VideoViewport, VideoViewportHandle } from './components/VideoViewport';
import { OverlayCanvas, AnnotationInput, CalibrationData } from './components/OverlayCanvas';
import { LogFilters, UPLOAD_STAGE_LABELS } from './data/types';
import { useIngestStore } from './store/ingestStore';
import { useOverlayStore } from './store/overlayStore';
import { useHealthStore } from './store/healthStore';
import LogsTab from './pages/LogsTab';
import { CalibrationWizard } from './pages/CalibrationWizard';
import { useOverlayTool, OverlayTool } from './hooks/useOverlayTool';

const clampValue = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const applyHomography = (matrix: number[][] | null | undefined, x: number, y: number): [number, number] | null => {
  if (!matrix || matrix.length !== 3) return null;
  const denom = matrix[2][0] * x + matrix[2][1] * y + matrix[2][2];
  if (Math.abs(denom) < 1e-6) return null;
  const px = (matrix[0][0] * x + matrix[0][1] * y + matrix[0][2]) / denom;
  const py = (matrix[1][0] * x + matrix[1][1] * y + matrix[1][2]) / denom;
  return [px, py];
};

const formatTimestamp = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const AppShell: React.FC = () => {
  const { players, events, formation, loading } = useVolleyData();
  const modules = useModuleHealth();
  const flags = useFeatureFlags();

  const [activeTab, setActiveTab] = useState('players');
  const [showUpload, setShowUpload] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string>();
  const [posterUrl, setPosterUrl] = useState<string | undefined>(undefined);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string; tone: 'error' | 'success' } | null>(null);
  const viewportRef = useRef<VideoViewportHandle>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const [logFilters, setLogFilters] = useState<LogFilters>({});
  const mezzanineUrlRef = useRef<string | null>(null);
  const thumbsGlobRef = useRef<string | null>(null);
  const keyframesCsvRef = useRef<string | null>(null);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [hoverPreview, setHoverPreview] = useState<{ time: number; left: number; url: string; timeLabel: string } | null>(
    null,
  );
  const timelineRef = useRef<HTMLDivElement>(null);
  const { tool, setTool } = useOverlayTool();
  const previousIngestStatusRef = useRef<string | null>(null);
  const lastIngestErrorRef = useRef<string | null>(null);
  const lastOverlayErrorRef = useRef<string | null>(null);
  const {
    upload,
    uploadId,
    status: ingestStatus,
    error: ingestError,
    poll: pollIngest,
    reset: resetIngest,
  } = useIngestStore((state) => ({
    upload: state.upload,
    uploadId: state.uploadId,
    status: state.status,
    error: state.error,
    poll: state.poll,
    reset: state.reset,
  }));
  const {
    ingestStatus: healthStatus,
    poll: pollHealth,
    refresh: refreshHealthAction,
    disable: disableHealth,
    reset: resetHealth,
  } = useHealthStore((state) => ({
    ingestStatus: state.ingestStatus,
    poll: state.poll,
    refresh: state.refresh,
    disable: state.disable,
    reset: state.reset,
  }));
  const {
    activeUploadId,
    annotations,
    calibration,
    loadOverlay,
    setActiveUpload,
    saveAnnotation: saveAnnotationToStore,
    setCalibration: setCalibrationData,
    error: overlayError,
  } = useOverlayStore((state) => ({
    activeUploadId: state.activeUploadId,
    annotations:
      state.activeUploadId && state.annotationsByUpload[state.activeUploadId]
        ? state.annotationsByUpload[state.activeUploadId]
        : [],
    calibration:
      state.activeUploadId !== null
        ? state.calibrationByUpload[state.activeUploadId] ?? null
        : null,
    loadOverlay: state.load,
    setActiveUpload: state.setActiveUpload,
    saveAnnotation: state.saveAnnotation,
    setCalibration: state.setCalibration,
    error: state.error,
  }));
  const calibrationHelpers = useMemo(() => {
    if (!calibration) return null;
    return {
      pixelToCourt: (x: number, y: number) => applyHomography(calibration.homography, x, y),
      courtToPixel: (u: number, v: number) => applyHomography(calibration.homography_inv, u, v),
    };
  }, [calibration]);

  const apiBase = useMemo(() => import.meta.env.VITE_API_URL ?? 'http://localhost:8000', []);
  const formatStageLabel = useCallback((stage?: string | null) => {
    if (!stage) {
      return 'Ready';
    }
    const label = UPLOAD_STAGE_LABELS[stage];
    if (label) {
      return label;
    }
    const fallback = stage.replace(/_/g, ' ');
    return fallback.charAt(0).toUpperCase() + fallback.slice(1);
  }, []);

  const stageLabel = useMemo(
    () => formatStageLabel(ingestStatus?.stage ?? null),
    [formatStageLabel, ingestStatus],
  );

  const healthLabel = useMemo(() => {
    if (healthStatus === 'online') {
      return `Ingest: ${stageLabel}`;
    }
    if (healthStatus === 'degraded') {
      return 'Ingest: degraded';
    }
    if (healthStatus === 'disabled') {
      return 'Ingest: disabled';
    }
    return 'Ingest: checking…';
  }, [healthStatus, stageLabel]);

  const healthTone = useMemo(() => {
    switch (healthStatus) {
      case 'online':
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
      case 'degraded':
        return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
      case 'disabled':
        return 'border-slate-700 bg-slate-900 text-slate-500';
      default:
        return 'border-slate-600 bg-slate-800 text-slate-300';
    }
  }, [healthStatus]);

  const availableTabs = useMemo(
    () =>
      [
        { id: 'players', label: 'Players', element: <PlayersPanel players={players} />, enabled: true },
        { id: 'events', label: 'Events', element: <EventsPanel events={events} />, enabled: true },
        { id: 'formation', label: 'Formation', element: <FormationPanel formation={formation} />, enabled: true },
        { id: 'insights', label: 'Insights', element: <InsightsPanel />, enabled: flags.insights },
        {
          id: 'logs',
          label: 'Logs',
          element: (
            <LogsTab apiBase={apiBase} filters={logFilters} onFiltersChange={setLogFilters} />
          ),
          enabled: true,
        },
      ].filter((tab) => tab.enabled),
    [players, events, formation, flags.insights, apiBase, logFilters],
  );

  useEffect(() => {
    if (!availableTabs.find((tab) => tab.id === activeTab)) {
      setActiveTab(availableTabs[0]?.id ?? 'players');
    }
  }, [activeTab, availableTabs]);

  useEffect(() => {
    const handleToolKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) {
          return;
        }
      }
      if (event.key === 'v' || event.key === 'V') {
        setTool('select');
      } else if (event.key === 'b' || event.key === 'B') {
        setTool('box');
      } else if (event.key === 'l' || event.key === 'L') {
        setTool('lasso');
      }
    };
    window.addEventListener('keydown', handleToolKey);
    return () => window.removeEventListener('keydown', handleToolKey);
  }, [setTool]);

  const timelineMax = useMemo(() => Math.max(60, ...events.map((event) => event.timestamp)), [events]);

  const pushToast = useCallback((message: string, tone: 'error' | 'success') => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const saveAnnotation = useCallback(
    async (payload: AnnotationInput) => {
      if (!activeUploadId) {
        throw new Error('Upload required before adding annotations.');
      }
      const record = await saveAnnotationToStore(activeUploadId, payload, apiBase);
      pushToast('Annotation saved.', 'success');
      return record;
    },
    [activeUploadId, apiBase, pushToast, saveAnnotationToStore],
  );

  const handleCalibrationSaved = useCallback(
    (payload: CalibrationData) => {
      if (activeUploadId) {
        setCalibrationData(activeUploadId, payload);
      }
      pushToast('Calibration saved.', 'success');
    },
    [activeUploadId, pushToast, setCalibrationData],
  );

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (ingestError && ingestError !== lastIngestErrorRef.current) {
      pushToast(ingestError, 'error');
      lastIngestErrorRef.current = ingestError;
    }
    if (!ingestError) {
      lastIngestErrorRef.current = null;
    }
  }, [ingestError, pushToast]);

  useEffect(() => {
    if (overlayError && overlayError !== lastOverlayErrorRef.current) {
      pushToast(overlayError, 'error');
      lastOverlayErrorRef.current = overlayError;
    }
    if (!overlayError) {
      lastOverlayErrorRef.current = null;
    }
  }, [overlayError, pushToast]);

  useEffect(() => {
    const current = ingestStatus?.status ?? null;
    if (current === 'ready' && previousIngestStatusRef.current !== 'ready' && upload?.proxy_url) {
      setVideoSrc(`${apiBase}${upload.proxy_url}`);
      const firstThumb = upload.thumbs_glob?.replace('%04d', '0001');
      if (firstThumb) {
        setPosterUrl(`${apiBase}${firstThumb}`);
      } else {
        setPosterUrl(undefined);
      }
      mezzanineUrlRef.current = upload.mezzanine_url;
      thumbsGlobRef.current = upload.thumbs_glob;
      keyframesCsvRef.current = upload.keyframes_csv;
      setShowUpload(false);
      setHoverPreview(null);
      pushToast('Upload ready for playback.', 'success');
      setActiveUpload(upload.upload_id);
    }
    previousIngestStatusRef.current = current;
  }, [
    apiBase,
    ingestStatus,
    pushToast,
    setActiveUpload,
    setHoverPreview,
    setShowUpload,
    upload,
  ]);

  useEffect(() => {
    if (!activeUploadId) {
      return;
    }
    void loadOverlay(activeUploadId, apiBase);
  }, [activeUploadId, apiBase, loadOverlay]);

  const handleViewLogs = useCallback(() => {
    setLogFilters({ level: 'ERROR', source: 'ingest' });
    setActiveTab('logs');
  }, [setLogFilters, setActiveTab]);

  const handleCaptureStill = useCallback(() => {
    const dataUrl = viewportRef.current?.captureStill();
    if (!dataUrl) {
      pushToast('Capture failed. Try pausing on a clear frame.', 'error');
      return;
    }
    pushToast('Frame captured for ScreenSnap.', 'success');
  }, [pushToast]);

  const handleTimelineMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!videoSrc) return;
      const template = thumbsGlobRef.current;
      if (!timelineRef.current || !template || !template.includes('%04d')) {
        setHoverPreview(null);
        return;
      }
      const rect = timelineRef.current.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = clampValue((event.clientX - rect.left) / rect.width, 0, 1);
      const time = ratio * timelineMax;
      const frameIndex = Math.max(0, Math.round(time));
      const padded = (frameIndex + 1).toString().padStart(4, '0');
      const url = `${apiBase}${template.replace('%04d', padded)}`;
      const left = clampValue(event.clientX - rect.left, 40, rect.width - 40);
      setHoverPreview({ time, left, url, timeLabel: formatTimestamp(time) });
    },
    [apiBase, timelineMax, videoSrc],
  );

  const handleTimelineLeave = useCallback(() => {
    setHoverPreview(null);
  }, []);

  const handleRefreshHealth = useCallback(() => {
    if (!flags.ingest) {
      disableHealth();
      return;
    }
    refreshHealthAction(apiBase, true).catch((error) => {
      console.error('Unable to refresh ingest health', error);
    });
  }, [apiBase, disableHealth, flags.ingest, refreshHealthAction]);

  useEffect(() => {
    if (!flags.ingest) {
      disableHealth();
      resetIngest();
      return;
    }

    pollHealth(apiBase, true).catch((error) => {
      console.error('Unable to start ingest health polling', error);
    });

    return () => {
      resetHealth();
      resetIngest();
    };
  }, [apiBase, disableHealth, flags.ingest, pollHealth, resetHealth, resetIngest]);

  useEffect(() => {
    if (!flags.ingest) {
      return;
    }
    if (healthStatus !== 'online') {
      return;
    }
    void pollIngest(apiBase, uploadId ?? 'healthcheck');
  }, [apiBase, flags.ingest, healthStatus, pollIngest, uploadId]);

  const triggerExport = async (artifact: string) => {
    if (!flags.exports) {
      setExportMessage('Exports disabled by feature flag.');
      return;
    }
    try {
      const res = await fetch(`/api/export/${artifact}`);
      if (!res.ok) {
        throw new Error('Unable to export artifact');
      }
      const payload = await res.json();
      setExportMessage(`Export ready: ${payload.download_url}`);
    } catch (error) {
      setExportMessage((error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg ${
            toast.tone === 'error'
              ? 'border-red-500/40 bg-red-500/10 text-red-100'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
          }`}
        >
          {toast.message}
        </div>
      )}
      <header className="border-b border-slate-800 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 text-lg font-semibold">
            <Video className="h-6 w-6 text-brand" /> VolleySense Console
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <Layers className="h-4 w-4" /> Modules online: {modules.length}
            <button
              type="button"
              onClick={handleRefreshHealth}
              disabled={healthStatus === 'disabled'}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-brand ${healthTone}${
                healthStatus === 'disabled' ? ' cursor-not-allowed opacity-60' : ''
              }`}
            >
              {healthLabel}
            </button>
            {flags.ingest && (
              <button
                onClick={() => setShowUpload(true)}
                className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white"
              >
                <UploadCloud className="mr-2 inline h-4 w-4" /> Upload
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-6 py-6">
        <div className="flex w-72 flex-col gap-4">
          <ErrorBoundary label="Event Trainer">
            {flags.trainer ? <EventTrainerPanel /> : <DisabledCard label="Trainer" />}
          </ErrorBoundary>
          <ErrorBoundary label="Module Health">
            <div className="module-card">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Module Health</h3>
              <ModuleHealthList modules={modules} />
            </div>
          </ErrorBoundary>
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <section className="relative h-72">
            <VideoViewport
              ref={viewportRef}
              src={videoSrc}
              poster={posterUrl}
              videoRef={videoElementRef}
            />
            {videoSrc && (
              <>
                <OverlayCanvas
                  videoRef={videoElementRef}
                  uploadId={activeUploadId}
                  annotations={annotations}
                  calibration={calibration}
                  mode={tool}
                  onCreate={saveAnnotation}
                  pixelToCourt={calibrationHelpers?.pixelToCourt}
                />
                <div className="absolute left-4 top-4 flex items-center gap-2">
                  {([
                    { id: 'select' as OverlayTool, label: 'Select', icon: <MousePointer2 className="h-4 w-4" />, shortcut: 'V' },
                    { id: 'box' as OverlayTool, label: 'Box', icon: <Square className="h-4 w-4" />, shortcut: 'B' },
                    { id: 'lasso' as OverlayTool, label: 'Lasso', icon: <PenTool className="h-4 w-4" />, shortcut: 'L' },
                  ]).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTool(item.id)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                        tool === item.id
                          ? 'border-brand bg-brand/20 text-brand-100'
                          : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {item.icon}
                      {item.label}
                      <span className="text-[10px] text-slate-500">({item.shortcut})</span>
                    </button>
                  ))}
                  {calibration && (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                      Calibrated
                    </span>
                  )}
                </div>
                <div className="absolute right-4 top-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCalibrationOpen(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-600 bg-slate-900/80 px-3 py-1 text-xs text-slate-200 backdrop-blur focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <Ruler className="h-3.5 w-3.5" /> Calibrate
                  </button>
                  <button
                    type="button"
                    onClick={handleCaptureStill}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-600 bg-slate-900/80 px-3 py-1 text-xs text-slate-200 backdrop-blur focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <Camera className="h-3.5 w-3.5" /> Capture still
                  </button>
                </div>
              </>
            )}
          </section>
          <section className="module-card">
            <div
              ref={timelineRef}
              className="relative h-20"
              onMouseMove={handleTimelineMove}
              onMouseLeave={handleTimelineLeave}
            >
              <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-slate-700" />
              {hoverPreview && (
                <div
                  className="absolute bottom-full mb-3 flex -translate-x-1/2 flex-col items-center"
                  style={{ left: `${hoverPreview.left}px` }}
                >
                  <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-xs shadow-lg">
                    <img
                      src={hoverPreview.url}
                      alt="Timeline preview"
                      className="h-20 w-32 object-cover"
                    />
                    <div className="border-t border-slate-700 px-2 py-1 text-[11px] text-slate-300">
                      {hoverPreview.timeLabel}
                    </div>
                  </div>
                </div>
              )}
              {events.map((event) => (
                <div
                  key={event.id}
                  className="absolute top-2 flex -translate-x-1/2 flex-col items-center"
                  style={{ left: `${(event.timestamp / timelineMax) * 100}%` }}
                >
                  <div className="h-6 w-6 rounded-full border border-brand bg-brand/30 text-center text-xs leading-6">
                    •
                  </div>
                  <span className="mt-2 text-xs text-slate-400">{event.label}</span>
                </div>
              ))}
            </div>
          </section>
          {flags.screenSnap && (
            <ErrorBoundary label="ScreenSnap">
              <ScreenSnapPanel />
            </ErrorBoundary>
          )}
          {loading && <div className="text-xs text-slate-500">Loading match data…</div>}
        </div>
        <div className="w-80 space-y-4">
          <div className="module-card">
            <div className="flex gap-2">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-button ${activeTab === tab.id ? 'tab-button-active' : 'bg-slate-800 text-slate-300'}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <ErrorBoundary label={`${activeTab} panel`}>
                {availableTabs.find((tab) => tab.id === activeTab)?.element}
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </main>
      <footer className="border-t border-slate-800 bg-slate-950/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Exports</div>
          <div className="flex gap-3">
            {['report', 'highlights', 'coach-notes'].map((artifact) => (
              <button
                key={artifact}
                onClick={() => triggerExport(artifact)}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide hover:border-brand"
              >
                {artifact}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-400">{exportMessage ?? 'Select an export to queue a download link.'}</div>
        </div>
      </footer>
      <UploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onShowLogs={handleViewLogs}
        apiUrl={apiBase}
      />
      <CalibrationWizard
        open={calibrationOpen}
        onClose={() => setCalibrationOpen(false)}
        videoRef={videoElementRef}
        uploadId={activeUploadId ?? undefined}
        apiBase={apiBase}
        onSaved={handleCalibrationSaved}
      />
    </div>
  );
};

const DisabledCard: React.FC<{ label: string }> = ({ label }) => (
  <div className="module-card text-xs text-slate-400">
    {label} module disabled by environment flag.
  </div>
);

const App: React.FC = () => (
  <FeatureFlagsProvider>
    <AppShell />
  </FeatureFlagsProvider>
);

export default App;
