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

export type EventDefinition = {
  id: string;
  name: string;
  template: 'Contact' | 'Injury Risk' | 'Formation' | 'General';
  threshold: number;
  enabled: boolean;
  createdAt: string;
  version: string;
};

export type ExplainPayload = {
  rules: string[];
  features: Record<string, number>;
};

export type TrainerTemplate = EventDefinition['template'];

export type InsightPayload = {
  game_id: string;
  recap: string;
  momentum: string[];
  spotlights: string[];
  coach_notes: string[];
};

export type ScreenSnapResult = {
  focus: string;
  summary: string;
  observations: string[];
  corrections: string[];
  confidence: number;
  timestamp?: number;
  imageDataUrl?: string;
};

export type ModuleStatus = {
  id: string;
  name: string;
  version: string;
  optional: boolean;
  enabled: boolean;
  status: 'healthy' | 'degraded' | 'error' | 'disabled';
  last_error?: string | null;
  last_checked?: string | null;
  failure_count: number;
};

export type OverlayBox = {
  jersey: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

export type BallTrailPoint = {
  x: number;
  y: number;
  t: number;
};

export type OverlaySnapshot = {
  boxes: OverlayBox[];
  trail: BallTrailPoint[];
};

export type VideoIngestResponse = {
  filename: string;
  mezzanine: string;
  proxy: string;
  thumbnails: string[];
  status: 'queued' | 'completed';
};
