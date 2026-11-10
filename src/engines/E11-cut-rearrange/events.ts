/**
 * E11의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * 이벤트: `piece-cut {pieces}`, `outline-formed {kind}`, `fan-complete {sum}`.
 */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { Rational, congruentPolygons, gp } from '../../core/math';
import type { GPoint } from '../../core/math';
import { fanState } from './angle-gather/fan';
import type { AngleGatherState } from './angle-gather/types';
import { outlineOfPieces } from './pieces/outline';
import type { OutlineKind, PiecesState } from './pieces/types';
import type { CutState } from './types';

function argsRecord(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {};
  return args;
}

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function stringArg(args: Readonly<Record<string, JsonValue>>, key: string): string | null {
  const value = args[key];
  return typeof value === 'string' ? value : null;
}

function numberArg(args: Readonly<Record<string, JsonValue>>, key: string): number | null {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function arrayOf(value: JsonValue | undefined): readonly JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function rationalText(value: JsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function sameRational(a: string, b: string): boolean {
  try {
    return Rational.parse(a).equals(Rational.parse(b));
  } catch {
    return false;
  }
}

const INCLUDED: Readonly<Record<string, readonly OutlineKind[]>> = {
  triangle: ['triangle'],
  square: ['square'],
  rectangle: ['square', 'rectangle'],
  rhombus: ['square', 'rhombus'],
  parallelogram: ['square', 'rectangle', 'rhombus', 'parallelogram'],
  trapezoid: ['square', 'rectangle', 'rhombus', 'parallelogram', 'trapezoid'],
  quadrilateral: ['square', 'rectangle', 'rhombus', 'parallelogram', 'trapezoid', 'quadrilateral'],
  polygon: ['polygon'],
};

function trialPoints(item: JsonValue): GPoint[] | null {
  const record = recordOf(item);
  if (!record) return null;
  const points: GPoint[] = [];
  for (const vertex of arrayOf(record['vertices'])) {
    if (typeof vertex !== 'string') return null;
    const parts = vertex.split(',');
    if (parts.length !== 2) return null;
    const x = parts[0];
    const y = parts[1];
    if (x === undefined || y === undefined) return null;
    const xi = Number(x);
    const yi = Number(y);
    if (!Number.isInteger(xi) || !Number.isInteger(yi)) return null;
    points.push(gp(xi, yi));
  }
  return points.length >= 3 ? points : null;
}

function distinctTrials(observation: Observation, sum: number | null): number {
  if (sum === null) {
    const stored = observation['distinctTrials'];
    return typeof stored === 'number' ? stored : 0;
  }
  const groups: GPoint[][] = [];
  for (const item of arrayOf(observation['trials'])) {
    const record = recordOf(item);
    if (!record || record['sum'] !== sum) continue;
    const points = trialPoints(item);
    if (points && !groups.some((existing) => congruentPolygons(existing, points))) {
      groups.push(points);
    }
  }
  return groups.length;
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  outlineIs: (observation, args) => {
    const record = argsRecord(args);
    const kind = stringArg(record, 'kind');
    if (kind === null) return false;
    const outline = recordOf(observation['outline']);
    if (!outline) return false;
    const actual = outline['kind'];
    if (typeof actual !== 'string') return false;
    const allowed = INCLUDED[kind];
    if (!allowed || !allowed.includes(actual as OutlineKind)) return false;

    for (const key of ['base', 'width', 'height'] as const) {
      const expected = stringArg(record, key);
      if (expected === null) continue;
      const observed = rationalText(outline[key]);
      if (observed === null || !sameRational(observed, expected)) return false;
    }
    return true;
  },

  areaPreserved: (observation) =>
    observation['areaConserved'] === true && observation['overlap'] === false,

  areaRatioIs: (observation, args) => {
    const expected = stringArg(argsRecord(args), 'value');
    const observed = rationalText(observation['areaRatio']);
    return expected !== null && observed !== null && sameRational(observed, expected);
  },

  totalAreaIs: (observation, args) => {
    const expected = stringArg(argsRecord(args), 'value');
    const observed = rationalText(observation['totalArea']);
    return expected !== null && observed !== null && sameRational(observed, expected);
  },

  usedTools: (observation, args) => {
    const wanted = arrayOf(argsRecord(args)['tools']).filter(
      (item): item is string => typeof item === 'string',
    );
    const used = arrayOf(observation['toolsUsed']).filter(
      (item): item is string => typeof item === 'string',
    );
    return wanted.length > 0 && wanted.every((tool) => used.includes(tool));
  },

  gatheredSumIs: (observation, args) => {
    const value = numberArg(argsRecord(args), 'value');
    return value !== null && observation['gatheredSum'] === value;
  },

  distinctTrials: (observation, args) => {
    const record = argsRecord(args);
    const count = numberArg(record, 'count');
    if (count === null) return false;
    const sum = numberArg(record, 'sum');
    return distinctTrials(observation, sum) >= count;
  },
};

export const EVENT_NAMES = ['piece-cut', 'outline-formed', 'fan-complete'] as const;

function piecesOutline(state: CutState) {
  return state.mode === 'angle-gather' ? null : outlineOfPieces(state);
}

function angleState(state: CutState): AngleGatherState | null {
  return state.mode === 'angle-gather' ? state : null;
}

export function emit(prev: CutState, next: CutState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (prev.mode !== 'angle-gather' && next.mode !== 'angle-gather') {
    const before: PiecesState = prev;
    const after: PiecesState = next;
    if (after.cuts > before.cuts) {
      events.push({ name: 'piece-cut', payload: { pieces: after.pieces.length } });
    }
  }

  const beforeOutline = piecesOutline(prev);
  const afterOutline = piecesOutline(next);
  if (afterOutline && (!beforeOutline || beforeOutline.kind !== afterOutline.kind)) {
    events.push({ name: 'outline-formed', payload: { kind: afterOutline.kind } });
  }

  const beforeAngle = angleState(prev);
  const afterAngle = angleState(next);
  if (beforeAngle && afterAngle) {
    const before = fanState(beforeAngle);
    const after = fanState(afterAngle);
    if ((after === 'straight' || after === 'full') && before !== after) {
      events.push({ name: 'fan-complete', payload: { sum: after === 'straight' ? 180 : 360 } });
    }
  }

  return events;
}
