import React, {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertCircle, CheckCircle2, Loader2, UploadCloud } from 'lucide-react';

import { UploadResponse, UploadStatus } from '../data/types';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onReady: (payload: UploadResponse) => void;
  onError?: (message: string) => void;
  apiUrl?: string;
}

const ACCEPTED_TYPES = '.mp4,.mov,.mkv,.webm,.avi,.mts,.m2ts';
const STAGE_LABELS: Record<string, string> = {
  validate: 'Validating source',
  proxy: 'Preparing proxy',
  ready: 'Ready',
};

export const UploadDialog: React.FC<UploadDialogProps> = ({
  open,
  onClose,
  onReady,
  onError,
  apiUrl,
}) => {
  const [isDragActive, setDragActive] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<UploadStatus | null>(null);
  const [uploadInfo, setUploadInfo] = useState<UploadResponse | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiBase = useMemo(() => apiUrl ?? import.meta.env.VITE_API_URL ?? 'http://localhost:8000', [apiUrl]);

  useEffect(() => {
    if (!open) {
      setDragActive(false);
      setSubmitting(false);
      setStatus(null);
      setUploadInfo(null);
      setUploadId(null);
      setError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [open]);

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
        setUploadId(payload.upload_id);
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
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const response = await fetch(`${apiBase}/ingest/status?upload_id=${encodeURIComponent(uploadId)}`);
        if (!response.ok) {
          throw new Error('Unable to read ingest status');
        }
        const payload = (await response.json()) as UploadStatus;
        if (cancelled) return;
        setStatus(payload);

        if (payload.status === 'ready') {
          if (uploadInfo) {
            onReady(uploadInfo);
          }
          timeout = setTimeout(() => {
            if (!cancelled) {
              onClose();
            }
          }, 400);
          return;
        }

        timeout = setTimeout(poll, 1000);
      } catch (err) {
        if (cancelled) return;
        handleUploadError((err as Error).message || 'Unable to update ingest status.');
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [apiBase, handleUploadError, onClose, onReady, open, uploadId, uploadInfo]);

  if (!open) {
    return null;
  }

  const stageLabel = status?.stage ? STAGE_LABELS[status.stage] ?? status.stage : 'Waiting for upload';
  const progressPercent = status ? Math.min(100, status.progress) : 0;

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
          <div className="flex items-center gap-2">
            {status?.status === 'ready' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            ) : isSubmitting || status ? (
              <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden="true" />
            ) : (
              <UploadCloud className="h-4 w-4 text-slate-400" aria-hidden="true" />
            )}
            <span>{stageLabel}</span>
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
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};
