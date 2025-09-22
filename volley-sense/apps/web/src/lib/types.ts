export type Player = {
  jersey: number;
  name: string;
  stats: {
    kills: number;
    digs: number;
    blocks: number;
    aces: number;
  };
};

export type EventMarker = {
  t: number;
  label: string;
  kind: 'serve' | 'kill' | 'dig' | 'custom' | 'error';
  jersey?: number | null;
  conf: number;
};

export type Rect = { x: number; y: number; w: number; h: number };
export type Poly = { pts: [number, number][] };
export type Keypoint = { x: number; y: number; label?: string | null };

export type StanceTag = {
  kind: 'stance';
  value: 'neutral' | 'split' | 'approach' | 'jump';
};

export type HandTag = {
  kind: 'hand';
  side: 'L' | 'R';
  state: 'platform' | 'open' | 'closed';
  aboveTape?: boolean;
};

export type GazeTag = {
  kind: 'gaze';
  vec: [number, number];
};

export type CourtZoneTag = {
  kind: 'courtZone';
  zone: 1 | 2 | 3 | 4 | 5 | 6;
  row: 'front' | 'back';
};

export type ContactTag = {
  kind: 'contact';
  value: 'serve' | 'reception' | 'set' | 'attack' | 'block' | 'dig' | 'tip';
};

export type CollisionTag = {
  kind: 'collision';
  severity?: 'low' | 'med' | 'high';
};

export type BallTag = {
  kind: 'ball';
  prox: 'near' | 'far';
  side: 'ours' | 'theirs';
  aboveTape?: boolean;
};

export type Tag =
  | StanceTag
  | HandTag
  | GazeTag
  | CourtZoneTag
  | ContactTag
  | CollisionTag
  | BallTag;

export type Annotation = {
  id: string;
  frame: number;
  region: Rect | Poly;
  keypoints?: Keypoint[];
  tags: Tag[];
  trackRef?: string | null;
  jersey?: number | null;
};

export type EventClip = {
  startT: number;
  endT: number;
  fps: number;
  src: string;
};

export type EventExample = {
  id: string;
  name: string;
  clip: EventClip;
  keyFrame: number;
  endFrame: number;
  annotations: Annotation[];
  naturalLanguage?: string;
  template: TrainerTemplate;
  team?: 'home' | 'away';
  confidence?: number;
};

export type EventDefinition = {
  id: string;
  name: string;
  template: 'Contact' | 'Injury Risk' | 'Formation' | 'General';
  threshold: number;
  enabled: boolean;
  createdAt: string;
  version: string;
};

export type TrainingJob = {
  job_id: string;
  event_id: string;
  status: 'queued' | 'running' | 'completed';
  started_at: string;
  completed_at?: string | null;
  metrics?: Record<string, number> | null;
  message?: string | null;
};

export type ExplainPayload = {
  rules: string[];
  features: Record<string, number>;
};

export type TrainerTemplate = EventDefinition['template'];

export type ModuleStatus = {
  id: string;
  name: string;
  version: string;
  status: 'healthy' | 'degraded' | 'error' | 'disabled';
  enabled: boolean;
  optional: boolean;
  last_error?: string | null;
};

export type InsightPayload = {
  summary: string;
  momentum: string[];
  spotlights: string[];
  coach_tips: string[];
};

export type ScreenSnapResponse = {
  summary: string;
  observations: string[];
  corrections: string[];
  confidence: number;
};

export type VlmAssistResponse = {
  stance: string | null;
  hand_state: string | null;
  court_zone: number | null;
  above_tape: boolean | null;
  contact_type: string | null;
  notes: string[];
  confidence: number;
};

export type OverlayBox = {
  jersey: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OverlayPoint = {
  x: number;
  y: number;
};

export type OverlayPayload = {
  frame: number;
  players: OverlayBox[];
  ball: OverlayPoint;
  trail: OverlayPoint[];
};

export type IngestJob = {
  job_id: string;
  status: string;
  filename: string;
  mezzanine_url: string | null;
  proxy_url: string | null;
  thumbnails: string[];
};
