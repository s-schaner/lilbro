import {
  EventDefinition,
  EventMarker,
  Player,
  ExplainPayload,
  ModuleStatus,
  InsightPayload,
  ScreenSnapResponse,
  OverlayPayload,
  IngestJob
} from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const jsonHeaders = {
  'Content-Type': 'application/json'
};

export const fetchEvents = async (gameId: string): Promise<EventMarker[]> => {
  const res = await fetch(`${API_URL}/events?game_id=${encodeURIComponent(gameId)}`);
  if (!res.ok) {
    throw new Error('Failed to fetch events');
  }
  return (await res.json()) as EventMarker[];
};

export const fetchPlayers = async (gameId: string): Promise<Player[]> => {
  const res = await fetch(`${API_URL}/stats?game_id=${encodeURIComponent(gameId)}`);
  if (!res.ok) {
    throw new Error('Failed to fetch stats');
  }
  const payload = await res.json();
  return payload.players as Player[];
};

export const fetchEventDefinitions = async (): Promise<EventDefinition[]> => {
  const res = await fetch(`${API_URL}/trainer/events`);
  if (!res.ok) {
    throw new Error('Failed to load trainer events');
  }
  return (await res.json()) as EventDefinition[];
};

export const saveEventDefinition = async (
  definition: EventDefinition
): Promise<EventDefinition> => {
  const res = await fetch(`${API_URL}/trainer/events`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(definition)
  });
  if (!res.ok) {
    throw new Error('Failed to save trainer event');
  }
  return (await res.json()) as EventDefinition;
};

export const fetchPreviewEvents = async (
  eventId: string,
  gameId: string
): Promise<EventMarker[]> => {
  const res = await fetch(
    `${API_URL}/trainer/preview?eventId=${encodeURIComponent(eventId)}&game_id=${encodeURIComponent(gameId)}`
  );
  if (!res.ok) {
    throw new Error('Failed to load preview events');
  }
  return (await res.json()) as EventMarker[];
};

export const fetchExplain = async (eventId: string): Promise<ExplainPayload> => {
  const res = await fetch(`${API_URL}/explain?event_id=${encodeURIComponent(eventId)}`);
  if (!res.ok) {
    throw new Error('Failed to load explain data');
  }
  return (await res.json()) as ExplainPayload;
};

export const downloadExport = async (path: string, filename: string) => {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    throw new Error('Failed to download export');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const postAnalyze = async (gameId: string) => {
  const res = await fetch(`${API_URL}/analyze`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ game_id: gameId })
  });
  if (!res.ok) {
    throw new Error('Failed to start analysis');
  }
  return res.json() as Promise<{ game_id: string; status: string }>;
};

export const fetchModules = async (): Promise<ModuleStatus[]> => {
  const res = await fetch(`${API_URL}/modules`);
  if (!res.ok) {
    throw new Error('Failed to load modules');
  }
  return (await res.json()) as ModuleStatus[];
};

export const toggleModule = async (moduleId: string, enabled: boolean): Promise<ModuleStatus> => {
  const res = await fetch(`${API_URL}/modules/${encodeURIComponent(moduleId)}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ enabled })
  });
  if (!res.ok) {
    throw new Error('Failed to toggle module');
  }
  return (await res.json()) as ModuleStatus;
};

export const fetchInsights = async (gameId: string): Promise<InsightPayload> => {
  const res = await fetch(`${API_URL}/insights?game_id=${encodeURIComponent(gameId)}`);
  if (!res.ok) {
    throw new Error('Failed to fetch insights');
  }
  return (await res.json()) as InsightPayload;
};

export const analyzeScreenshot = async (
  focus: string,
  image_b64: string,
  context: Record<string, unknown>
): Promise<ScreenSnapResponse> => {
  const res = await fetch(`${API_URL}/screensnap`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ focus, image_b64, context })
  });
  if (!res.ok) {
    throw new Error('Failed to analyze screenshot');
  }
  return (await res.json()) as ScreenSnapResponse;
};

export const fetchOverlays = async (gameId: string, ts: number): Promise<OverlayPayload> => {
  const res = await fetch(
    `${API_URL}/overlays?game_id=${encodeURIComponent(gameId)}&ts=${encodeURIComponent(ts)}`
  );
  if (!res.ok) {
    throw new Error('Failed to fetch overlays');
  }
  return (await res.json()) as OverlayPayload;
};

export const ingestVideo = async (file: File): Promise<IngestJob> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}/ingest`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    throw new Error('Failed to ingest video');
  }
  return (await res.json()) as IngestJob;
};

export const pollIngestJob = async (jobId: string): Promise<IngestJob> => {
  const res = await fetch(`${API_URL}/ingest/${encodeURIComponent(jobId)}`);
  if (!res.ok) {
    throw new Error('Failed to fetch ingest job');
  }
  return (await res.json()) as IngestJob;
};
