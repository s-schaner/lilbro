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
