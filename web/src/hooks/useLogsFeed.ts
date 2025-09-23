import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LogEntry, LogFilters } from '../data/types';

type ConnectionStatus = 'idle' | 'connecting' | 'streaming' | 'polling' | 'error';

interface UseLogsFeedOptions {
  limit?: number;
}

interface LogsResponse {
  logs: LogEntry[];
}

export interface UseLogsFeedResult {
  entries: LogEntry[];
  status: ConnectionStatus;
  error?: string;
  clear: () => void;
  reconnect: () => void;
}

const DEFAULT_LIMIT = 400;
const POLL_INTERVAL_MS = 2000;
const RECONNECT_TIMEOUT_MS = 10000;

const normalizeBase = (base: string) => base.replace(/\/$/, '');

const buildQuery = (filters: LogFilters, limit: number) => {
  const params = new URLSearchParams();
  if (filters.level) {
    params.set('level', filters.level);
  }
  if (filters.source) {
    params.set('source', filters.source);
  }
  if (filters.search) {
    params.set('search', filters.search);
  }
  params.set('limit', String(limit));
  // Some deployments may still expect `n` for backwards compatibility.
  params.set('n', String(limit));
  return params;
};

export const useLogsFeed = (
  apiBase: string,
  filters: LogFilters,
  options?: UseLogsFeedOptions,
): UseLogsFeedResult => {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const { level, source, search } = filters;

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string>();

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const [generation, setGeneration] = useState(0);

  const normalizedBase = useMemo(() => normalizeBase(apiBase), [apiBase]);

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  const reconnect = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const cleanup = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const applyLimit = (items: LogEntry[]) => {
      if (items.length <= limit) {
        return items;
      }
      return items.slice(-limit);
    };

    const updateEntries = (updater: LogEntry | LogEntry[]) => {
      setEntries((prev) => {
        if (Array.isArray(updater)) {
          return applyLimit([...updater]);
        }
        const next = [...prev, updater];
        return applyLimit(next);
      });
    };

    const query = buildQuery({ level, source, search }, limit);

    const poll = async () => {
      try {
        const response = await fetch(`${normalizedBase}/logs?${query.toString()}`);
        if (!response.ok) {
          throw new Error(`Log fetch failed (${response.status})`);
        }
        const payload = (await response.json()) as LogsResponse;
        if (cancelled) {
          return;
        }
        updateEntries(payload.logs ?? []);
        setError(undefined);
      } catch (pollError) {
        if (cancelled) {
          return;
        }
        setError((pollError as Error).message);
      }
    };

    const startPolling = () => {
      cleanup();
      if (cancelled) {
        return;
      }
      setStatus('polling');
      poll();
      pollTimerRef.current = window.setInterval(poll, POLL_INTERVAL_MS);
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnect();
      }, RECONNECT_TIMEOUT_MS);
    };

    const startStream = () => {
      cleanup();
      if (cancelled) {
        return;
      }

      if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
        startPolling();
        return;
      }

      setStatus('connecting');
      setError(undefined);

      try {
        const source = new EventSource(`${normalizedBase}/logs/stream?${query.toString()}`);
        eventSourceRef.current = source;

        source.onopen = () => {
          if (cancelled) {
            return;
          }
          setStatus('streaming');
        };

        source.onmessage = (event) => {
          if (cancelled) {
            return;
          }

          try {
            const payload = JSON.parse(event.data) as LogEntry;
            updateEntries(payload);
          } catch (parseError) {
            // Ignore malformed payloads but surface the failure for visibility.
            setError((parseError as Error).message);
          }
        };

        source.onerror = () => {
          if (cancelled) {
            return;
          }
          setError('Live log stream disconnected. Retrying with polling.');
          startPolling();
        };
      } catch (streamError) {
        if (cancelled) {
          return;
        }
        setError((streamError as Error).message);
        startPolling();
      }
    };

    setEntries([]);
    startStream();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [generation, level, limit, normalizedBase, reconnect, search, source]);

  return {
    entries,
    status,
    error,
    clear,
    reconnect,
  };
};
