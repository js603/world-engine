import { Action, MeaningEvent, ChronicleEntry } from './types.js';
import { ExtendedWorldState } from './chronicle-pressure.js';

export function formatTendency(world: ExtendedWorldState): string {
  if (!world.tendency.length) return 'none';

  const merged = new Map<string, number>();
  for (const t of world.tendency) {
    merged.set(t.tag, (merged.get(t.tag) ?? 0) + t.weight);
  }

  const parts = [...merged.entries()]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([tag, weight]) => `${tag}:${weight.toFixed(2)}`);

  return parts.join(', ');
}

export function formatPressure(world: ExtendedWorldState): string {
  const entries = Object.entries(world.meaningPressure);
  if (!entries.length) return 'none';

  return entries
    .map(([type, value]) => `${type}:${value.toFixed(2)}`)
    .join(', ');
}

export function summarizeActions(actions: Action[]): string {
  const counts = new Map<string, number>();
  for (const a of actions) {
    counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([type, count]) => `${type} x${count}`)
    .join(', ');
}

export function logTurn(
  world: ExtendedWorldState,
  actions: Action[],
  meanings: MeaningEvent[],
  chronicles: ChronicleEntry[]
): void {
  console.log(`\n=== TURN ${world.turn} (Year ${world.year}) ===`);
  console.log(`Actions: ${summarizeActions(actions) || 'none'}`);
  console.log(`Pressure: ${formatPressure(world)}`);
  console.log(`Tendency: ${formatTendency(world)}`);

  if (meanings.length) {
    const mSummary = meanings.reduce<Record<string, number>>((acc, m) => {
      acc[m.type] = (acc[m.type] ?? 0) + m.intensity;
      return acc;
    }, {});

    console.log(
      'Meaning:',
      Object.entries(mSummary)
        .map(([t, v]) => `${t}:${v.toFixed(2)}`)
        .join(', ')
    );
  } else {
    console.log('Meaning: none');
  }

  if (chronicles.length) {
    console.log('Chronicles this turn:');
    for (const c of chronicles) {
      console.log(` - [${c.year}] ${c.summary}`);
    }
  } else {
    console.log('Chronicles this turn: none');
  }
}
