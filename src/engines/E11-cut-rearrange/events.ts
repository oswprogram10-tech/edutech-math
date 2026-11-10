/**
 * E11의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * 이벤트: `piece-cut {pieces}`, `outline-formed {kind}`, `fan-complete {sum}`,
 * `silhouette-filled {silhouette}`, `sectors-arranged {divisions}`.
 */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { Rational, congruentPolygons, gp } from '../../core/math';
import type { GPoint } from '../../core/math';
import { fanState } from './angle-gather/fan';
import type { AngleGatherState } from './angle-gather/types';
import type { CircleSectorsState } from './circle-sectors/types';
import { outlineOfPieces } from './pieces/outline';
import type { OutlineKind, PiecesState } from './pieces/types';
import { analyzeTangram } from './tangram/observe';
import type { TangramState } from './tangram/types';
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

    const pieces = numberArg(record, 'pieces');
    if (pieces !== null && observation['pieceCount'] !== pieces) return false;

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

  silhouetteFilled: (observation) =>
    observation['filled'] === true &&
    observation['overlap'] === false &&
    observation['sticksOut'] === false,

  selectedAllWithCorners: (observation, args) => {
    const corners = numberArg(argsRecord(args), 'corners');
    if (corners === null) return false;
    const selected = arrayOf(observation['selected'])
      .filter((item): item is string => typeof item === 'string')
      .sort();
    if (selected.length === 0) return false;
    const wanted: string[] = [];
    for (const item of arrayOf(observation['pieces'])) {
      const record = recordOf(item);
      if (!record) continue;
      const id = record['id'];
      if (typeof id === 'string' && record['corners'] === corners) wanted.push(id);
    }
    wanted.sort();
    return selected.length === wanted.length && selected.every((id, index) => id === wanted[index]);
  },

  sectorsArranged: (observation, args) => {
    const divisions = numberArg(argsRecord(args), 'divisions');
    if (divisions === null) return observation['arranged'] === true;
    return arrayOf(observation['arrangedDivisions']).some((value) => value === divisions);
  },

  arrangedAtLeast: (observation, args) => {
    const divisions = numberArg(argsRecord(args), 'divisions');
    if (divisions === null) return false;
    let best = 0;
    for (const value of arrayOf(observation['arrangedDivisions'])) {
      if (typeof value === 'number' && value > best) best = value;
    }
    return best >= divisions;
  },
};

export const EVENT_NAMES = [
  'piece-cut',
  'outline-formed',
  'fan-complete',
  'silhouette-filled',
  'sectors-arranged',
] as const;

function pieceState(state: CutState): PiecesState | null {
  return state.mode === 'slice' || state.mode === 'formula-derive' ? state : null;
}

function angleState(state: CutState): AngleGatherState | null {
  return state.mode === 'angle-gather' ? state : null;
}

function tangramState(state: CutState): TangramState | null {
  return state.mode === 'tangram' ? state : null;
}

function circleState(state: CutState): CircleSectorsState | null {
  return state.mode === 'circle-sectors' ? state : null;
}

function piecesOutline(state: CutState) {
  const pieces = pieceState(state);
  return pieces ? outlineOfPieces(pieces) : null;
}

export function emit(prev: CutState, next: CutState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  const beforePieces = pieceState(prev);
  const afterPieces = pieceState(next);
  if (beforePieces && afterPieces && afterPieces.cuts > beforePieces.cuts) {
    events.push({ name: 'piece-cut', payload: { pieces: afterPieces.pieces.length } });
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

  const beforeTangram = tangramState(prev);
  const afterTangram = tangramState(next);
  if (beforeTangram && afterTangram) {
    const before = analyzeTangram(beforeTangram).filled;
    const after = analyzeTangram(afterTangram).filled;
    if (!before && after) {
      events.push({
        name: 'silhouette-filled',
        payload: { silhouette: afterTangram.settings.silhouette },
      });
    }
  }

  const beforeCircle = circleState(prev);
  const afterCircle = circleState(next);
  if (beforeCircle && afterCircle) {
    for (const divisions of afterCircle.arrangedDivisions) {
      if (!beforeCircle.arrangedDivisions.includes(divisions)) {
        events.push({ name: 'sectors-arranged', payload: { divisions } });
      }
    }
  }

  return events;
}
