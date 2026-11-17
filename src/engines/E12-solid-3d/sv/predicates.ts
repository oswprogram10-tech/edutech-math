/**
 * E12 `surface-volume` 모드 predicate · 이벤트 생성(순수 함수).
 *
 * 모든 predicate는 `surface-volume` 관찰에서만 참이 될 수 있다.
 */
import type {
  EngineEvent,
  EnginePredicate,
  JsonValue,
  Observation,
} from '../../../core/engine-sdk';
import type { SvState } from '../types';
import { sameBox } from './geometry';

function isRecord(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return (
    value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  );
}

function isSv(observation: Observation): boolean {
  return observation['mode'] === 'surface-volume';
}

function intArg(args: JsonValue | undefined, key: string): number | null {
  if (!isRecord(args)) return null;
  const val = args[key];
  return typeof val === 'number' && Number.isInteger(val) ? val : null;
}

interface ObsRow {
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly surface: number | null;
}

function readRows(observation: Observation): readonly ObsRow[] | null {
  const raw = observation['logRows'];
  if (!Array.isArray(raw)) return null;
  const out: ObsRow[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const { w, d, h, surface } = item;
    if (typeof w !== 'number' || typeof d !== 'number' || typeof h !== 'number') return null;
    if (surface !== null && typeof surface !== 'number') return null;
    out.push({ w, d, h, surface });
  }
  return out;
}

export const svPredicates: Readonly<Record<string, EnginePredicate>> = {
  allFacesPainted: (observation) => isSv(observation) && observation['allPainted'] === true,

  paintedFacesIs: (observation, args) => {
    if (!isSv(observation)) return false;
    const count = intArg(args, 'count');
    return count !== null && observation['paintedCount'] === count;
  },

  voxelsComplete: (observation) => isSv(observation) && observation['complete'] === true,

  fullLayersIs: (observation, args) => {
    if (!isSv(observation)) return false;
    const count = intArg(args, 'count');
    return count !== null && observation['fullLayers'] === count;
  },

  logDistinctAtLeast: (observation, args) => {
    if (!isSv(observation)) return false;
    const count = intArg(args, 'count');
    const distinct = observation['logDistinct'];
    return count !== null && typeof distinct === 'number' && distinct >= count;
  },

  logAllCorrect: (observation) => {
    if (!isSv(observation)) return false;
    const correct = observation['logCorrect'];
    return Array.isArray(correct) && correct.length > 0 && correct.every((c) => c === true);
  },

  logHasMinSurface: (observation) => isSv(observation) && observation['minSurfaceLogged'] === true,

  logSurfaceIs: (observation, args) => {
    if (!isSv(observation)) return false;
    const w = intArg(args, 'w');
    const d = intArg(args, 'd');
    const h = intArg(args, 'h');
    const value = intArg(args, 'value');
    if (w === null || d === null || h === null || value === null) return false;
    const rows = readRows(observation);
    if (!rows) return false;
    return rows.some((r) => sameBox([r.w, r.d, r.h], [w, d, h]) && r.surface === value);
  },

  stepIs: (observation, args) => {
    if (!isSv(observation) || !isRecord(args)) return false;
    const step = args['step'];
    return typeof step === 'string' && observation['step'] === step;
  },
};

type Cube = readonly [number, number, number];

function cubeKey(c: Cube): string {
  return `${c[0]},${c[1]},${c[2]}`;
}

export function emitSv(prev: SvState, next: SvState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (next.view.yaw !== prev.view.yaw || next.view.pitch !== prev.view.pitch) {
    events.push({
      name: 'view-changed',
      payload: { yaw: next.view.yaw, pitch: next.view.pitch },
    });
  }
  if (next.step !== prev.step) {
    events.push({ name: 'sv-step-changed', payload: { step: next.step } });
  }
  if (next.unfolded !== prev.unfolded) {
    events.push({ name: 'sv-unfold-toggled', payload: { unfolded: next.unfolded } });
  }

  const prevPainted = new Set<string>(prev.painted);
  const nextPainted = new Set<string>(next.painted);
  for (const face of next.painted) {
    if (!prevPainted.has(face))
      events.push({ name: 'sv-face-painted', payload: { face, painted: true } });
  }
  for (const face of prev.painted) {
    if (!nextPainted.has(face))
      events.push({ name: 'sv-face-painted', payload: { face, painted: false } });
  }

  const prevCubes = new Set(prev.filled.map(cubeKey));
  const nextCubes = new Set(next.filled.map(cubeKey));
  for (const c of next.filled) {
    if (!prevCubes.has(cubeKey(c))) {
      events.push({ name: 'sv-cube-placed', payload: { x: c[0], y: c[1], z: c[2] } });
    }
  }
  for (const c of prev.filled) {
    if (!nextCubes.has(cubeKey(c))) {
      events.push({ name: 'sv-cube-removed', payload: { x: c[0], y: c[1], z: c[2] } });
    }
  }

  if (
    next.dims[0] !== prev.dims[0] ||
    next.dims[1] !== prev.dims[1] ||
    next.dims[2] !== prev.dims[2]
  ) {
    events.push({
      name: 'sv-dims-changed',
      payload: { w: next.dims[0], d: next.dims[1], h: next.dims[2] },
    });
  }

  if (next.logRows.length > prev.logRows.length) {
    const added = next.logRows[next.logRows.length - 1];
    if (added)
      events.push({ name: 'sv-log-row-added', payload: { w: added.w, d: added.d, h: added.h } });
  } else if (next.logRows.length === prev.logRows.length) {
    next.logRows.forEach((row, i) => {
      const before = prev.logRows[i];
      if (before && before.surface !== row.surface) {
        events.push({ name: 'sv-log-surface-set', payload: { row: i } });
      }
    });
  }

  return events;
}
