import { ExtendedWorldState } from '../core/chronicle-pressure.js';
import { MeaningType } from '../core/types.js';

export const initialWorld: ExtendedWorldState = {
  year: 1,
  turn: 1,
  logs: [],
  meanings: [],
  echoes: [],
  chronicles: [],
  tendency: [],
  meaningPressure: {} as Record<MeaningType, number>,
  lastChronicleTurn: {}
};
