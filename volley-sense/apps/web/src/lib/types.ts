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
