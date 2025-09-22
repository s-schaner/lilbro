import { useEffect, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';

import ModuleBoundary from '@components/ModuleBoundary';
import TopBar from '@components/TopBar';
import EventTrainerPanel from '@components/EventTrainerPanel';
import VideoPlayer from '@components/VideoPlayer';
import Timeline from '@components/Timeline';
import RightPanel, { ImageAnalysisEntry } from '@components/RightPanel';
import FooterBar from '@components/FooterBar';
import EventTeachingWorkspace from '@components/EventTeachingWorkspace';
import {
  fetchEventDefinitions,
  fetchEvents,
  fetchExplain,
  fetchInsights,
  fetchPlayers,
  fetchPreviewEvents,
  ingestVideo,
  pollIngestJob,
  saveEventDefinition
} from '@lib/api';
import {
  EventDefinition,
  EventMarker,
  ExplainPayload,
  IngestJob,
  InsightPayload,
  Player,
  ScreenSnapResponse
} from '@lib/types';
import { useModule } from '@context/ModuleContext';
import { useEventBus } from '@context/EventBusContext';
import { useTrainerStore, buildDefinition } from '@store/useTrainerStore';
import { useVideoStore } from '@store/useVideoStore';

const Dashboard = () => {
  const [gameId, setGameId] = useState('demo-1');
  const [players, setPlayers] = useState<Player[]>([]);
  const [baseEvents, setBaseEvents] = useState<EventMarker[]>([]);
  const [snapMarkers, setSnapMarkers] = useState<EventMarker[]>([]);
  const [imageAnalyses, setImageAnalyses] = useState<ImageAnalysisEntry[]>([]);
  const [insights, setInsights] = useState<InsightPayload | null>(null);
  const [teachState, setTeachState] = useState<{ open: boolean; timestamp: number }>({
    open: false,
    timestamp: 0
  });
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [explainPayload, setExplainPayload] = useState<ExplainPayload | undefined>();
  const [ingestJob, setIngestJob] = useState<IngestJob | null>(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
  const bus = useEventBus();
  const insightsModule = useModule('llm-insights');

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
  const currentTime = useVideoStore((state) => state.currentTime);
  const duration = useVideoStore((state) => state.duration);
  const seek = useVideoStore((state) => state.seek);
  const setMarkers = useVideoStore((state) => state.setMarkers);
  const setSource = useVideoStore((state) => state.setSource);
  const videoSource = useVideoStore((state) => state.source);

  const activeMarkers = useMemo(() => {
    const enabledIds = new Set(definitions.filter((item) => item.enabled).map((item) => item.id));
    const preview: EventMarker[] = Object.entries(previewMarkers)
      .filter(([eventId]) => enabledIds.has(eventId))
      .flatMap(([, events]) => events);
    return [...baseEvents, ...preview, ...snapMarkers];
  }, [baseEvents, previewMarkers, definitions, snapMarkers]);

  useEffect(() => {
    setMarkers(activeMarkers);
  }, [activeMarkers, setMarkers]);

  useEffect(() => {
    const load = async () => {
      try {
        const [fetchedEvents, fetchedPlayers] = await Promise.all([
          fetchEvents(gameId),
          fetchPlayers(gameId)
        ]);
        setBaseEvents(fetchedEvents);
        setPlayers(fetchedPlayers);
      } catch (error) {
        console.error(error);
        setSnackbar('Unable to load match data. Check API availability.');
      }
    };
    void load();
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

  const handleExplainLastEvent = () => {
    if (lastExplainedId) {
      void handleExplain(lastExplainedId);
    } else {
      setSnackbar('Explain an event from the trainer panel first.');
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

  const handleDefinitionCreate = async ({
    name,
    template,
    threshold
  }: {
    name: string;
    template: EventDefinition['template'];
    threshold: number;
  }): Promise<EventDefinition | undefined> => {
    const definition = buildDefinition({ name, template, threshold });
    upsertDefinition(definition);
    try {
      await saveEventDefinition(definition);
      setSnackbar(`${name} saved. Shadow testing now running.`);
      return definition;
    } catch (error) {
      console.error(error);
      setSnackbar('Unable to sync new event. Saved locally.');
      return definition;
    }
  };

  useEffect(() => {
    if (!snackbar) {
      return;
    }
    const timeout = window.setTimeout(() => setSnackbar(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [snackbar]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 't') {
        event.preventDefault();
        setTeachState((state) =>
          state.open
            ? state
            : {
                open: true,
                timestamp: currentTime
              }
        );
        setSnackbar('Teaching workspace opened from shortcut. Tap the canvas to start boxing or lassoing.');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentTime]);

  const handleUpload = async (file: File) => {
    try {
      const job = await ingestVideo(file);
      setIngestJob(job);
      const url = URL.createObjectURL(file);
      setSource(url);
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl);
      }
      setVideoObjectUrl(url);
      setSnackbar('Video uploaded. Transcoding to mezzanine stream.');
    } catch (error) {
      console.error(error);
      setSnackbar('Video ingest failed.');
    }
  };

  useEffect(() => {
    if (!ingestJob || ingestJob.status === 'complete') {
      return;
    }
    const interval = window.setInterval(async () => {
      try {
        const updated = await pollIngestJob(ingestJob.job_id);
        setIngestJob(updated);
        if (updated.status === 'complete') {
          bus.emit('snackbar', 'Proxy stream ready. Overlays synced.');
          window.clearInterval(interval);
        }
      } catch (error) {
        console.error(error);
      }
    }, 1500);
    return () => window.clearInterval(interval);
  }, [ingestJob, bus]);

  useEffect(() => {
    if (insightsModule && !insightsModule.enabled) {
      setInsights(null);
      return;
    }
    const loadInsights = async () => {
      try {
        const payload = await fetchInsights(gameId);
        setInsights(payload);
      } catch (error) {
        console.warn('Insights unavailable', error);
        setInsights(null);
      }
    };
    void loadInsights();
  }, [gameId, insightsModule]);

  useEffect(() => {
    const handlePin = (marker: EventMarker) => {
      setSnapMarkers((previous) => [...previous, marker]);
    };
    const handleAnalysis = ({
      note
    }: {
      note: ScreenSnapResponse & { focus: string; timestamp: number };
    }) => {
      setImageAnalyses((previous) => [
        {
          id: nanoid(),
          summary: note.summary,
          focus: note.focus,
          timestamp: note.timestamp,
          observations: note.observations,
          corrections: note.corrections,
          confidence: note.confidence
        },
        ...previous
      ]);
    };
    const handleSnackbar = (message: string) => {
      setSnackbar(message);
    };

    bus.on('timeline:pin', handlePin);
    bus.on('analysis:add', handleAnalysis);
    bus.on('snackbar', handleSnackbar);
    return () => {
      bus.off('timeline:pin', handlePin);
      bus.off('analysis:add', handleAnalysis);
      bus.off('snackbar', handleSnackbar);
    };
  }, [bus]);

  useEffect(() => {
    return () => {
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl);
      }
    };
  }, [videoObjectUrl]);

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-950 px-6 pb-6 pt-4">
      <TopBar activeMatch={gameId} onMatchChange={setGameId} onUpload={handleUpload} />
      <div className="flex flex-1 gap-4">
        <div className="flex w-80">
          <ModuleBoundary moduleId="event-trainer">
            <EventTrainerPanel
              events={definitions}
              loadingMap={loadingPreviews}
              explainedId={lastExplainedId}
              explainPayload={explainPayload}
              onTeach={() => {
                setTeachState({
                  open: true,
                  timestamp: currentTime
                });
                setSnackbar('Teaching workspace opened. Annotate the clip to add a new example.');
              }}
              onToggle={handleToggle}
              onThresholdChange={handleThreshold}
              onPreview={handlePreview}
              onExplain={handleExplain}
              onClips={handleClips}
            />
          </ModuleBoundary>
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <ModuleBoundary moduleId="core-video">
            <VideoPlayer gameId={gameId} onExplainLast={handleExplainLastEvent} />
          </ModuleBoundary>
          <ModuleBoundary moduleId="timeline">
            <Timeline
              markers={activeMarkers}
              currentTime={currentTime}
              duration={duration}
              onSeek={seek}
              onTeachAt={(time) => {
                setTeachState({
                  open: true,
                  timestamp: time
                });
                setSnackbar(`Teaching workspace opened at ${time.toFixed(1)}s.`);
              }}
            />
          </ModuleBoundary>
        </div>
        <RightPanel players={players} events={activeMarkers} onSeek={seek} insights={insights} imageAnalyses={imageAnalyses} />
      </div>
      <FooterBar gameId={gameId} ingestStatus={ingestJob?.status} />
      <EventTeachingWorkspace
        open={teachState.open}
        timestamp={teachState.timestamp}
        duration={duration}
        videoSrc={videoSource}
        players={players}
        onClose={() => setTeachState((state) => ({ ...state, open: false }))}
        onCreateDefinition={handleDefinitionCreate}
        onNotify={(message) => setSnackbar(message)}
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
