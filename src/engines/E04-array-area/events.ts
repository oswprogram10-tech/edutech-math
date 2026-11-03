/**
 * E04의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * `partial-product-changed`의 `parts`는 T046에서 E07이 같은 색으로 받는다
 * (색 순서는 `types.ts`의 `PARTIAL_PALETTE`).
 */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { piecesOf } from './reduce';
import type { ArrayAreaState } from './types';
import { PARTIAL_PALETTE } from './types';

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

function numberList(value: JsonValue | undefined): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
}

function piecesSignature(state: ArrayAreaState): string {
  return piecesOf(state)
    .map((piece) => `${piece.rows}x${piece.cols}:${piece.sign}`)
    .join('|');
}

export function emit(prev: ArrayAreaState, next: ArrayAreaState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (
    (next.mode === 'split' || next.mode === 'area-model') &&
    piecesSignature(prev) !== piecesSignature(next)
  ) {
    const parts = piecesOf(next).map((piece, index) => ({
      a: piece.rows,
      b: piece.cols,
      product: piece.product * piece.sign,
      colorIndex: index % PARTIAL_PALETTE.length,
    }));
    events.push({ name: 'partial-product-changed', payload: { parts } });
  }

  const before = prev.rows * prev.cols;
  const after = next.rows * next.cols;
  if (next.mode === 'dot-array' && before !== after) {
    events.push({ name: 'value-changed', payload: { value: after } });
  }

  return events;
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  dimsAre: (observation: Observation, args) => {
    const record = argsRecord(args);
    const rows = numberArg(record, 'rows');
    const cols = numberArg(record, 'cols');
    const either = record['either'] === true;
    if (rows === null || cols === null) return false;
    const actualRows = observation['rows'];
    const actualCols = observation['cols'];
    if (actualRows === rows && actualCols === cols) return true;
    return either && actualRows === cols && actualCols === rows;
  },

  totalIs: (observation: Observation, args) => {
    const value = numberArg(argsRecord(args), 'value');
    return value !== null && observation['total'] === value;
  },

  distinctArrangementsAtLeast: (observation: Observation, args) => {
    const record = argsRecord(args);
    const count = numberArg(record, 'count');
    const total = numberArg(record, 'total');
    if (count === null) return false;
    const distinct = observation['distinctArrangements'];
    if (typeof distinct !== 'number' || distinct < count) return false;
    if (total !== null && observation['total'] !== total) return false;
    return true;
  },

  splitAt: (observation: Observation, args) => {
    const record = argsRecord(args);
    const orientation = stringArg(record, 'orientation');
    const at = numberArg(record, 'at');
    const splits = observation['splits'];
    if (orientation === null || at === null || !Array.isArray(splits)) return false;
    return splits.some(
      (split) =>
        split !== null &&
        typeof split === 'object' &&
        !Array.isArray(split) &&
        split['orientation'] === orientation &&
        split['at'] === at,
    );
  },

  partialsAre: (observation: Observation, args) => {
    const record = argsRecord(args);
    const expected = numberList(record['products']);
    const ordered = record['ordered'] === true;
    const partials = observation['partials'] ?? observation['pieces'];
    if (expected.length === 0 || !Array.isArray(partials)) return false;
    const actual = partials
      .filter(
        (piece): piece is Readonly<Record<string, JsonValue>> =>
          piece !== null && typeof piece === 'object' && !Array.isArray(piece),
      )
      .map((piece) => piece['product'])
      .filter((product): product is number => typeof product === 'number');
    if (ordered) {
      return (
        actual.length === expected.length &&
        actual.every((value, index) => value === expected[index])
      );
    }
    const sortedActual = [...actual].sort((a, b) => a - b);
    const sortedExpected = [...expected].sort((a, b) => a - b);
    return (
      sortedActual.length === sortedExpected.length &&
      sortedActual.every((value, index) => value === sortedExpected[index])
    );
  },

  partialSumIs: (observation: Observation, args) => {
    const value = numberArg(argsRecord(args), 'value');
    return value !== null && observation['partialSum'] === value;
  },

  distinctSplitsAtLeast: (observation: Observation, args) => {
    const count = numberArg(argsRecord(args), 'count');
    const distinct = observation['distinctSplits'];
    return count !== null && typeof distinct === 'number' && distinct >= count;
  },

  piecesAre: (observation: Observation, args) => {
    const expected = numberList(argsRecord(args)['products']);
    const partials = observation['pieces'] ?? observation['partials'];
    if (expected.length === 0 || !Array.isArray(partials)) return false;
    const actual = partials
      .filter(
        (piece): piece is Readonly<Record<string, JsonValue>> =>
          piece !== null && typeof piece === 'object' && !Array.isArray(piece),
      )
      .map((piece) => piece['product'])
      .filter((product): product is number => typeof product === 'number')
      .sort((a, b) => a - b);
    const sortedExpected = [...expected].sort((a, b) => a - b);
    return (
      actual.length === sortedExpected.length &&
      actual.every((value, index) => value === sortedExpected[index])
    );
  },

  cellsMatch: (observation: Observation, args) => {
    const record = argsRecord(args);
    const expected = record['cells'];
    const cells = observation['cells'];
    if (
      !Array.isArray(expected) ||
      cells === null ||
      typeof cells !== 'object' ||
      Array.isArray(cells)
    ) {
      return false;
    }
    const table = cells as Readonly<Record<string, JsonValue>>;
    return expected.every((item) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
      const r = item['r'];
      const c = item['c'];
      const value = item['value'];
      if (typeof r !== 'number' || typeof c !== 'number' || typeof value !== 'number') return false;
      return table[`${r},${c}`] === value;
    });
  },

  selectedAre: (observation: Observation, args) => {
    const expected = argsRecord(args)['cells'];
    const selected = observation['selected'];
    if (!Array.isArray(expected) || !Array.isArray(selected)) return false;
    const actual = new Set(selected.filter((item): item is string => typeof item === 'string'));
    return expected.every((item) => typeof item === 'string' && actual.has(item));
  },
};

/** 이 엔진은 다른 엔진 이벤트를 받지 않는다(E07 연결은 T046). */
export const EVENT_NAMES = ['partial-product-changed', 'value-changed'] as const;
