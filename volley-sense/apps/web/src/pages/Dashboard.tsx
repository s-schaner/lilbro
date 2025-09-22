import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TopBar from '@components/TopBar';
import EventTrainerPanel from '@components/EventTrainerPanel';
import VideoPlayer from '@components/VideoPlayer';
import Timeline from '@components/Timeline';
import RightPanel from '@components/RightPanel';
import FooterBar from '@components/FooterBar';
import TeachEventModal from '@components/TeachEventModal';
import ModuleSettingsModal from '@components/ModuleSettingsModal';
import ScreenshotDrawer from '@components/ScreenshotDrawer';
import ModuleBoundary from '@components/ModuleBoundary';
import {
  fetchInsights,
  fetchEventDefinitions,
  fetchEvents,
  fetchExplain,
  fetchModules,
  fetchPlayers,
  fetchPreviewEvents,
  postAnalyze,
  postIngest,
  postScreenSnap,
  toggleModule,
  saveEventDefinition
} from '@lib/api';
import {
  EventDefinition,
  EventMarker,
  ExplainPayload,
  InsightPayload,
  ModuleStatus,
  Player,
  ScreenSnapResult
} from '@lib/types';
import { useTrainerStore, buildDefinition } from '@store/useTrainerStore';
import { useVideoStore } from '@store/useVideoStore';

