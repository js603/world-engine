import {
  Action,
  ActionLog,
  Echo,
  MeaningEvent,
  ChronicleEntry
} from './types.js';
import {
  ExtendedWorldState,
  accumulateMeaningPressure,
  generateChronicleFromPressure,
  applyChronicleTendency,
  applyEchoToPressure
} from './chronicle-pressure.js';
import { MeaningEngine } from './meaningEngine.js';

export interface TurnResult {
  world: ExtendedWorldState;
  logs: ActionLog[];
  meanings: MeaningEvent[];
  chronicles: ChronicleEntry[];
}

export function simulateTurn(
  world: ExtendedWorldState,
  actions: Action[],
  meaningEngine: MeaningEngine
): TurnResult {
  const logs = actions.map(executeAction);

  // 1) interpret actions into meanings via plugins
  const meanings = meaningEngine.evaluate(logs);

  // 2) accumulate pressure from meanings
  let nextWorld = accumulateMeaningPressure(world, meanings);

  // 3) let existing echoes amplify that pressure
  nextWorld = applyEchoToPressure(nextWorld);

  // 4) produce chronicles from accumulated pressure
  const chronicleResult = generateChronicleFromPressure(nextWorld);
  let worldAfterChronicle = chronicleResult.world;
  const chronicles = chronicleResult.chronicles;

  // 5) chronicles bias world tendencies
  worldAfterChronicle = applyChronicleTendency(worldAfterChronicle, chronicles);

  // 6) update echoes (short-lived)
  const echoes = generateEchoes(meanings);
  const updatedEchoes = updateEchoTTL([...worldAfterChronicle.echoes, ...echoes]);

  // 7) advance time (turn/year)
  const newTurn = world.turn + 1;
  const yearIncrement = newTurn % 10 === 0 ? 1 : 0;

  const finalWorld: ExtendedWorldState = {
    ...worldAfterChronicle,
    year: worldAfterChronicle.year + yearIncrement,
    turn: newTurn,
    logs: [...worldAfterChronicle.logs, ...logs],
    meanings: [...worldAfterChronicle.meanings, ...meanings],
    chronicles: [...worldAfterChronicle.chronicles, ...chronicles],
    echoes: updatedEchoes
  };

  return { world: finalWorld, logs, meanings, chronicles };
}

function executeAction(action: Action): ActionLog {
  return {
    id: crypto.randomUUID(),
    actorId: action.actorId,
    type: action.type,
    tags: action.tags,
    timestamp: Date.now()
  };
}

function generateEchoes(meanings: MeaningEvent[]): Echo[] {
  return meanings.map(m => ({
    id: crypto.randomUUID(),
    originMeaningId: m.id,
    tone: m.type === 'FEAR' ? 'negative' : 'positive',
    distortion: Math.random(),
    ttl: 3,
    scope: { locationId: 'LOCAL' }
  }));
}

function updateEchoTTL(echoes: Echo[]): Echo[] {
  return echoes
    .map(e => ({ ...e, ttl: e.ttl - 1 }))
    .filter(e => e.ttl > 0);
}
