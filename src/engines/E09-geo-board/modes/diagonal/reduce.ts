/** diagonal 모드의 순수 reducer(T103). 대각선은 꼭짓점 번호 쌍(정수)으로만 다룬다. */
import type { GeoAction } from '../../types';
import type { DiagonalConfig, DiagonalPair, DiagonalSettings, DiagonalState } from './types';

export const DEFAULT_DIAGONAL_POLYGONS: readonly number[] = [3, 4, 5, 6];
export const MIN_DIAGONAL_VERTICES = 3;
export const MAX_DIAGONAL_VERTICES = 10;

function polygonList(config: DiagonalConfig): number[] {
  const raw = Array.isArray(config.polygons) ? config.polygons : DEFAULT_DIAGONAL_POLYGONS;
  const result: number[] = [];
  for (const item of raw) {
    if (typeof item !== 'number' || !Number.isFinite(item)) continue;
    const n = Math.round(item);
    if (n < MIN_DIAGONAL_VERTICES || n > MAX_DIAGONAL_VERTICES) continue;
    if (result.includes(n)) continue;
    result.push(n);
  }
  return result.length > 0 ? result : [...DEFAULT_DIAGONAL_POLYGONS];
}

export function diagonalSettings(config: DiagonalConfig): DiagonalSettings {
  return {
    polygons: polygonList(config),
    rejectAdjacent: config.rejectAdjacent !== false,
    countTable: config.countTable === true,
  };
}

export function createDiagonalState(config: DiagonalConfig): DiagonalState {
  return {
    mode: 'diagonal',
    current: 0,
    pending: null,
    drawn: {},
    sides: {},
    adjacentAttempts: 0,
    duplicateAttempts: 0,
    lastRejected: null,
    settings: diagonalSettings(config),
  };
}

export function polygonKey(n: number): string {
  return String(n);
}

/** `[작은 번호, 큰 번호]`로 정규화한다. */
export function normalizePair(a: number, b: number): DiagonalPair {
  return a <= b ? [a, b] : [b, a];
}

export function samePair(a: DiagonalPair, b: DiagonalPair): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** 이웃한 꼭짓점인지 정수로 판정한다. `d === 1 || d === n − 1`. */
export function isAdjacentPair(n: number, pair: DiagonalPair): boolean {
  const distance = Math.abs(pair[0] - pair[1]);
  return distance === 1 || distance === n - 1;
}

/** 정n각형의 전체 대각선 수. Observation에만 쓴다. */
export function diagonalTotal(n: number): number {
  return n < 3 ? 0 : (n * (n - 3)) / 2;
}

export function currentPolygon(state: DiagonalState): number {
  return state.settings.polygons[state.current] ?? MIN_DIAGONAL_VERTICES;
}

export function drawnPairs(state: DiagonalState, n: number): readonly DiagonalPair[] {
  return state.drawn[polygonKey(n)] ?? [];
}

export function sidePairs(state: DiagonalState, n: number): readonly DiagonalPair[] {
  return state.sides[polygonKey(n)] ?? [];
}

export function diagonalCountOf(state: DiagonalState, n: number): number {
  return drawnPairs(state, n).length;
}

function reduced(state: DiagonalState, patch: Partial<DiagonalState>): DiagonalState {
  return { ...state, ...patch };
}

function pushPair(
  record: Readonly<Record<string, readonly DiagonalPair[]>>,
  key: string,
  pair: DiagonalPair,
): Readonly<Record<string, readonly DiagonalPair[]>> {
  return { ...record, [key]: [...(record[key] ?? []), pair] };
}

export function reduceDiagonal(state: DiagonalState, action: GeoAction): DiagonalState {
  switch (action.type) {
    case 'select-polygon': {
      const { index } = action;
      if (!Number.isInteger(index) || index < 0 || index >= state.settings.polygons.length) {
        return state;
      }
      if (index === state.current && state.pending === null && state.lastRejected === null) {
        return state;
      }
      return reduced(state, { current: index, pending: null, lastRejected: null });
    }

    case 'pick-vertex': {
      const { vertex } = action;
      const n = currentPolygon(state);
      if (!Number.isInteger(vertex) || vertex < 0 || vertex >= n) return state;
      if (state.pending === null) {
        return reduced(state, { pending: vertex, lastRejected: null });
      }
      if (state.pending === vertex) return reduced(state, { pending: null });

      const key = polygonKey(n);
      const pair = normalizePair(state.pending, vertex);
      const rejectAdjacent = state.settings.rejectAdjacent;

      if (isAdjacentPair(n, pair)) {
        if (rejectAdjacent) {
          return reduced(state, {
            pending: null,
            adjacentAttempts: state.adjacentAttempts + 1,
            lastRejected: { n, pair, reason: 'adjacent' },
          });
        }
        const sides = sidePairs(state, n);
        if (sides.some((candidate) => samePair(candidate, pair))) {
          return reduced(state, {
            pending: null,
            duplicateAttempts: state.duplicateAttempts + 1,
            lastRejected: { n, pair, reason: 'duplicate' },
          });
        }
        return reduced(state, {
          pending: null,
          sides: pushPair(state.sides, key, pair),
          lastRejected: null,
        });
      }

      const drawn = drawnPairs(state, n);
      if (drawn.some((candidate) => samePair(candidate, pair))) {
        return reduced(state, {
          pending: null,
          duplicateAttempts: state.duplicateAttempts + 1,
          lastRejected: { n, pair, reason: 'duplicate' },
        });
      }
      return reduced(state, {
        pending: null,
        drawn: pushPair(state.drawn, key, pair),
        lastRejected: null,
      });
    }

    case 'undo-diagonal': {
      const n = currentPolygon(state);
      const key = polygonKey(n);
      const drawn = drawnPairs(state, n);
      if (drawn.length === 0) return state;
      return reduced(state, {
        drawn: { ...state.drawn, [key]: drawn.slice(0, -1) },
        pending: null,
        lastRejected: null,
      });
    }

    case 'clear-diagonals': {
      const n = currentPolygon(state);
      const key = polygonKey(n);
      if (drawnPairs(state, n).length === 0 && state.pending === null) return state;
      return reduced(state, {
        drawn: { ...state.drawn, [key]: [] },
        pending: null,
        lastRejected: null,
      });
    }

    default:
      return state;
  }
}
