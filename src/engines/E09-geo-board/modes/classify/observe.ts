/**
 * classify 모드의 관찰 결과와 판정(T101).
 *
 * geoboard의 `shapes`·`closedShapes`·`distinctBy`에 성질과 이름을 더한다.
 * 이름은 Observation에만 있고 화면 글자로는 쓰지 않는다.
 */
import type { EnginePredicate, JsonValue, Observation } from '../../../../core/engine-sdk';
import { gp, isRightAngle, isSimplePolygon, simplifyPolygon } from '../../../../core/math';
import type { GPoint } from '../../../../core/math';
import { shapeObservation } from '../../observe';
import { congruenceKey, propertiesOfGPolygon } from '../../properties';
import type { FigureProps } from '../../properties';
import type { GeoBand, Peg } from '../../types';
import type { ClassifyState } from './types';

function pointsOf(pegs: readonly Peg[]): GPoint[] {
  return pegs.map((peg) => gp(peg[0], peg[1]));
}

/** 닫힌 단순 고무줄의 성질. 아니면 null. */
export function classifyProps(band: GeoBand): FigureProps | null {
  if (!band.closed) return null;
  const points = pointsOf(band.pegs);
  if (!isSimplePolygon(points)) return null;
  return propertiesOfGPolygon(simplifyPolygon(points));
}

function emptyShape() {
  return {
    rightAngles: 0,
    acuteAngles: 0,
    obtuseAngles: 0,
    reflexAngles: 0,
    parallelPairs: 0,
    equalSides: 0,
    equalAngles: 0,
    convex: false,
    regular: false,
    names: [] as string[],
    congruenceKey: null as string | null,
  };
}

export function classifyShapeObservation(band: GeoBand) {
  const base = shapeObservation(band);
  const props = classifyProps(band);
  if (!props) return { ...base, ...emptyShape() };
  const simplified = props.vertices;
  return {
    ...base,
    rightAngles: props.rightAngles,
    acuteAngles: props.acuteAngles,
    obtuseAngles: props.obtuseAngles,
    reflexAngles: props.reflexAngles,
    parallelPairs: props.parallelPairs,
    equalSides: props.equalSides,
    equalAngles: props.equalAngles,
    convex: props.convex,
    regular: props.regular,
    names: [...props.names],
    congruenceKey: congruenceKey(simplified),
  };
}

function distinctOf(
  shapes: readonly ReturnType<typeof classifyShapeObservation>[],
): Record<string, number> {
  const groups = new Map<string, Set<string>>();
  for (const shape of shapes) {
    if (!shape.simple || shape.congruenceKey === null) continue;
    const key = String(shape.vertices);
    const bucket = groups.get(key) ?? new Set<string>();
    bucket.add(shape.congruenceKey);
    groups.set(key, bucket);
  }
  const result: Record<string, number> = {};
  for (const [key, value] of groups) result[key] = value.size;
  return result;
}

export function squareFits(state: ClassifyState): boolean | null {
  const chosen = state.squareOn;
  if (!chosen) return null;
  const band = state.bands.find((candidate) => candidate.id === chosen.band);
  if (!band || !band.closed) return null;
  const points = pointsOf(band.pegs);
  if (!isSimplePolygon(points)) return null;
  const previous = band.pegs[(chosen.index - 1 + band.pegs.length) % band.pegs.length];
  const current = band.pegs[chosen.index];
  const next = band.pegs[(chosen.index + 1) % band.pegs.length];
  if (!previous || !current || !next) return null;
  return isRightAngle(
    gp(previous[0], previous[1]),
    gp(current[0], current[1]),
    gp(next[0], next[1]),
  );
}

export function observeClassify(state: ClassifyState): Observation {
  const shapes = state.bands.map(classifyShapeObservation);
  return {
    mode: state.mode,
    shapes: shapes.map((shape) => ({ ...shape, names: [...shape.names] })),
    closedShapes: shapes.filter((shape) => shape.closed && shape.simple).length,
    distinctBy: distinctOf(shapes),
    squareOn: state.squareOn ? { band: state.squareOn.band, index: state.squareOn.index } : null,
    squareFits: squareFits(state),
  };
}

function argsRecord(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {};
  return args;
}

function shapeRecords(observation: Observation): Readonly<Record<string, JsonValue>>[] {
  const value = observation['shapes'];
  if (!Array.isArray(value)) return [];
  const result: Readonly<Record<string, JsonValue>>[] = [];
  for (const item of value) {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) result.push(item);
  }
  return result;
}

const MATCH_KEYS = [
  'vertices',
  'rightAngles',
  'equalSides',
  'parallelPairs',
  'acuteAngles',
  'obtuseAngles',
  'reflexAngles',
  'equalAngles',
] as const;

function matchesShape(
  shape: Readonly<Record<string, JsonValue>>,
  args: Readonly<Record<string, JsonValue>>,
): boolean {
  if (shape['simple'] !== true) return false;
  if (args['convex'] !== undefined && shape['convex'] !== args['convex']) return false;
  for (const key of MATCH_KEYS) {
    const expected = args[key];
    if (expected === undefined) continue;
    if (typeof expected !== 'number' || shape[key] !== expected) return false;
  }
  return true;
}

export const classifyPredicates: Readonly<Record<string, EnginePredicate>> = {
  shapeHas: (observation, args) => {
    const record = argsRecord(args);
    return shapeRecords(observation).some((shape) => matchesShape(shape, record));
  },

  shapesWith: (observation, args) => {
    const record = argsRecord(args);
    const count = record['count'];
    if (typeof count !== 'number') return false;
    const matching = shapeRecords(observation).filter((shape) => matchesShape(shape, record));
    if (record['distinct'] === true) {
      const keys = new Set<string>();
      for (const shape of matching) {
        const key = shape['congruenceKey'];
        if (typeof key === 'string') keys.add(key);
      }
      return keys.size >= count;
    }
    return matching.length >= count;
  },

  shapeNamed: (observation, args) => {
    const record = argsRecord(args);
    const name = record['name'];
    if (typeof name !== 'string') return false;
    return shapeRecords(observation).some((shape) => {
      const names = shape['names'];
      return Array.isArray(names) && names.includes(name);
    });
  },
};

/** classify에서도 `shape-closed`를 내고 payload에 이름을 더한다. */
export function classifyClosedPayload(band: GeoBand): JsonValue {
  const observation = classifyShapeObservation(band);
  return {
    vertices: observation.vertices,
    names: [...observation.names],
  };
}
