import React, {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertCircle, CheckCircle2, Loader2, UploadCloud } from 'lucide-react';

import { UploadResponse, UploadStatus, UPLOAD_STAGE_LABELS } from '../data/types';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onReady: (payload: UploadResponse) => void;
  onError?: (message: string) => void;
  onShowLogs?: () => void;
  apiUrl?: string;
}

const ACCEPTED_TYPES = '.mp4,.mov,.mkv,.webm,.avi,.mts,.m2ts';
const formatStageLabel = (stage?: string | null) => {
  if (!stage) {
    return 'Waiting for upload';
  }
  const label = UPLOAD_STAGE_LABELS[stage];
  if (label) {
    return label;
  }
  const fallback = stage.replace(/_/g, ' ');
  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
};

export const UploadDialog: React.FC<UploadDialogProps> = ({
  open,
  onClose,
  onReady,
  onError,
  onShowLogs,
  apiUrl,
}) => {
  const [isDragActive, setDragActive] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<UploadStatus | null>(null);
  const [uploadInfo, setUploadInfo] = useState<UploadResponse | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInfoRef = useRef<UploadResponse | null>(null);

  const apiBase = useMemo(() => apiUrl ?? import.meta.env.VITE_API_URL ?? 'http://localhost:8000', [apiUrl]);

  useEffect(() => {
    if (!open) {
      setDragActive(false);
      setSubmitting(false);
      setStatus(null);
      setUploadInfo(null);
      setUploadId(null);
      setError(null);
      uploadInfoRef.current = null;
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [open]);

  useEffect(() => {
    uploadInfoRef.current = uploadInfo;
  }, [uploadInfo]);

  const handleUploadError = useCallback(
    (message: string) => {
      setError(message);
      onError?.(message);
    },
    [onError],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const [file] = files;
      setSubmitting(true);
      setError(null);
      setStatus(null);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`${apiBase}/ingest/upload`, {
          method: 'POST',
          body: formData,
        });

        if (response.status === 415) {
          handleUploadError('Unsupported file type. Please choose a compatible video.');
          return;
        }

        if (!response.ok) {
          handleUploadError('Upload failed. Please try again.');
          return;
        }

        const payload = (await response.json()) as UploadResponse;
        setUploadInfo(payload);
        uploadInfoRef.current = payload;
        setUploadId(payload.upload_id);
        setStatus({
          status: 'queued',
          stage: 'queued',
          progress: 0,
          assets: {
            original_url: payload.original_url,
            proxy_url: payload.proxy_url,
            mezzanine_url: payload.mezzanine_url,
            thumbs_glob: payload.thumbs_glob,
            keyframes_csv: payload.keyframes_csv,
          },
        });
      } catch (err) {
        handleUploadError((err as Error).message || 'Upload failed.');
      } finally {
        setSubmitting(false);
      }
    },
    [apiBase, handleUploadError],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      handleFiles(event.dataTransfer?.files ?? null);
    },
    [handleFiles],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(event.target.files);
    },
    [handleFiles],
  );

  useEffect(() => {
    if (!open || !uploadId) return undefined;

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const poll = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const response = await fetch(
          `${apiBase}/ingest/status?upload_id=${encodeURIComponent(uploadId)}`,
        );
        if (!response.ok) {
          throw new Error('Unable to update ingest status.');
        }
        const payload = (await response.json()) as UploadStatus;
        if (cancelled) return;
        setStatus(payload);

        if (!payload.assets) {
          handleUploadError('Upload status missing asset metadata.');
          return;
        }

        if (payload.status === 'error') {
          const message = payload.message ?? 'Upload failed.';
          setError(message);
          handleUploadError(message);
          return;
        }

        if (payload.status === 'ready') {
          const assets = payload.assets;
          const originalUrl =
            assets.original_url ?? uploadInfoRef.current?.original_url ?? null;
          const proxyUrl = assets.proxy_url ?? null;

          if (!originalUrl || !proxyUrl) {
            const message = 'Upload ready but missing asset locations.';
            setError(message);
            handleUploadError(message);
            return;
          }

          const readyPayload: UploadResponse = {
            upload_id: uploadId,
            original_url: originalUrl,
            proxy_url: proxyUrl,
            mezzanine_url: assets.mezzanine_url ?? null,
            thumbs_glob: assets.thumbs_glob ?? null,
            keyframes_csv: assets.keyframes_csv ?? null,
          };

          setUploadInfo(readyPayload);
          uploadInfoRef.current = readyPayload;
          onReady(readyPayload);
          timeout = setTimeout(() => {
            if (!cancelled) {
              onClose();
            }
          }, 400);
          return;
        }

        setError(null);
        timeout = setTimeout(() => {
          void poll();
        }, 1000);
      } catch (err) {
        if (cancelled) return;
        handleUploadError((err as Error).message || 'Unable to update ingest status.');
      }
    };

    const startAndPoll = async (): Promise<void> => {
      try {
        const response = await fetch(`${apiBase}/ingest/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ upload_id: uploadId }),
        });

        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          const message =
            (detail && (detail.message || detail.detail)) ||
            'Unable to start ingest job.';
          handleUploadError(message);
          return;
        }

        setError(null);
        await poll();
      } catch (err) {
        if (cancelled) return;
        handleUploadError((err as Error).message || 'Unable to start ingest job.');
      }
    };

    void startAndPoll();

    return () => {
      cancelled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [apiBase, handleUploadError, onClose, onReady, open, uploadId]);

  if (!open) {
    return null;
  }

  const stageLabel = formatStageLabel(status?.stage ?? null);
  const progressPercent = status ? Math.min(100, Math.max(0, status.progress)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Upload match video</h2>
          <button
            onClick={onClose}
            className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Drag and drop a video file or browse from disk. Supported formats: mp4, mov, mkv, webm, avi, mts, m2ts.
        </p>
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`mt-4 flex h-40 flex-col items-center justify-center rounded-lg border-2 border-dashed transition ${
            isDragActive ? 'border-brand bg-brand/10' : 'border-slate-700 bg-slate-900'
          }`}
        >
          <UploadCloud className="h-10 w-10 text-brand" aria-hidden="true" />
          <p className="mt-3 text-sm text-slate-300">Drop file here or</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Browse files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="sr-only"
            onChange={onInputChange}
          />
        </div>
        <div className="mt-4 space-y-2 text-sm text-slate-300">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {status?.status === 'ready' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              ) : status?.status === 'error' ? (
                <AlertCircle className="h-4 w-4 text-red-400" aria-hidden="true" />
              ) : isSubmitting || status ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden="true" />
              ) : (
                <UploadCloud className="h-4 w-4 text-slate-400" aria-hidden="true" />
              )}
              <span>{stageLabel}</span>
            </div>
            {status?.message && (
              <div className="ml-6 text-xs text-slate-400">{status.message}</div>
            )}
          </div>
          <div className="h-2 rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${progressPercent}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-2">
              <span>{error}</span>
              {onShowLogs && (
                <button
                  type="button"
                  onClick={() => {
                    onShowLogs();
                    onClose();
                  }}
                  className="self-start rounded-md border border-red-400/40 px-3 py-1 text-xs font-semibold text-red-100 hover:border-red-300/60"
                >
                  View Logs
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
