import { initialWorld } from './world/initialState.js';
import { simulateTurn } from './core/engine.js';
import { sampleActions } from './world/sampleActions.js';
import { MeaningEngine, FearPlugin, TrustPlugin, RespectPlugin } from './core/meaningEngine.js';

export function runSimulation() {
  const meaningEngine = new MeaningEngine();
  meaningEngine.register(FearPlugin);
  meaningEngine.register(TrustPlugin);
  meaningEngine.register(RespectPlugin);

  let world = initialWorld;

  for (let i = 0; i < 10; i++) {
    console.log(`\n--- TURN ${world.turn} ---`);
    const result = simulateTurn(world, sampleActions(), meaningEngine);
    world = result.world;
    console.log(JSON.stringify(world.chronicles, null, 2));
  }
}

