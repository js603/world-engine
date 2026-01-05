export type ActionType = 'MOVE' | 'SPEAK' | 'WAIT' | 'ATTACK';

export type ActionTag =
  | 'RISKY'
  | 'SAFE'
  | 'SOCIAL'
  | 'AGGRESSIVE'
  | 'PASSIVE'
  | 'NEUTRAL';

export interface Action {
  actorId: string;
  targetId?: string;  // 행동 대상 (선택적)
  type: ActionType;
  tags: ActionTag[];
}

export interface ActionLog extends Action {
  id: string;
  timestamp: number;
}

export type MeaningType = 'FEAR' | 'TRUST' | 'RESPECT';

export interface MeaningEvent {
  id: string;
  sourceLogIds: string[];
  type: MeaningType;
  intensity: number;
  audience: {
    factionIds?: string[];
    locationIds?: string[];
  };
}

export interface Echo {
  id: string;
  originMeaningId: string;
  tone: 'positive' | 'negative' | 'ambiguous';
  distortion: number;
  ttl: number;
  scope: {
    factionId?: string;
    locationId?: string;
  };
}

export interface ChronicleEntry {
  id: string;
  year: number;
  summary: string;
  derivedMeaningIds: string[];
  scope: 'LOCAL' | 'REGIONAL' | 'GLOBAL';
}

export interface WorldState {
  year: number;
  turn: number;
  logs: ActionLog[];
  meanings: MeaningEvent[];
  echoes: Echo[];
  chronicles: ChronicleEntry[];
}
