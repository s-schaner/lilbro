export interface Player {
  id: string;
  name: string;
  position: string;
}

export interface EventRecord {
  id: string;
  timestamp: number;
  label: string;
  player_id: string;
  outcome: string;
  video_time: string;
}

export interface FormationSnapshot {
  front_row: string[];
  back_row: string[];
}

export interface ModuleHealth {
  name: string;
  status: string;
  enabled: boolean;
}

export interface UploadResponse {
  upload_id: string;
  original_url: string;
  proxy_url: string | null;
  mezzanine_url: string | null;
  thumbs_glob: string | null;
  keyframes_csv: string | null;
}

export interface UploadStatusAssets {
  original_url: string | null;
  proxy_url: string | null;
  mezzanine_url: string | null;
  thumbs_glob: string | null;
  keyframes_csv: string | null;
}

export interface UploadStatus {
  status: string;
  stage: string;
  progress: number;
  message?: string;
  assets: UploadStatusAssets;
}

export const UPLOAD_STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  validate: 'Validating source',
  transcode_mezz: 'Transcoding mezzanine',
  make_proxy: 'Preparing proxy',
  thumbs: 'Generating thumbnails',
  ready: 'Ready',
  error: 'Error',
  proxy: 'Preparing proxy',
};

export interface LogEntry {
  ts: string | number;
  level: string;
  source: string;
  msg: string;
  meta?: Record<string, unknown> | null;
}

export interface LogFilters {
  level?: string;
  source?: string;
  search?: string;
}