const Dashboard = () => {
  const [gameId, setGameId] = useState('demo-1');
  const [players, setPlayers] = useState<Player[]>([]);
  const [baseEvents, setBaseEvents] = useState<EventMarker[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [explainPayload, setExplainPayload] = useState<ExplainPayload | undefined>();
  const [modules, setModules] = useState<ModuleStatus[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [insights, setInsights] = useState<InsightPayload | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerImage, setDrawerImage] = useState<string>();
  const [drawerTimestamp, setDrawerTimestamp] = useState(0);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerAnalysis, setDrawerAnalysis] = useState<ScreenSnapResult | null>(null);
  const [imageAnalyses, setImageAnalyses] = useState<ScreenSnapResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    definitions,
    previewMarkers,
    loadingPreviews,
    upsertDefinition,
    toggleDefinition,
    setDefinitions,
    setPreviewMarkers,
    setPreviewLoading,
    lastExplainedId,
    setLastExplained
  } = useTrainerStore();
  const { currentTime, duration, seek, setMarkers } = useVideoStore();

  const activeMarkers = useMemo(() => {
    const enabledIds = new Set(definitions.filter((item) => item.enabled).map((item) => item.id));
    const preview: EventMarker[] = Object.entries(previewMarkers)
      .filter(([eventId]) => enabledIds.has(eventId))
      .flatMap(([, events]) => events);
    return [...baseEvents, ...preview];
  }, [baseEvents, previewMarkers, definitions]);

  useEffect(() => {
    setMarkers(activeMarkers);
  }, [activeMarkers, setMarkers]);

  useEffect(() => {
    const load = async () => {
      try {
        const [fetchedEvents, fetchedPlayers] = await Promise.all([
          fetchEvents(gameId).catch(() => [] as EventMarker[]),
          fetchPlayers(gameId).catch(() => [] as Player[])
        ]);
        setBaseEvents(fetchedEvents);
        setPlayers(fetchedPlayers);
      } catch (error) {
        console.error(error);
        setSnackbar('Unable to load match data. Check API availability.');
      }
    };
    load();
  }, [gameId]);

  useEffect(() => {
    const loadDefinitions = async () => {
      try {
        const remote = await fetchEventDefinitions();
        if (remote.length) {
          setDefinitions(remote);
        }
      } catch (error) {
        console.warn('Failed to sync trainer definitions', error);
      }
    };
    loadDefinitions();
  }, [setDefinitions]);

  const refreshModules = useCallback(async () => {
    try {
      const payload = await fetchModules();
      setModules(payload);
    } catch (error) {
      console.error(error);
      setSnackbar('Unable to load module registry.');
    }
  }, []);

  useEffect(() => {
    void refreshModules();
  }, [refreshModules]);

  const loadInsights = useCallback(async (selectedGame: string) => {
    const module = modules.find((item) => item.id === 'llm-insights');
    if (!module || !module.enabled || module.status !== 'healthy') {
      setInsights(null);
      return;
    }
    setInsightsLoading(true);
    try {
      const payload = await fetchInsights(selectedGame);
      setInsights(payload);
    } catch (error) {
      console.error(error);
      setSnackbar('AI insights unavailable.');
    } finally {
      setInsightsLoading(false);
    }
  }, [modules]);

  useEffect(() => {
    if (!modules.length) {
      return;
    }
    void loadInsights(gameId);
  }, [gameId, modules, loadInsights]);

  const handleToggle = async (id: string) => {
    toggleDefinition(id);
    const updated = useTrainerStore.getState().definitions.find((item) => item.id === id);
    if (updated) {
      try {
        await saveEventDefinition(updated);
      } catch (error) {
        console.error(error);
        setSnackbar('Unable to persist trainer definition.');
      }
    }
  };

  const handleThreshold = async (id: string, value: number) => {
    const existing = useTrainerStore.getState().definitions.find((item) => item.id === id);
    if (!existing) {
      return;
    }
    const updated: EventDefinition = { ...existing, threshold: value };
    upsertDefinition(updated);
    try {
      await saveEventDefinition(updated);
      setSnackbar(`Threshold updated to ${Math.round(value * 100)}%.`);
    } catch (error) {
      console.error(error);
      setSnackbar('Unable to save threshold.');
    }
  };

  const handlePreview = async (id: string) => {
    setPreviewLoading(id, true);
    try {
      const events = await fetchPreviewEvents(id, gameId);
      setPreviewMarkers(id, events);
      setSnackbar('Preview detections loaded. Purple markers added to the timeline.');
    } catch (error) {
      console.error(error);
      setSnackbar('Unable to load preview events.');
    } finally {
      setPreviewLoading(id, false);
    }
  };

  const handleExplain = async (id: string) => {
    try {
      const payload = await fetchExplain(id);
      setExplainPayload(payload);
      setLastExplained(id);
    } catch (error) {
      console.error(error);
      setSnackbar('Explain insights unavailable.');
    }
  };

  const handleClips = (id: string) => {
    const definition = definitions.find((item) => item.id === id);
    setSnackbar(
      definition
        ? `Highlight clips queued for ${definition.name}. Delivery will appear in Clips tray.`
        : 'Highlight clips queued.'
    );
  };

  const handleModalSubmit = async ({
    name,
    template,
    threshold
  }: {
    name: string;
    template: EventDefinition['template'];
    threshold: number;
  }) => {
    const definition = buildDefinition({ name, template, threshold });
    upsertDefinition(definition);
    setShowModal(false);
    try {
      await saveEventDefinition(definition);
      setSnackbar(`${name} saved. Shadow testing now running.`);
    } catch (error) {
      console.error(error);
      setSnackbar('Unable to sync new event. Saved locally.');
    }
  };

  const handleAnalyze = async (focus: string, prompt: string) => {
    if (!drawerImage) {
      return;
    }
    setDrawerLoading(true);
    try {
      const imageB64 = drawerImage.includes(',') ? drawerImage.split(',')[1] ?? '' : drawerImage;
      const result = await postScreenSnap({
        focus,
        prompt,
        context: { timestamp: drawerTimestamp },
        imageB64
      });
      const enriched: ScreenSnapResult = {
        ...result,
        timestamp: drawerTimestamp,
        imageDataUrl: drawerImage
      };
      setDrawerAnalysis(enriched);
    } catch (error) {
      console.error(error);
      setSnackbar('Screenshot analysis failed.');
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleCaptureFrame = ({ image, timestamp }: { image: string; timestamp: number }) => {
    setDrawerImage(image);
    setDrawerTimestamp(timestamp);
    setDrawerAnalysis(null);
    setDrawerOpen(true);
  };

  const handleSaveAnalysis = () => {
    if (!drawerAnalysis) {
      return;
    }
    setImageAnalyses((prev) => [...prev, drawerAnalysis]);
    setBaseEvents((prev) => [
      ...prev,
      {
        t: drawerTimestamp,
        label: drawerAnalysis.summary,
        kind: 'custom',
        conf: drawerAnalysis.confidence
      }
    ]);
    setSnackbar('Screenshot analysis pinned to the timeline.');
    setDrawerOpen(false);
  };

  const handleExplainLast = () => {
    const candidate = lastExplainedId ?? definitions.find((item) => item.enabled)?.id;
    if (candidate) {
      void handleExplain(candidate);
    } else {
      setSnackbar('No event selected for explanation yet.');
    }
  };

  const handleToggleModule = async (moduleId: string, enabled: boolean) => {
    try {
      const result = await toggleModule(moduleId, enabled);
      setModules((prev) => prev.map((item) => (item.id === moduleId ? result : item)));
      setSnackbar(`${result.name} ${result.enabled ? 'enabled' : 'disabled'}.`);
      if (moduleId === 'llm-insights') {
        void loadInsights(gameId);
      }
    } catch (error) {
      console.error(error);
      setSnackbar('Unable to update module state.');
    }
  };

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const payload = await postIngest(file);
      setSnackbar(`Upload queued: proxy ready at ${payload.proxy}.`);
      void postAnalyze(gameId).catch((error) => console.warn('Analyze not started', error));
    } catch (error) {
      console.error(error);
      setSnackbar('Upload failed. Unsupported format?');
    } finally {
      event.target.value = '';
    }
  };

  useEffect(() => {
    if (!snackbar) {
      return;
    }
    const timeout = window.setTimeout(() => setSnackbar(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [snackbar]);

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-950 px-6 pb-6 pt-4">
      <TopBar
        activeMatch={gameId}
        onMatchChange={(value) => {
          setGameId(value);
          setSnackbar(`Switched to match ${value}.`);
        }}
        onUpload={handleUpload}
        onSettings={() => setSettingsOpen(true)}
        onHelp={() => setSnackbar('Help center launching soon.')}
      />
      <input ref={fileInputRef} type="file" accept=".mp4,.mov,.mkv,.webm,.avi" className="hidden" onChange={handleFileChange} />
      <div className="flex flex-1 gap-4">
        <ModuleBoundary moduleId="event-trainer" modules={modules} onRetry={refreshModules}>
          <EventTrainerPanel
            events={definitions}
            loadingMap={loadingPreviews}
            explainedId={lastExplainedId}
            explainPayload={explainPayload}
            onTeach={() => setShowModal(true)}
            onToggle={handleToggle}
            onThresholdChange={handleThreshold}
            onPreview={handlePreview}
            onExplain={handleExplain}
            onClips={handleClips}
          />
        </ModuleBoundary>
        <div className="flex flex-1 flex-col gap-4">
          <VideoPlayer gameId={gameId} modules={modules} onCaptureFrame={handleCaptureFrame} onExplainLast={handleExplainLast} />
          <ModuleBoundary moduleId="timeline" modules={modules} onRetry={refreshModules}>
            <Timeline markers={activeMarkers} currentTime={currentTime} duration={duration} onSeek={seek} />
          </ModuleBoundary>
        </div>
        <RightPanel
          players={players}
          events={activeMarkers}
          onSeek={seek}
          modules={modules}
          insights={insights}
          insightsLoading={insightsLoading}
          onRefreshInsights={() => loadInsights(gameId)}
          imageAnalyses={imageAnalyses}
          onRetryModule={refreshModules}
        />
      </div>
      <FooterBar gameId={gameId} />
      <TeachEventModal open={showModal} onClose={() => setShowModal(false)} onSubmit={handleModalSubmit} />
      <ModuleSettingsModal
        open={settingsOpen}
        modules={modules}
        onClose={() => setSettingsOpen(false)}
        onToggle={handleToggleModule}
        onRefresh={refreshModules}
      />
      <ScreenshotDrawer
        open={drawerOpen}
        image={drawerImage}
        timestamp={drawerTimestamp}
        loading={drawerLoading}
        analysis={drawerAnalysis}
        onClose={() => setDrawerOpen(false)}
        onAnalyze={({ focus, prompt }) => handleAnalyze(focus, prompt)}
        onSave={drawerAnalysis ? handleSaveAnalysis : undefined}
      />
      {snackbar ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2 text-sm text-slate-100 shadow-lg">
          {snackbar}
        </div>
      ) : null}
    </div>
  );
};

export default Dashboard;
