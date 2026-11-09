/**
 * E09의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * 이벤트: `shape-closed {vertices}`, `object-created {kind}`.
 */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { shapeObservation, objectHitsTarget } from './observe';
import { samePeg } from './reduce';
import type { GeoObjectKind, GeoState, Peg } from './types';

function argsRecord(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {};
  return args;
}

function numberArg(args: Readonly<Record<string, JsonValue>>, key: string): number | null {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringArg(args: Readonly<Record<string, JsonValue>>, key: string): string | null {
  const value = args[key];
  return typeof value === 'string' ? value : null;
}

function pegArg(value: JsonValue | undefined): Peg | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = value[0];
  const y = value[1];
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [Math.round(x), Math.round(y)];
}

interface EndpointArgument {
  readonly label: string | null;
  readonly peg: Peg | null;
}

function endpointArg(value: JsonValue | undefined): EndpointArgument | null {
  if (typeof value === 'string') return { label: value, peg: null };
  const peg = pegArg(value);
  if (peg) return { label: `${peg[0]},${peg[1]}`, peg };
  return null;
}

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function arrayOf(value: JsonValue | undefined): readonly JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function endpointMatches(
  observedLabel: JsonValue | undefined,
  observedPeg: JsonValue | undefined,
  expected: EndpointArgument,
): boolean {
  if (expected.label !== null && typeof observedLabel === 'string') {
    if (observedLabel === expected.label) return true;
  }
  if (expected.peg !== null && Array.isArray(observedPeg)) {
    const peg = pegArg(observedPeg as JsonValue);
    if (peg && samePeg(peg, expected.peg)) return true;
  }
  return false;
}

function pairMatches(
  observedFrom: JsonValue | undefined,
  observedTo: JsonValue | undefined,
  pointFrom: JsonValue | undefined,
  pointTo: JsonValue | undefined,
  expectedFrom: EndpointArgument,
  expectedTo: EndpointArgument,
  ordered: boolean,
): boolean {
  const forward =
    endpointMatches(observedFrom, pointFrom, expectedFrom) &&
    endpointMatches(observedTo, pointTo, expectedTo);
  if (forward) return true;
  if (ordered) return false;
  return (
    endpointMatches(observedFrom, pointFrom, expectedTo) &&
    endpointMatches(observedTo, pointTo, expectedFrom)
  );
}

function targetPegs(observation: Observation): Peg[] {
  const points = observation['targetPoints'];
  if (!Array.isArray(points)) return [];
  return points.map((item) => pegArg(item)).filter((peg): peg is Peg => peg !== null);
}

function targetCoordinate(value: JsonValue): Peg | null {
  const peg = pegArg(value);
  return peg;
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  shapeWithVertices: (observation, args) => {
    const count = numberArg(argsRecord(args), 'count');
    const shapes = observation['shapes'];
    if (count === null || !Array.isArray(shapes)) return false;
    return shapes.some((item) => {
      const shape = recordOf(item);
      return shape !== null && shape['simple'] === true && shape['vertices'] === count;
    });
  },

  distinctShapes: (observation, args) => {
    const record = argsRecord(args);
    const vertices = numberArg(record, 'vertices');
    const count = numberArg(record, 'count');
    if (vertices === null || count === null) return false;
    const distinct = recordOf(observation['distinctBy']);
    if (!distinct) return false;
    const value = distinct[String(vertices)];
    return typeof value === 'number' && value >= count;
  },

  hasObject: (observation, args) => {
    const record = argsRecord(args);
    const kind = stringArg(record, 'kind');
    const from = endpointArg(record['from']);
    const to = endpointArg(record['to']);
    if (kind === null || !from || !to) return false;
    const objects = arrayOf(observation['objects']);
    const points = arrayOf(observation['objectPoints']);
    return objects.some((item, index) => {
      const object = recordOf(item);
      const point = recordOf(points[index]);
      if (!object || object['kind'] !== kind) return false;
      return pairMatches(
        object['from'],
        object['to'],
        point?.['from'],
        point?.['to'],
        from,
        to,
        kind === 'ray',
      );
    });
  },

  oneObjectHits: (observation, args) => {
    const record = argsRecord(args);
    const kind = stringArg(record, 'kind');
    const expected = arrayOf(record['targets']);
    if (kind === null || expected.length === 0) return false;
    const available = targetPegs(observation);
    const wanted: Peg[] = [];
    for (const item of expected) {
      if (typeof item === 'number') {
        const found = available[Math.round(item) - 1];
        if (!found) return false;
        wanted.push(found);
        continue;
      }
      const peg = targetCoordinate(item);
      if (!peg) return false;
      wanted.push(peg);
    }

    const points = arrayOf(observation['objectPoints']);
    return points.some((item) => {
      const object = recordOf(item);
      if (!object || object['kind'] !== kind) return false;
      const from = pegArg(object['from']);
      const to = pegArg(object['to']);
      if (!from || !to) return false;
      const candidate = { id: '', kind: kind as GeoObjectKind, from, to };
      return wanted.every((target) => objectHitsTarget(candidate, target));
    });
  },

  distinctRayStarts: (observation, args) => {
    const count = numberArg(argsRecord(args), 'count');
    if (count === null) return false;
    const points = arrayOf(observation['objectPoints']);
    const starts = new Set<string>();
    for (const item of points) {
      const object = recordOf(item);
      if (!object || object['kind'] !== 'ray') continue;
      const from = pegArg(object['from']);
      if (from) starts.add(`${from[0]},${from[1]}`);
    }
    return starts.size >= count;
  },

  markedAre: (observation, args) => {
    const expected = arrayOf(argsRecord(args)['ids']).filter(
      (item): item is string => typeof item === 'string',
    );
    const marked = arrayOf(observation['marked']).filter(
      (item): item is string => typeof item === 'string',
    );
    if (expected.length !== marked.length) return false;
    const actual = new Set(marked);
    return expected.every((id) => actual.has(id));
  },
};

export const EVENT_NAMES = ['shape-closed', 'object-created'] as const;

export function emit(prev: GeoState, next: GeoState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (next.mode === 'geoboard' && prev.mode === 'geoboard') {
    for (const band of next.bands) {
      if (!band.closed) continue;
      const before = prev.bands.find((candidate) => candidate.id === band.id);
      if (before && before.closed) continue;
      events.push({
        name: 'shape-closed',
        payload: { vertices: shapeObservation(band).vertices },
      });
    }
  }

  if (next.mode === 'construct' && prev.mode === 'construct') {
    if (next.objects.length > prev.objects.length) {
      const created = next.objects[next.objects.length - 1];
      if (created) events.push({ name: 'object-created', payload: { kind: created.kind } });
    }
  }

  return events;
}
