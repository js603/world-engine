import { ActionTag, Echo, MeaningEvent, MeaningType, WorldState, ChronicleEntry } from './types.js';

export interface WorldTendency {
  tag: ActionTag;
  weight: number; // negative = discouraged, positive = encouraged
}

export interface ExtendedWorldState extends WorldState {
  readonly tendency: WorldTendency[];
  readonly meaningPressure: Record<MeaningType, number>;
  readonly lastChronicleTurn: Partial<Record<MeaningType, number>>;
}

// 1. Accumulate Meaning pressure
export function accumulateMeaningPressure(
  world: ExtendedWorldState,
  meanings: MeaningEvent[]
): ExtendedWorldState {
  const pressure: Record<MeaningType, number> = { ...world.meaningPressure };
  for (const m of meanings) {
    pressure[m.type] = (pressure[m.type] ?? 0) + m.intensity;
  }
  return { ...world, meaningPressure: pressure };
}

const CHRONICLE_THRESHOLD = 2.0;
const MIN_CHRONICLE_GAP = 3; // min turns between same-type chronicles

// 2. Generate Chronicle from accumulated pressure
export function generateChronicleFromPressure(
  world: ExtendedWorldState
): { world: ExtendedWorldState; chronicles: ChronicleEntry[] } {
  const entries: ChronicleEntry[] = [];
  const pressure: Record<MeaningType, number> = { ...world.meaningPressure };
  const lastTurn: Partial<Record<MeaningType, number>> = {
    ...world.lastChronicleTurn
  };

  for (const [key, value] of Object.entries(pressure)) {
    const type = key as MeaningType;
    const last = lastTurn[type] ?? -Infinity;
    const canEmit = value >= CHRONICLE_THRESHOLD && world.turn - last >= MIN_CHRONICLE_GAP;

    if (canEmit) {
      entries.push({
        id: crypto.randomUUID(),
        year: world.year,
        summary: `An era shaped by ${type.toLowerCase()}.`,
        derivedMeaningIds: [],
        scope: 'LOCAL'
      });

      // decay but not vanish
      pressure[type] = value * 0.4;
      lastTurn[type] = world.turn;
    }
  }

  const updatedWorld: ExtendedWorldState = {
    ...world,
    meaningPressure: pressure,
    lastChronicleTurn: lastTurn
  };

  return { world: updatedWorld, chronicles: entries };
}

// 3. Chronicle → World Tendency (with clamping)
const TENDENCY_MIN = -0.6;
const TENDENCY_MAX = 0.6;

export function applyChronicleTendency(
  world: ExtendedWorldState,
  chronicles: ChronicleEntry[]
): ExtendedWorldState {
  if (!chronicles.length) return world;

  const map = new Map<ActionTag, number>();
  for (const t of world.tendency) {
    map.set(t.tag, (map.get(t.tag) ?? 0) + t.weight);
  }

  const adjust = (tag: ActionTag, delta: number) => {
    const current = map.get(tag) ?? 0;
    const next = Math.max(TENDENCY_MIN, Math.min(TENDENCY_MAX, current + delta));
    map.set(tag, next);
  };

  for (const c of chronicles) {
    const lower = c.summary.toLowerCase();
    if (lower.includes('fear')) {
      adjust('RISKY', -0.10);
      adjust('SAFE', 0.08);
    }
    if (lower.includes('trust')) {
      adjust('SOCIAL', 0.08);
      adjust('PASSIVE', -0.04);
    }
    if (lower.includes('respect')) {
      adjust('AGGRESSIVE', 0.05);
    }
  }

  const tendency = [...map.entries()].map(([tag, weight]) => ({ tag, weight }));

  return { ...world, tendency };
}

// 4. Action probability inclination
export function inclineActionProbability(
  base: number,
  tags: readonly ActionTag[],
  world: ExtendedWorldState
): number {
  let modifier = 0;
  for (const t of tags) {
    const influence = world.tendency.find(x => x.tag === t);
    if (influence) modifier += influence.weight;
  }
  // keep a small floor so actions never fully disappear
  return Math.max(0.05, base + modifier);
}

// 5. Echo → MeaningPressure bridge
const TONE_FACTOR: Record<'positive' | 'negative' | 'ambiguous', number> = {
  positive: 0.6,
  negative: 1.0,
  ambiguous: 0.3
};

const DECAY_SENSITIVITY: Partial<Record<MeaningType, number>> = {
  FEAR: 0.8,
  TRUST: 0.6,
  RESPECT: 0.5
};

/**
 * Echoes do not create new Meaning,
 * they only amplify or prolong existing pressure.
 */
export function applyEchoToPressure(
  world: ExtendedWorldState
): ExtendedWorldState {
  const pressure: Record<MeaningType, number> = { ...world.meaningPressure };

  for (const echo of world.echoes) {
    for (const [key, value] of Object.entries(pressure)) {
      const type = key as MeaningType;
      const sensitivity = DECAY_SENSITIVITY[type] ?? 0.7;
      const gain = value * TONE_FACTOR[echo.tone] * sensitivity * 0.1;
      pressure[type] = value + gain;
    }
  }

  return { ...world, meaningPressure: pressure };
}
