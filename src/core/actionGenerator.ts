import { Action, ActionTag, ActionType } from './types.js';
import { ExtendedWorldState, inclineActionProbability } from './chronicle-pressure.js';

export interface ActionCandidate {
  type: ActionType;
  tags: readonly ActionTag[];
  baseProbability: number;
  needsTarget: boolean; // 대상이 필요한 행동인지
}

const BASE_ACTION_POOL: readonly ActionCandidate[] = [
  { type: 'MOVE', tags: ['NEUTRAL'], baseProbability: 0.3, needsTarget: false },
  { type: 'WAIT', tags: ['SAFE'], baseProbability: 0.25, needsTarget: false },
  { type: 'SPEAK', tags: ['SOCIAL'], baseProbability: 0.25, needsTarget: true },
  { type: 'ATTACK', tags: ['RISKY', 'AGGRESSIVE'], baseProbability: 0.2, needsTarget: true }
];

function pickRandomTarget(actorId: string, allActorIds: readonly string[]): string | undefined {
  // 자신을 제외한 다른 액터 중에서 무작위 선택
  const others = allActorIds.filter(id => id !== actorId);
  if (others.length === 0) return undefined;
  return others[Math.floor(Math.random() * others.length)];
}

export function generateAction(
  actorId: string,
  world: ExtendedWorldState,
  allActorIds: readonly string[]
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
      const targetId = w.candidate.needsTarget
        ? pickRandomTarget(actorId, allActorIds)
        : undefined;

      return {
        actorId,
        targetId,
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
  return actorIds.map(id => generateAction(id, world, actorIds));
}

