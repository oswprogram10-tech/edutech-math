/**
 * E12 `net-fold` 모드 predicate · 이벤트 생성(순수 함수).
 */
import type {
  EngineEvent,
  EnginePredicate,
  JsonValue,
  Observation,
} from '../../../core/engine-sdk';
import type { NetFoldState } from '../types';
import { evaluateNet } from './geometry';

function isRecord(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return (
    value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  );
}

function isNetObservation(observation: Observation): boolean {
  return observation['mode'] === 'net-fold';
}

function readIntArg(args: JsonValue | undefined, key: string): number | null {
  if (!isRecord(args)) return null;
  const val = args[key];
  if (typeof val !== 'number' || !Number.isInteger(val)) return null;
  return val;
}

function readStringArg(args: JsonValue | undefined, key: string): string | null {
  if (!isRecord(args)) return null;
  const val = args[key];
  if (typeof val !== 'string' || val.length === 0) return null;
  return val;
}

export const netPredicates: Readonly<Record<string, EnginePredicate>> = {
  netValid: (observation) => isNetObservation(observation) && observation['valid'] === true,

  netSixInvalid: (observation) =>
    isNetObservation(observation) &&
    observation['faceCount'] === 6 &&
    observation['valid'] !== true,

  netFaceCountIs: (observation, args) => {
    if (!isNetObservation(observation)) return false;
    const n = readIntArg(args, 'n');
    if (n === null) return false;
    return observation['faceCount'] === n;
  },

  foundNetsAtLeast: (observation, args) => {
    if (!isNetObservation(observation)) return false;
    const n = readIntArg(args, 'n');
    if (n === null) return false;
    const foundCount = observation['foundCount'];
    return typeof foundCount === 'number' && foundCount >= n;
  },

  predictedOpposite: (observation, args) => {
    if (!isNetObservation(observation) || observation['valid'] !== true) return false;
    const of = readStringArg(args, 'of');
    const prediction = observation['prediction'];
    if (of === null || typeof prediction !== 'string') return false;
    const opposites = observation['opposites'];
    if (!isRecord(opposites)) return false;
    return opposites[of] === prediction;
  },

  predictedAdjacent: (observation, args) => {
    if (!isNetObservation(observation) || observation['valid'] !== true) return false;
    const of = readStringArg(args, 'of');
    const prediction = observation['prediction'];
    if (of === null || typeof prediction !== 'string' || prediction === of) return false;
    const opposites = observation['opposites'];
    if (!isRecord(opposites)) return false;
    return opposites[of] !== prediction;
  },

  oppositeIs: (observation, args) => {
    if (!isNetObservation(observation) || observation['valid'] !== true) return false;
    const a = readStringArg(args, 'a');
    const b = readStringArg(args, 'b');
    if (a === null || b === null) return false;
    const opposites = observation['opposites'];
    if (!isRecord(opposites)) return false;
    return opposites[a] === b;
  },
};

function faceSignature(f: {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}): string {
  return `${f.x},${f.y},${f.w},${f.h}`;
}

export function emitNet(prev: NetFoldState, next: NetFoldState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (next.faces.length > prev.faces.length) {
    const prevSet = new Set(prev.faces.map(faceSignature));
    for (const face of next.faces) {
      if (!prevSet.has(faceSignature(face))) {
        events.push({
          name: 'face-placed',
          payload: {
            x: face.x,
            y: face.y,
            w: face.w,
            h: face.h,
            count: next.faces.length,
          },
        });
      }
    }
  } else if (next.faces.length < prev.faces.length) {
    const nextSet = new Set(next.faces.map(faceSignature));
    const removed = prev.faces.filter((f) => !nextSet.has(faceSignature(f)));
    removed.forEach((face, index) => {
      events.push({
        name: 'face-removed',
        payload: {
          x: face.x,
          y: face.y,
          w: face.w,
          h: face.h,
          count: prev.faces.length - index - 1,
        },
      });
    });
  }

  if (!prev.folded && next.folded) {
    const evaluation = evaluateNet(next.faces, next.settings);
    events.push({
      name: 'net-folded',
      payload: {
        valid: evaluation.valid,
        overlapPairs: evaluation.overlapPairs,
        missingCount: evaluation.missingSlots.length,
      },
    });
  } else if (prev.folded && !next.folded) {
    events.push({
      name: 'net-unfolded',
      payload: {},
    });
  }

  if (next.prediction !== null && next.prediction !== prev.prediction) {
    events.push({
      name: 'prediction-set',
      payload: { label: next.prediction },
    });
  }

  if (next.viewTurn !== prev.viewTurn) {
    events.push({
      name: 'view-turned',
      payload: { viewTurn: next.viewTurn },
    });
  }

  return events;
}
