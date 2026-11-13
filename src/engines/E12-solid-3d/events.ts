/**
 * E12 3D 입체의 공개 이벤트와 GoalSpec predicates(순수 함수).
 *
 * - 이벤트: `cube-added {x, y, z, count}`, `cube-removed {x, y, z, count}`, `view-turned {viewTurn}`
 * - 잘못된 predicate 인자는 예외를 던지지 않고 false를 돌려준다.
 */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import type { CubeCoord, ProjectionView, SolidState } from './types';
import { normalizeCubes, sameCells, sameHeights } from './voxel';

export const EVENT_NAMES = ['cube-added', 'cube-removed', 'view-turned'] as const;

function isRecord(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return (
    value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  );
}

function isMatrix(value: JsonValue | undefined): value is number[][] {
  if (!Array.isArray(value) || value.length === 0) return false;
  let width = -1;
  for (const row of value) {
    if (!Array.isArray(row) || row.length === 0) return false;
    if (width === -1) width = row.length;
    if (row.length !== width) return false;
    for (const cell of row) {
      if (typeof cell !== 'number' || !Number.isFinite(cell) || cell < 0) return false;
    }
  }
  return true;
}

function parseCubeCoords(value: JsonValue | undefined): CubeCoord[] | null {
  if (!Array.isArray(value)) return null;
  const result: CubeCoord[] = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length !== 3) return null;
    const [x, y, z] = item;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof z !== 'number' ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      !Number.isInteger(z)
    ) {
      return null;
    }
    result.push([x, y, z]);
  }
  return result;
}

function sameCoordLists(a: readonly CubeCoord[], b: readonly CubeCoord[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const ca = a[i];
    const cb = b[i];
    if (!ca || !cb) return false;
    if (ca[0] !== cb[0] || ca[1] !== cb[1] || ca[2] !== cb[2]) return false;
  }
  return true;
}

function isProjectionView(value: JsonValue | undefined): value is ProjectionView {
  return value === 'top' || value === 'front' || value === 'side';
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  countIs: (observation, args) => {
    if (!isRecord(args)) return false;
    const expected = args['count'];
    if (typeof expected !== 'number' || !Number.isFinite(expected)) return false;
    return observation['count'] === expected;
  },

  sameShape: (observation, args) => {
    if (!isRecord(args)) return false;
    const targetCubes = parseCubeCoords(args['cubes']);
    const obsCubes = parseCubeCoords(observation['cubes']);
    if (!targetCubes || !obsCubes) return false;
    const rotateVal = args['rotate'];
    if (rotateVal !== undefined && typeof rotateVal !== 'boolean') return false;
    const rotate = rotateVal === true;
    return sameCoordLists(normalizeCubes(obsCubes, rotate), normalizeCubes(targetCubes, rotate));
  },

  projectionMatches: (observation, args) => {
    if (!isRecord(args)) return false;
    const view = args['view'];
    const cells = args['cells'];
    const shiftVal = args['shift'];
    if (!isProjectionView(view) || !isMatrix(cells)) return false;
    if (shiftVal !== undefined && typeof shiftVal !== 'boolean') return false;
    const observed = observation[view];
    if (!isMatrix(observed)) return false;
    const shift = shiftVal !== false;
    return sameCells(observed, cells, shift, view === 'top');
  },

  projectionsMatch: (observation, args) => {
    if (!isRecord(args)) return false;
    const shiftVal = args['shift'];
    if (shiftVal !== undefined && typeof shiftVal !== 'boolean') return false;
    const shift = shiftVal !== false;
    const views: readonly ProjectionView[] = ['top', 'front', 'side'];
    let checked = 0;
    for (const view of views) {
      const cells = args[view];
      if (cells === undefined) continue;
      if (!isMatrix(cells)) return false;
      const observed = observation[view];
      if (!isMatrix(observed)) return false;
      if (!sameCells(observed, cells, shift, view === 'top')) return false;
      checked += 1;
    }
    return checked > 0;
  },

  heightsMatch: (observation, args) => {
    if (!isRecord(args)) return false;
    const expected = args['heights'];
    const shiftVal = args['shift'];
    if (!isMatrix(expected)) return false;
    if (shiftVal !== undefined && typeof shiftVal !== 'boolean') return false;
    const observed = observation['heights'];
    if (!isMatrix(observed)) return false;
    const shift = shiftVal !== false;
    return sameHeights(observed, expected, shift);
  },

  isConnected: (observation) => {
    return observation['connected'] === true;
  },
};

export function emit(prev: SolidState, next: SolidState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (next.cubes.length > prev.cubes.length) {
    const prevSet = new Set(prev.cubes.map((c) => `${c.x},${c.y},${c.z}`));
    for (const cube of next.cubes) {
      if (!prevSet.has(`${cube.x},${cube.y},${cube.z}`)) {
        events.push({
          name: 'cube-added',
          payload: { x: cube.x, y: cube.y, z: cube.z, count: next.cubes.length },
        });
      }
    }
  } else if (next.cubes.length < prev.cubes.length) {
    const nextSet = new Set(next.cubes.map((c) => `${c.x},${c.y},${c.z}`));
    const removed = prev.cubes.filter((c) => !nextSet.has(`${c.x},${c.y},${c.z}`));
    removed.forEach((cube, index) => {
      events.push({
        name: 'cube-removed',
        payload: {
          x: cube.x,
          y: cube.y,
          z: cube.z,
          count: prev.cubes.length - index - 1,
        },
      });
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

export type { Observation };
