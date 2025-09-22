import { EventDefinition, EventMarker, Player, ExplainPayload } from './types';

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
