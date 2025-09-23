import { create } from 'zustand';

import { UploadResponse, UploadStatus } from '../data/types';

export type IngestPollTarget = string | null | undefined;

type IngestState = {
  uploadId: string | null;
  upload: UploadResponse | null;
  status: UploadStatus | null;
  error: string | null;
  isUploading: boolean;
  isPolling: boolean;
  pollIntervalMs: number;
  start: (file: File, apiBase: string) => Promise<UploadResponse | null>;
  poll: (apiBase: string, target?: IngestPollTarget) => Promise<UploadStatus | null>;
  reset: () => void;
};

const INITIAL_STATE: Omit<IngestState, 'start' | 'poll' | 'reset'> = {
  uploadId: null,
  upload: null,
  status: null,
  error: null,
  isUploading: false,
  isPolling: false,
  pollIntervalMs: 1500,
};

let pollTimer: ReturnType<typeof setTimeout> | null = null;

const mergeReadyUpload = (
  uploadId: string,
  previous: UploadResponse | null,
  status: UploadStatus,
): UploadResponse | null => {
  if (!status.assets) {
    return previous;
  }
  const { assets } = status;
  const next: UploadResponse = {
    upload_id: uploadId,
    original_url: assets.original_url ?? previous?.original_url ?? '',
    proxy_url: assets.proxy_url ?? previous?.proxy_url ?? null,
    mezzanine_url: assets.mezzanine_url ?? previous?.mezzanine_url ?? null,
    thumbs_glob: assets.thumbs_glob ?? previous?.thumbs_glob ?? null,
    keyframes_csv: assets.keyframes_csv ?? previous?.keyframes_csv ?? null,
  };
  if (!next.original_url) {
    return previous;
  }
  return next;
};

export const useIngestStore = create<IngestState>((set, get) => {
  const clearTimer = () => {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };

  const schedulePoll = (apiBase: string, target: string, interval: number) => {
    clearTimer();
    pollTimer = setTimeout(() => {
      void get().poll(apiBase, target);
    }, interval);
  };

  const checkStatus = async (apiBase: string, target: string): Promise<UploadStatus | null> => {
    const response = await fetch(
      `${apiBase}/ingest/status?upload_id=${encodeURIComponent(target)}`,
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error('Unable to update ingest status.');
    }
    return (await response.json()) as UploadStatus;
  };

  return {
    ...INITIAL_STATE,
    async start(file, apiBase) {
      set({ isUploading: true, error: null });
      try {
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch(`${apiBase}/ingest/upload`, {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.status === 415) {
          throw new Error('Unsupported file type. Please choose a compatible video.');
        }

        if (!uploadResponse.ok) {
          const detail = await uploadResponse.text().catch(() => null);
          throw new Error(detail || 'Upload failed. Please try again.');
        }

        const payload = (await uploadResponse.json()) as UploadResponse;
        set({ uploadId: payload.upload_id, upload: payload, status: null });

        const startResponse = await fetch(`${apiBase}/ingest/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ upload_id: payload.upload_id }),
        });

        if (!startResponse.ok) {
          let detail: string | null = null;
          try {
            const data = (await startResponse.json()) as { message?: string; detail?: string };
            detail = data.message ?? data.detail ?? null;
          } catch (error) {
            if (error instanceof Error) {
              detail = null;
            }
          }
          throw new Error(detail || 'Unable to start ingest job.');
        }

        set({ error: null });
        return payload;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed.';
        clearTimer();
        set({ error: message, isPolling: false });
        throw error;
      } finally {
        set({ isUploading: false });
      }
    },
    async poll(apiBase, targetArg) {
      const state = get();
      const target = (targetArg ?? state.uploadId ?? 'healthcheck') || 'healthcheck';

      if (state.isPolling && pollTimer) {
        return state.status;
      }

      set({ isPolling: true });

      try {
        const status = await checkStatus(apiBase, target);
        const isRealUpload = Boolean(state.uploadId && target === state.uploadId);

        if (!status) {
          if (isRealUpload) {
            set({ uploadId: null, upload: null, status: null });
          } else {
            set({ status: null });
          }
          clearTimer();
          set({ isPolling: false });
          return null;
        }

        if (isRealUpload && status.status === 'error') {
          const message = status.message ?? 'Upload failed.';
          set({ status, error: message });
          clearTimer();
          set({ isPolling: false });
          return status;
        }

        if (isRealUpload && status.status === 'ready') {
          const nextUpload = mergeReadyUpload(state.uploadId as string, state.upload, status);
          if (!nextUpload || !nextUpload.proxy_url) {
            const message = 'Upload ready but missing asset locations.';
            set({ status, error: message });
            clearTimer();
            set({ isPolling: false });
            return status;
          }
          set({ status, upload: nextUpload, error: null });
          clearTimer();
          set({ isPolling: false });
          return status;
        }

        set({ status, error: null });
        schedulePoll(apiBase, target, state.pollIntervalMs);
        return status;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to update ingest status.';
        set({ error: message });
        clearTimer();
        set({ isPolling: false });
        return null;
      }
    },
    reset() {
      clearTimer();
      set({ ...INITIAL_STATE });
    },
  };
});

export const getIngestStore = useIngestStore.getState;
