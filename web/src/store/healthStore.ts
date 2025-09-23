import { create } from 'zustand';

type IngestHealthStatus = 'online' | 'degraded' | 'loading' | 'disabled';

interface HealthState {
  ingestStatus: IngestHealthStatus;
  error: string | null;
  lastCheckedAt: number | null;
  pollIntervalMs: number;
  poll: (apiBase: string, enabled?: boolean) => Promise<void>;
  refresh: (apiBase: string, enabled?: boolean) => Promise<void>;
  disable: () => void;
  reset: () => void;
}

const INITIAL_STATE: Omit<HealthState, 'poll' | 'refresh' | 'disable' | 'reset'> = {
  ingestStatus: 'loading',
  error: null,
  lastCheckedAt: null,
  pollIntervalMs: 15000,
};

let healthTimer: ReturnType<typeof setInterval> | null = null;

export const useHealthStore = create<HealthState>((set, get) => {
  const clearTimer = () => {
    if (healthTimer) {
      clearInterval(healthTimer);
      healthTimer = null;
    }
  };

  const checkHealth = async (apiBase: string): Promise<void> => {
    try {
      const response = await fetch(`${apiBase}/ingest/health`);
      if (!response.ok) {
        throw new Error('Unable to check ingest health');
      }
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (payload.ok) {
        set({ ingestStatus: 'online', error: null, lastCheckedAt: Date.now() });
      } else {
        set({
          ingestStatus: 'degraded',
          error: payload.message ?? 'Ingest reported degraded health.',
          lastCheckedAt: Date.now(),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to check ingest health';
      set({ ingestStatus: 'degraded', error: message, lastCheckedAt: Date.now() });
    }
  };

  return {
    ...INITIAL_STATE,
    async poll(apiBase, enabled = true) {
      if (!enabled) {
        clearTimer();
        set({ ingestStatus: 'disabled', error: null });
        return;
      }
      if (healthTimer) {
        return;
      }
      await checkHealth(apiBase);
      const interval = get().pollIntervalMs;
      healthTimer = setInterval(() => {
        void checkHealth(apiBase);
      }, interval);
    },
    async refresh(apiBase, enabled = true) {
      if (!enabled) {
        clearTimer();
        set({ ingestStatus: 'disabled', error: null });
        return;
      }
      await checkHealth(apiBase);
    },
    disable() {
      clearTimer();
      set({ ingestStatus: 'disabled', error: null });
    },
    reset() {
      clearTimer();
      set({ ...INITIAL_STATE });
    },
  };
});

export const getHealthStore = useHealthStore.getState;
