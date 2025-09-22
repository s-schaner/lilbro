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
  proxy_url: string;
  mezzanine_url: string | null;
}

export interface UploadStatus {
  status: string;
  stage: string;
  progress: number;
}
