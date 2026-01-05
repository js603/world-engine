import { Action } from '../core/types.js';

export function sampleActions(): Action[] {
  return [
    { actorId: 'npc-1', type: 'MOVE', tags: ['RISKY'] },
    { actorId: 'npc-2', type: 'WAIT', tags: ['SAFE'] }
  ];
}
