/**
 * E04의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * `partial-product-changed`의 `parts`는 T046에서 E07이 같은 색으로 받는다
 * (색 순서는 `types.ts`의 `PARTIAL_PALETTE`).
 */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import { sameNumberSet } from './area';
import { observe } from './observe';
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

function rationalArg(args: Readonly<Record<string, JsonValue>>, key: string): Rational | null {
  const value = args[key];
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  try {
    return Rational.parse(String(value));
  } catch {
    return null;
  }
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

function factorsSignature(state: ArrayAreaState): string {
  const decimal = state.decimal;
  const fraction = state.fraction;
  if (state.mode === 'decimal-area' && decimal !== null) return `d:${decimal.a}:${decimal.b}`;
  if (state.mode === 'fraction-area' && fraction !== null) {
    return `f:${fraction.a.n}:${fraction.a.k}:${fraction.b.n}:${fraction.b.k}`;
  }
  return '';
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

  if (
    (next.mode === 'decimal-area' || next.mode === 'fraction-area') &&
    factorsSignature(prev) !== factorsSignature(next)
  ) {
    const observation = observe(next);
    events.push({
      name: 'area-changed',
      payload: {
        a: observation['a'] ?? null,
        b: observation['b'] ?? null,
        product: observation['product'] ?? null,
      },
    });
  }

  if (next.mode === 'tiling' && prev.tileSize !== next.tileSize) {
    const observation = observe(next);
    events.push({
      name: 'tile-changed',
      payload: {
        size: next.tileSize,
        fitsAll: observation['fitsAll'] ?? null,
      },
    });
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

  // ── T045 확장 ─────────────────────────────────────────────
  tileSizeIs: (observation: Observation, args) => {
    const value = numberArg(argsRecord(args), 'value');
    return value !== null && observation['tileSize'] === value;
  },

  fitsAll: (observation: Observation) => observation['fitsAll'] === true,

  recordedSizesAre: (observation: Observation, args) => {
    const expected = numberList(argsRecord(args)['values']);
    const actual = observation['recordedSizes'];
    if (!Array.isArray(actual)) return false;
    return sameNumberSet(
      actual.filter((item): item is number => typeof item === 'number'),
      expected,
    );
  },

  factorsFoundAre: (observation: Observation, args) => {
    const expected = numberList(argsRecord(args)['values']);
    const actual = observation['factorsFound'];
    if (!Array.isArray(actual)) return false;
    return sameNumberSet(
      actual.filter((item): item is number => typeof item === 'number'),
      expected,
    );
  },

  factorsAre: (observation: Observation, args) => {
    const record = argsRecord(args);
    const a = numberArg(record, 'a');
    const b = numberArg(record, 'b');
    const actual = observation['factorsFound'];
    if (a === null || b === null || !Array.isArray(actual)) return false;
    const found = new Set(actual.filter((item): item is number => typeof item === 'number'));
    if (record['either'] === true) return found.has(a) || found.has(b);
    return found.has(a) && found.has(b);
  },

  overlapCellsIs: (observation: Observation, args) => {
    const value = numberArg(argsRecord(args), 'value');
    return value !== null && observation['overlapCells'] === value;
  },

  productIs: (observation: Observation, args) => {
    const expected = rationalArg(argsRecord(args), 'value');
    const actual = observation['product'];
    if (expected === null || (typeof actual !== 'string' && typeof actual !== 'number')) {
      return false;
    }
    try {
      return Rational.parse(String(actual)).equals(expected);
    } catch {
      return false;
    }
  },

  predictionIs: (observation: Observation, args) => {
    const value = stringArg(argsRecord(args), 'value');
    return value !== null && observation['prediction'] === value;
  },

  multiplierIs: (observation: Observation, args) => {
    const expected = rationalArg(argsRecord(args), 'value');
    const actual = observation['multiplier'];
    if (expected === null || typeof actual !== 'string') return false;
    try {
      return Rational.parse(actual).equals(expected);
    } catch {
      return false;
    }
  },

  triedAllBelowOne: (observation: Observation, args) => {
    const count = numberArg(argsRecord(args), 'count');
    const tried = observation['tried'];
    if (count === null || !Array.isArray(tried)) return false;
    let below = 0;
    for (const item of tried) {
      if (typeof item !== 'string') continue;
      try {
        if (Rational.parse(item).compareTo(Rational.of(1)) < 0) below += 1;
      } catch {
        // 형식이 아닌 값은 세지 않는다.
      }
    }
    return below >= count;
  },

  puzzleAssembled: (observation: Observation) => observation['puzzleAssembled'] === true,

  assembledDimsAre: (observation: Observation, args) => {
    const record = argsRecord(args);
    const a = numberArg(record, 'a');
    const b = numberArg(record, 'b');
    const dims = observation['assembledDims'];
    if (a === null || b === null) return false;
    if (dims === null || typeof dims !== 'object' || Array.isArray(dims)) return false;
    const actualA = dims['a'];
    const actualB = dims['b'];
    if (actualA === a && actualB === b) return true;
    return record['either'] === true && actualA === b && actualB === a;
  },
};

/** 이 엔진은 다른 엔진 이벤트를 받지 않는다(E07 연결은 T046). */
export const EVENT_NAMES = [
  'partial-product-changed',
  'value-changed',
  'area-changed',
  'tile-changed',
] as const;
