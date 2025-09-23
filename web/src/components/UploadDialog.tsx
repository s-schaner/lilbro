import React, { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, UploadCloud } from 'lucide-react';

import { UPLOAD_STAGE_LABELS } from '../data/types';
import { useIngestStore } from '../store/ingestStore';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
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

export const UploadDialog: React.FC<UploadDialogProps> = ({ open, onClose, onShowLogs, apiUrl }) => {
  const [isDragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiBase = useMemo(() => apiUrl ?? import.meta.env.VITE_API_URL ?? 'http://localhost:8000', [apiUrl]);

  const { uploadId, status, error, isUploading, start, poll, reset } = useIngestStore((state) => ({
    uploadId: state.uploadId,
    status: state.status,
    error: state.error,
    isUploading: state.isUploading,
    start: state.start,
    poll: state.poll,
    reset: state.reset,
  }));

  useEffect(() => {
    if (!open) {
      setDragActive(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (!status || status.status !== 'ready') {
        reset();
      }
    }
  }, [open, reset, status]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const [file] = files;
      try {
        await start(file, apiBase);
        await poll(apiBase);
      } catch (err) {
        console.error('Upload failed', err);
      }
    },
    [apiBase, poll, start],
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
    if (!open) {
      return;
    }
    if (!uploadId) {
      void poll(apiBase);
      return;
    }
    if (status && ['ready', 'error'].includes(status.status)) {
      return;
    }
    void poll(apiBase, uploadId);
  }, [apiBase, open, poll, status, uploadId]);

  if (!open) {
    return null;
  }

  const stageLabel = formatStageLabel(status?.stage ?? null);
  const progressPercent = status ? Math.min(100, Math.max(0, status.progress)) : 0;
  const hasCompleted = Boolean(uploadId && status?.status === 'ready');

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
              ) : isUploading || status ? (
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
        {hasCompleted && (
          <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-100">
            Upload complete. You can close this window or start another upload.
          </div>
        )}
      </div>
    </div>
  );
};
