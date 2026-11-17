/**
 * E12 `shapes-sort` 모드 predicate · 이벤트 생성(순수 함수).
 *
 * 모든 predicate는 `shapes-sort` 관찰에서만 참이 될 수 있다. 잘못된 인자는 false다.
 */
import type {
  EngineEvent,
  EnginePredicate,
  JsonValue,
  Observation,
} from '../../../core/engine-sdk';
import type { ShapesState } from '../types';
import { partOf } from './reduce';
import { cluesOf, isShapeKind } from './rules';

function isRecord(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return (
    value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  );
}

function isShapes(observation: Observation): boolean {
  return observation['mode'] === 'shapes-sort';
}

function intArg(args: JsonValue | undefined, key: string): number | null {
  if (!isRecord(args)) return null;
  const val = args[key];
  return typeof val === 'number' && Number.isInteger(val) ? val : null;
}

interface ObsTrial {
  readonly kind: string;
  readonly pose: string;
}

function readTrials(observation: Observation): readonly ObsTrial[] | null {
  const raw = observation['trials'];
  if (!Array.isArray(raw)) return null;
  const out: ObsTrial[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const { kind, pose } = item;
    if (typeof kind !== 'string' || typeof pose !== 'string') return null;
    out.push({ kind, pose });
  }
  return out;
}

export const shapesPredicates: Readonly<Record<string, EnginePredicate>> = {
  towerHeightIs: (observation, args) => {
    if (!isShapes(observation)) return false;
    const n = intArg(args, 'n');
    return n !== null && observation['towerHeight'] === n;
  },

  /** 탑이 비어 있지 않고 모든 물건이 상자거나 세운 둥근기둥이다. */
  towerAllFlatStackers: (observation) => {
    if (!isShapes(observation)) return false;
    const tower = observation['tower'];
    if (!Array.isArray(tower) || tower.length === 0) return false;
    return tower.every(
      (part) =>
        isRecord(part) &&
        (part['kind'] === 'box' || (part['kind'] === 'cylinder' && part['pose'] === 'standing')),
    );
  },

  triedKind: (observation, args) => {
    if (!isShapes(observation) || !isRecord(args)) return false;
    const kind = args['kind'];
    const pose = args['pose'];
    if (!isShapeKind(kind)) return false;
    if (pose !== undefined && typeof pose !== 'string') return false;
    const trials = readTrials(observation);
    if (!trials) return false;
    return trials.some((t) => t.kind === kind && (pose === undefined || t.pose === pose));
  },

  cylinderTriedBothPoses: (observation) => {
    if (!isShapes(observation)) return false;
    const trials = readTrials(observation);
    if (!trials) return false;
    const poseSeen = (pose: string) => trials.some((t) => t.kind === 'cylinder' && t.pose === pose);
    return poseSeen('standing') && poseSeen('lying');
  },

  cluesShownAtLeast: (observation, args) => {
    if (!isShapes(observation)) return false;
    const n = intArg(args, 'n');
    const shown = observation['cluesShown'];
    return n !== null && typeof shown === 'number' && shown >= n;
  },

  fallenAtLeast: (observation, args) => {
    if (!isShapes(observation)) return false;
    const n = intArg(args, 'n');
    const fallen = observation['fallenCount'];
    return n !== null && typeof fallen === 'number' && fallen >= n;
  },
};

export function emitShapes(prev: ShapesState, next: ShapesState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (next.trials !== prev.trials) {
    const played = next.trials[next.trials.length - 1];
    if (played) {
      events.push({
        name: 'shape-played',
        payload: { kind: played.kind, pose: played.pose, result: played.result },
      });
    }
  }

  if (next.tower.length > prev.tower.length) {
    const id = next.tower[next.tower.length - 1];
    const part = id === undefined ? null : partOf(next, id);
    if (part) {
      events.push({
        name: 'shape-stacked',
        payload: { kind: part.kind, pose: part.pose, height: next.tower.length },
      });
    }
  }

  if (next.fallen !== prev.fallen) {
    const fell = next.fallen[next.fallen.length - 1];
    if (fell) {
      events.push({
        name: 'shape-fell',
        payload: { kind: fell.kind, pose: fell.pose, count: next.fallen.length },
      });
    }
  }

  if (next.cluesShown > prev.cluesShown && next.settings.mystery) {
    const index = next.cluesShown - 1;
    const clue = cluesOf(next.settings.mystery.kind)[index];
    if (clue) events.push({ name: 'clue-shown', payload: { index, clue } });
  }

  return events;
}
