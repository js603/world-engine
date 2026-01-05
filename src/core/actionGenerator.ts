import { Action, ActionTag, ActionType } from './types.js';
import { ExtendedWorldState, inclineActionProbability } from './chronicle-pressure.js';

export interface ActionCandidate {
  type: ActionType;
  tags: readonly ActionTag[];
  baseProbability: number;
}

const BASE_ACTION_POOL: readonly ActionCandidate[] = [
  { type: 'MOVE', tags: ['NEUTRAL'], baseProbability: 0.3 },
  { type: 'WAIT', tags: ['SAFE'], baseProbability: 0.25 },
  { type: 'SPEAK', tags: ['SOCIAL'], baseProbability: 0.25 },
  { type: 'ATTACK', tags: ['RISKY', 'AGGRESSIVE'], baseProbability: 0.2 }
];

export function generateAction(
  actorId: string,
  world: ExtendedWorldState
): Action {
  const weighted = BASE_ACTION_POOL.map(c => ({
    candidate: c,
    weight: inclineActionProbability(c.baseProbability, c.tags, world)
  }));

  const total = weighted.reduce((s, w) => s + w.weight, 0);
  let roll = Math.random() * total;

  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) {
      return {
        actorId,
        type: w.candidate.type,
        tags: [...w.candidate.tags]
      };
    }
  }

  return {
    actorId,
    type: 'WAIT',
    tags: ['SAFE']
  };
}

export function generateActionsForTurn(
  actorIds: readonly string[],
  world: ExtendedWorldState
): Action[] {
  return actorIds.map(id => generateAction(id, world));
}
