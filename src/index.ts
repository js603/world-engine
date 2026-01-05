import { initialWorld } from './world/initialState.js';
import { MeaningEngine, FearPlugin, TrustPlugin, RespectPlugin } from './core/meaningEngine.js';
import { generateActionsForTurn } from './core/actionGenerator.js';
import { simulateTurn } from './core/engine.js';
import { logTurn } from './core/cliObserver.js';

const meaningEngine = new MeaningEngine();
meaningEngine.register(FearPlugin);
meaningEngine.register(TrustPlugin);
meaningEngine.register(RespectPlugin);

let world = initialWorld;
const actors = ['npc-1', 'npc-2', 'npc-3'];

for (let i = 0; i < 20; i++) {
  const actions = generateActionsForTurn(actors, world);
  const { world: nextWorld, meanings, chronicles } = simulateTurn(
    world,
    actions,
    meaningEngine
  );
  logTurn(nextWorld, actions, meanings, chronicles);
  world = nextWorld;
}
