/**
 * E12 `xray` 모드 predicate · 이벤트 생성(순수 함수).
 */
import type {
  EngineEvent,
  EnginePredicate,
  JsonValue,
  Observation,
} from '../../../core/engine-sdk';
import type { XrayState, XrayTool } from '../types';
import {
  isXrayFaceId,
  oppositeFace,
  perpendicularFaces,
  sketchSegmentEndpointKey,
  type XrayFaceId,
} from './geometry';

function isRecord(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return (
    value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  );
}

function isXrayObservation(observation: Observation): boolean {
  return observation['mode'] === 'xray';
}

function readToolKind(args: JsonValue | undefined): XrayTool | null {
  if (!isRecord(args)) return null;
  const kind = args['kind'];
  if (kind === 'face' || kind === 'edge' || kind === 'vertex') return kind;
  return null;
}

function readIntArg(args: JsonValue | undefined, key: string): number | null {
  if (!isRecord(args)) return null;
  const val = args[key];
  if (typeof val !== 'number' || !Number.isInteger(val)) return null;
  return val;
}

function readFaceArg(args: JsonValue | undefined, key = 'face'): XrayFaceId | null {
  if (!isRecord(args)) return null;
  const val = args[key];
  return isXrayFaceId(val) ? val : null;
}

function readMarkedFaces(observation: Observation): readonly string[] | null {
  const marked = observation['marked'];
  if (!isRecord(marked)) return null;
  const faces = marked['faces'];
  if (!Array.isArray(faces)) return null;
  const out: string[] = [];
  for (const f of faces) {
    if (typeof f !== 'string') return null;
    out.push(f);
  }
  return out;
}

const TOTAL_BY_KIND: Readonly<Record<XrayTool, number>> = {
  face: 6,
  edge: 12,
  vertex: 8,
};

export const xrayPredicates: Readonly<Record<string, EnginePredicate>> = {
  markedCountIs: (observation, args) => {
    if (!isXrayObservation(observation)) return false;
    const kind = readToolKind(args);
    const n = readIntArg(args, 'n');
    if (!kind || n === null) return false;
    const counts = observation['markedCount'];
    if (!isRecord(counts)) return false;
    return counts[kind] === n;
  },

  allMarked: (observation, args) => {
    if (!isXrayObservation(observation)) return false;
    const kind = readToolKind(args);
    if (!kind) return false;
    const counts = observation['markedCount'];
    if (!isRecord(counts)) return false;
    return counts[kind] === TOTAL_BY_KIND[kind];
  },

  markedFacesParallelTo: (observation, args) => {
    if (!isXrayObservation(observation)) return false;
    const face = readFaceArg(args);
    if (!face) return false;
    const faces = readMarkedFaces(observation);
    if (!faces || faces.length !== 1) return false;
    return faces[0] === oppositeFace(face);
  },

  markedFacesPerpendicularTo: (observation, args) => {
    if (!isXrayObservation(observation)) return false;
    const face = readFaceArg(args);
    if (!face) return false;
    const faces = readMarkedFaces(observation);
    const expected = perpendicularFaces(face);
    if (!faces || faces.length !== expected.length) return false;
    return expected.every((exp, i) => faces[i] === exp);
  },

  xrayUsedIs: (observation, args) => {
    if (!isXrayObservation(observation) || !isRecord(args)) return false;
    const val = args['value'];
    if (typeof val !== 'boolean') return false;
    return observation['xrayUsed'] === val;
  },

  sketchComplete: (observation) => {
    if (!isXrayObservation(observation)) return false;
    const sketch = observation['sketch'];
    return isRecord(sketch) && sketch['complete'] === true;
  },

  sketchHiddenDrawnSolid: (observation) => {
    if (!isXrayObservation(observation)) return false;
    const sketch = observation['sketch'];
    return (
      isRecord(sketch) && typeof sketch['hiddenSolid'] === 'number' && sketch['hiddenSolid'] > 0
    );
  },
};

export function emitXray(prev: XrayState, next: XrayState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (next.view.yaw !== prev.view.yaw || next.view.pitch !== prev.view.pitch) {
    events.push({
      name: 'view-changed',
      payload: { yaw: next.view.yaw, pitch: next.view.pitch },
    });
  }

  if (next.xray !== prev.xray) {
    events.push({
      name: 'xray-toggled',
      payload: { on: next.xray },
    });
  }

  const diffKind = (kind: XrayTool, a: readonly string[], b: readonly string[]) => {
    const prevSet = new Set(a);
    const nextSet = new Set(b);
    for (const id of b) {
      if (!prevSet.has(id)) {
        events.push({ name: 'mark-toggled', payload: { kind, id, marked: true } });
      }
    }
    for (const id of a) {
      if (!nextSet.has(id)) {
        events.push({ name: 'mark-toggled', payload: { kind, id, marked: false } });
      }
    }
  };

  diffKind('face', prev.marked.faces, next.marked.faces);
  diffKind('edge', prev.marked.edges, next.marked.edges);
  diffKind('vertex', prev.marked.vertices, next.marked.vertices);

  if (next.queryFace !== prev.queryFace) {
    events.push({
      name: 'face-queried',
      payload: { face: next.queryFace },
    });
  }

  const prevSegMap = new Map(
    prev.segments.map((s) => [sketchSegmentEndpointKey(s.a, s.b), s.style] as const),
  );
  const nextSegMap = new Map(
    next.segments.map((s) => [sketchSegmentEndpointKey(s.a, s.b), s.style] as const),
  );
  for (const [key, style] of nextSegMap) {
    const prevStyle = prevSegMap.get(key);
    if (prevStyle === undefined || prevStyle !== style) {
      events.push({ name: 'segment-added', payload: { style } });
    }
  }
  for (const key of prevSegMap.keys()) {
    if (!nextSegMap.has(key)) {
      events.push({ name: 'segment-removed', payload: {} });
    }
  }

  return events;
}
