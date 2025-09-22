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

export interface IngestJob {
  job_id: string;
  state: string;
  progress: number;
  states: string[];
}

export interface ModuleHealth {
  name: string;
  status: string;
  enabled: boolean;
}
