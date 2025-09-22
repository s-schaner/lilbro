import {
  EventDefinition,
  EventMarker,
  ExplainPayload,
  InsightPayload,
  ModuleStatus,
  OverlaySnapshot,
  Player,
  ScreenSnapResult,
  VideoIngestResponse
} from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const jsonHeaders = {
  'Content-Type': 'application/json'
};

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeout = 8000
): Promise<Response> => {
  const controller = new AbortController();
  const signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), timeout);
  const { signal: externalSignal, ...rest } = init;
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  try {
    return await fetch(input, { ...rest, signal });
  } catch (error) {
    if ((error as DOMException).name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

export const fetchEvents = async (gameId: string): Promise<EventMarker[]> => {
  const res = await fetchWithTimeout(`${API_URL}/events?game_id=${encodeURIComponent(gameId)}`);
  if (!res.ok) {
    throw new Error('Failed to fetch events');
  }
  return (await res.json()) as EventMarker[];
};

export const fetchPlayers = async (gameId: string): Promise<Player[]> => {
  const res = await fetchWithTimeout(`${API_URL}/stats?game_id=${encodeURIComponent(gameId)}`);
  if (!res.ok) {
    throw new Error('Failed to fetch stats');
  }
  const payload = await res.json();
  return payload.players as Player[];
};

export const fetchEventDefinitions = async (): Promise<EventDefinition[]> => {
  const res = await fetchWithTimeout(`${API_URL}/trainer/events`);
  if (!res.ok) {
    throw new Error('Failed to load trainer events');
  }
  return (await res.json()) as EventDefinition[];
};

export const saveEventDefinition = async (
  definition: EventDefinition
): Promise<EventDefinition> => {
  const res = await fetchWithTimeout(`${API_URL}/trainer/events`, {
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
  const res = await fetchWithTimeout(
    `${API_URL}/trainer/preview?eventId=${encodeURIComponent(eventId)}&game_id=${encodeURIComponent(gameId)}`
  );
  if (!res.ok) {
    throw new Error('Failed to load preview events');
  }
  return (await res.json()) as EventMarker[];
};

export const fetchExplain = async (eventId: string): Promise<ExplainPayload> => {
  const res = await fetchWithTimeout(`${API_URL}/trainer/explain?event_id=${encodeURIComponent(eventId)}`);
  if (!res.ok) {
    throw new Error('Failed to load explain data');
  }
  return (await res.json()) as ExplainPayload;
};

export const downloadExport = async (path: string, filename: string) => {
  const res = await fetchWithTimeout(`${API_URL}${path}`, undefined, 10000);
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
  const res = await fetchWithTimeout(`${API_URL}/video/analyze`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ game_id: gameId })
  });
  if (!res.ok) {
    throw new Error('Failed to start analysis');
  }
  return res.json() as Promise<{ game_id: string; status: string }>;
};

export const fetchInsights = async (gameId: string): Promise<InsightPayload> => {
  const res = await fetchWithTimeout(`${API_URL}/insights?game_id=${encodeURIComponent(gameId)}`);
  if (!res.ok) {
    throw new Error('Failed to load insights');
  }
  return (await res.json()) as InsightPayload;
};

export const postScreenSnap = async (
  payload: { focus: string; prompt?: string; context?: Record<string, unknown>; imageB64: string }
): Promise<ScreenSnapResult> => {
  const res = await fetchWithTimeout(`${API_URL}/screensnap`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      focus: payload.focus,
      context: payload.context,
      system_prompt: payload.prompt,
      image_b64: payload.imageB64
    })
  });
  if (!res.ok) {
    throw new Error('Failed to analyze screenshot');
  }
  return (await res.json()) as ScreenSnapResult;
};

export const fetchOverlaySnapshot = async (
  gameId: string,
  time: number
): Promise<OverlaySnapshot> => {
  const res = await fetchWithTimeout(
    `${API_URL}/overlays?game_id=${encodeURIComponent(gameId)}&t=${encodeURIComponent(time)}`
  );
  if (!res.ok) {
    throw new Error('Failed to load overlays');
  }
  return (await res.json()) as OverlaySnapshot;
};

export const fetchModules = async (): Promise<ModuleStatus[]> => {
  const res = await fetchWithTimeout(`${API_URL}/modules`);
  if (!res.ok) {
    throw new Error('Failed to load modules');
  }
  return (await res.json()) as ModuleStatus[];
};

export const toggleModule = async (moduleId: string, enabled: boolean): Promise<ModuleStatus> => {
  const res = await fetchWithTimeout(`${API_URL}/modules/${moduleId}`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ enabled })
  });
  if (!res.ok) {
    throw new Error('Failed to toggle module');
  }
  return (await res.json()) as ModuleStatus;
};

export const postIngest = async (file: File): Promise<VideoIngestResponse> => {
  const form = new FormData();
  form.append('file', file);
  const res = await fetchWithTimeout(`${API_URL}/video/ingest`, {
    method: 'POST',
    body: form
  });
  if (!res.ok) {
    throw new Error('Failed to ingest video');
  }
  return (await res.json()) as VideoIngestResponse;
};
