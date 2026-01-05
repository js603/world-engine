import { ActionLog, MeaningEvent, MeaningType } from './types.js';

export interface MeaningPlugin {
  readonly type: MeaningType;
  evaluate(logs: readonly ActionLog[]): MeaningEvent[];
}

export class MeaningEngine {
  private readonly plugins: MeaningPlugin[] = [];

  register(plugin: MeaningPlugin) {
    this.plugins.push(plugin);
  }

  evaluate(logs: readonly ActionLog[]): MeaningEvent[] {
    return this.plugins.flatMap(p => p.evaluate(logs));
  }
}

// Fear plugin
export const FearPlugin: MeaningPlugin = {
  type: 'FEAR',
  evaluate(logs) {
    return logs
      .filter(l => l.tags.includes('RISKY'))
      .map(l => ({
        id: crypto.randomUUID(),
        sourceLogIds: [l.id],
        type: 'FEAR' as const,
        intensity: 0.4,
        audience: { locationIds: ['LOCAL'] }
      }));
  }
};

// Trust plugin
export const TrustPlugin: MeaningPlugin = {
  type: 'TRUST',
  evaluate(logs) {
    return logs
      .filter(l => l.tags.includes('SOCIAL'))
      .map(l => ({
        id: crypto.randomUUID(),
        sourceLogIds: [l.id],
        type: 'TRUST' as const,
        intensity: 0.3,
        audience: { factionIds: ['CIVILIANS'] }
      }));
  }
};

// Respect plugin
export const RespectPlugin: MeaningPlugin = {
  type: 'RESPECT',
  evaluate(logs) {
    return logs
      .filter(l => l.tags.includes('AGGRESSIVE'))
      .map(l => ({
        id: crypto.randomUUID(),
        sourceLogIds: [l.id],
        type: 'RESPECT' as const,
        intensity: 0.2,
        audience: { factionIds: ['WARRIORS'] }
      }));
  }
};
