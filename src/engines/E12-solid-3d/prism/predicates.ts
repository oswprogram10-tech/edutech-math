/**
 * E12 `prism-pyramid` 모드 predicate · 이벤트 생성(순수 함수).
 *
 * `markedCountIs`·`allMarked`는 xray와 이름이 같다. 이 파일은 prism 관찰에서의 동작만 맡고,
 * `events.ts`가 관찰의 `mode`를 보고 xray·prism 구현으로 나눈다(xray 코드는 그대로다).
 */
import type {
  EngineEvent,
  EnginePredicate,
  JsonValue,
  Observation,
} from '../../../core/engine-sdk';
import type { PrismState } from '../types';

type Kind3 = 'face' | 'edge' | 'vertex';

function isRecord(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return (
    value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  );
}

function isPrismObservation(observation: Observation): boolean {
  return observation['mode'] === 'prism-pyramid';
}

function readKind3(args: JsonValue | undefined): Kind3 | null {
  if (!isRecord(args)) return null;
  const kind = args['kind'];
  return kind === 'face' || kind === 'edge' || kind === 'vertex' ? kind : null;
}

function readSolidKind(args: JsonValue | undefined): 'base' | 'prism' | 'pyramid' | null {
  if (!isRecord(args)) return null;
  const kind = args['kind'];
  return kind === 'base' || kind === 'prism' || kind === 'pyramid' ? kind : null;
}

function readIntArg(args: JsonValue | undefined, key: string): number | null {
  if (!isRecord(args)) return null;
  const val = args[key];
  return typeof val === 'number' && Number.isInteger(val) ? val : null;
}

function readOptionalInt(args: JsonValue | undefined, key: string): number | null | 'bad' {
  if (!isRecord(args) || args[key] === undefined) return null;
  const val = args[key];
  return typeof val === 'number' && Number.isInteger(val) ? val : 'bad';
}

function readCounts(
  observation: Observation,
  key: string,
): Readonly<Record<string, JsonValue>> | null {
  const value = observation[key];
  return isRecord(value) ? value : null;
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

interface TableRowObs {
  readonly kind: string;
  readonly n: number;
  readonly faces: number | null;
  readonly edges: number | null;
  readonly vertices: number | null;
}

function readTable(observation: Observation): readonly TableRowObs[] | null {
  const table = observation['table'];
  if (!Array.isArray(table)) return null;
  const rows: TableRowObs[] = [];
  for (const item of table) {
    if (!isRecord(item)) return null;
    const { kind, n, faces, edges, vertices } = item;
    if (typeof kind !== 'string' || typeof n !== 'number') return null;
    const asNum = (v: JsonValue | undefined) => (typeof v === 'number' ? v : null);
    rows.push({ kind, n, faces: asNum(faces), edges: asNum(edges), vertices: asNum(vertices) });
  }
  return rows;
}

export const prismMarkedCountIs: EnginePredicate = (observation, args) => {
  if (!isPrismObservation(observation)) return false;
  const kind = readKind3(args);
  const n = readIntArg(args, 'n');
  if (!kind || n === null) return false;
  const counts = readCounts(observation, 'markedCount');
  return counts !== null && counts[kind] === n;
};

export const prismAllMarked: EnginePredicate = (observation, args) => {
  if (!isPrismObservation(observation)) return false;
  const kind = readKind3(args);
  if (!kind) return false;
  const counts = readCounts(observation, 'markedCount');
  const truth = readCounts(observation, 'trueCount');
  if (!counts || !truth) return false;
  const total = truth[kind];
  return typeof total === 'number' && counts[kind] === total;
};

export const prismPredicates: Readonly<Record<string, EnginePredicate>> = {
  solidIs: (observation, args) => {
    if (!isPrismObservation(observation)) return false;
    const kind = readSolidKind(args);
    if (!kind) return false;
    const n = readOptionalInt(args, 'n');
    if (n === 'bad') return false;
    if (observation['kind'] !== kind) return false;
    return n === null || observation['sides'] === n;
  },

  tableRowIs: (observation, args) => {
    if (!isPrismObservation(observation)) return false;
    const kind = readSolidKind(args);
    const n = readIntArg(args, 'n');
    if (!kind || n === null) return false;
    const faces = readOptionalInt(args, 'faces');
    const edges = readOptionalInt(args, 'edges');
    const vertices = readOptionalInt(args, 'vertices');
    if (faces === 'bad' || edges === 'bad' || vertices === 'bad') return false;
    const table = readTable(observation);
    if (!table) return false;
    const row = table.find((r) => r.kind === kind && r.n === n);
    if (!row) return false;
    return (
      (faces === null || row.faces === faces) &&
      (edges === null || row.edges === edges) &&
      (vertices === null || row.vertices === vertices)
    );
  },

  tableRowCorrect: (observation, args) => {
    if (!isPrismObservation(observation)) return false;
    const kind = readSolidKind(args);
    const n = readIntArg(args, 'n');
    if (!kind || n === null) return false;
    const table = readTable(observation);
    const correct = observation['tableCorrect'];
    if (!table || !Array.isArray(correct)) return false;
    const idx = table.findIndex((r) => r.kind === kind && r.n === n);
    return idx >= 0 && correct[idx] === true;
  },

  tableCorrectAtLeast: (observation, args) => {
    if (!isPrismObservation(observation)) return false;
    const count = readIntArg(args, 'count');
    const correct = observation['tableCorrect'];
    if (count === null || !Array.isArray(correct)) return false;
    return correct.filter((c) => c === true).length >= count;
  },

  apexPlayedIs: (observation, args) => {
    if (!isPrismObservation(observation) || !isRecord(args)) return false;
    const value = args['value'];
    return typeof value === 'boolean' && observation['apexPlayed'] === value;
  },

  markedBasesOk: (observation) => {
    if (!isPrismObservation(observation)) return false;
    const faces = readMarkedFaces(observation);
    if (!faces) return false;
    if (observation['kind'] === 'prism') {
      return faces.length === 2 && faces[0] === 'bottom' && faces[1] === 'top';
    }
    if (observation['kind'] === 'pyramid') {
      return faces.length === 1 && faces[0] === 'bottom';
    }
    return false;
  },
};

export function emitPrism(prev: PrismState, next: PrismState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (next.view.yaw !== prev.view.yaw || next.view.pitch !== prev.view.pitch) {
    events.push({
      name: 'view-changed',
      payload: { yaw: next.view.yaw, pitch: next.view.pitch },
    });
  }
  if (next.xray !== prev.xray) {
    events.push({ name: 'xray-toggled', payload: { on: next.xray } });
  }
  if (next.sides !== prev.sides) {
    events.push({ name: 'sides-changed', payload: { n: next.sides } });
  }
  if (next.height !== prev.height) {
    events.push({ name: 'height-changed', payload: { h: next.height } });
  }
  if (next.top !== prev.top) {
    events.push({ name: 'top-changed', payload: { top: next.top } });
  }

  const diffKind = (kind: Kind3, a: readonly string[], b: readonly string[]) => {
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

  if (next.table.length > prev.table.length) {
    const added = next.table[next.table.length - 1];
    if (added) {
      events.push({ name: 'table-row-added', payload: { kind: added.kind, n: added.n } });
    }
  }
  if (next.table.length === prev.table.length) {
    next.table.forEach((row, i) => {
      const before = prev.table[i];
      if (!before) return;
      for (const col of ['faces', 'edges', 'vertices'] as const) {
        if (before[col] !== row[col]) {
          events.push({ name: 'table-cell-set', payload: { row: i, col } });
        }
      }
    });
  }

  return events;
}
