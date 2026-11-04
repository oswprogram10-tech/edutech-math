/**
 * T049 `multiply`: 두 분수 넓이의 겹침.
 *
 * - `a`는 세로 칸, `b`는 가로 칸이다. `a`는 1보다 클 수 있어 정사각형을 여러 개 잇는다.
 * - `aShaded`는 여러 전체에 걸쳐 센 칸 수다(예: 1 1/2 → aParts 2, aShaded 3).
 * - 칸 수는 정수, 값은 `Rational`이다. 곱은 칸 수의 비로 정확히 계산한다.
 * - 곱(예: 1/2)은 Observation에만 두고 화면에는 쓰지 않는다.
 */
import { Rational } from '../../core/math';
import { clamp } from '../../core/engine-sdk';
import { denominatorNumber, numeratorNumber, parseAnyRational } from './fractions';
import { MAX_SQUARES } from './layout';
import { EMPTY_COUNTS, bumpCounts } from './types';
import type { FractionModelAction, FractionModelConfig, LayoutSide, MultiplyState } from './types';

/** 한 전체를 나눌 수 있는 최대 칸 수. 화면 격자가 읽히는 한도다. */
const MAX_PARTS = 40;
const DEFAULT_MAX_DENOMINATOR = 12;

function sideOf(value: LayoutSide | undefined, fallback: LayoutSide): LayoutSide {
  return value ?? fallback;
}

function partsWithin(denominator: number | null, fallback: number): number {
  if (denominator === null || denominator < 1 || denominator > MAX_PARTS) return fallback;
  return denominator;
}

/** `a`가 칠할 수 있는 최대 칸 수(전체 4개까지). */
export function maxShaded(parts: number): number {
  return Math.max(1, Math.min(MAX_PARTS, Math.trunc(parts))) * MAX_SQUARES;
}

export function createMultiply(config: FractionModelConfig): MultiplyState {
  const a = parseAnyRational(config.a, '1/2');
  const b = parseAnyRational(config.b, '1/2');
  const aParts = partsWithin(denominatorNumber(a), 2);
  const bParts = partsWithin(denominatorNumber(b), 2);
  const configuredMax = Math.trunc(config.maxDenominator ?? DEFAULT_MAX_DENOMINATOR);
  const maxDenominator = clamp(Math.max(configuredMax, aParts, bParts), 1, MAX_PARTS);
  const preset = (config.build ?? 'student') === 'preset';
  const aShaded = preset ? clamp(numeratorNumber(a) ?? 0, 0, maxShaded(aParts)) : 0;
  const bShaded = preset ? clamp(numeratorNumber(b) ?? 0, 0, bParts) : 0;
  return {
    mode: 'multiply',
    aParts,
    aShaded,
    bParts,
    bShaded,
    layout: {
      a: sideOf(config.layout?.a, 'vertical'),
      b: sideOf(config.layout?.b, 'horizontal'),
    },
    maxDenominator,
    counters: EMPTY_COUNTS,
  };
}

export function reduceMultiply(state: MultiplyState, action: FractionModelAction): MultiplyState {
  switch (action.type) {
    case 'set-parts': {
      const parts = clamp(Math.trunc(action.parts), 1, state.maxDenominator);
      if (action.side === 'a') {
        if (parts === state.aParts) return state;
        return {
          ...state,
          aParts: parts,
          aShaded: clamp(state.aShaded, 0, maxShaded(parts)),
          counters: bumpCounts(state.counters, 'valueChanged'),
        };
      }
      if (parts === state.bParts) return state;
      return {
        ...state,
        bParts: parts,
        bShaded: clamp(state.bShaded, 0, parts),
        counters: bumpCounts(state.counters, 'valueChanged'),
      };
    }
    case 'set-shaded': {
      if (!Number.isFinite(action.count)) return state;
      const wanted = Math.trunc(action.count);
      if (action.side === 'a') {
        const next = clamp(wanted, 0, maxShaded(state.aParts));
        if (next === state.aShaded) return state;
        return {
          ...state,
          aShaded: next,
          counters: bumpCounts(bumpCounts(state.counters, 'shaded'), 'valueChanged'),
        };
      }
      const next = clamp(wanted, 0, state.bParts);
      if (next === state.bShaded) return state;
      return {
        ...state,
        bShaded: next,
        counters: bumpCounts(bumpCounts(state.counters, 'shaded'), 'valueChanged'),
      };
    }
    default:
      return state;
  }
}

export interface MultiplySummary {
  readonly a: Rational;
  readonly b: Rational;
  readonly aParts: number;
  readonly bParts: number;
  readonly aShaded: number;
  readonly bShaded: number;
  /** 그려야 하는 정사각형 수. */
  readonly squares: number;
  /** 그려진 전체 칸 수(정사각형 수 × 칸). */
  readonly totalCells: number;
  /** 두 색이 겹친 칸 수. */
  readonly overlapCells: number;
  /** 겹친 칸 / 한 전체의 칸 = a×b. */
  readonly product: Rational;
}

export function multiplySummary(state: MultiplyState): MultiplySummary {
  const aParts = Math.max(1, state.aParts);
  const bParts = Math.max(1, state.bParts);
  const squares = Math.max(1, Math.min(MAX_SQUARES, Math.ceil(state.aShaded / aParts)));
  const overlapCells = state.aShaded * state.bShaded;
  return {
    a: Rational.of(state.aShaded, aParts),
    b: Rational.of(state.bShaded, bParts),
    aParts,
    bParts,
    aShaded: state.aShaded,
    bShaded: state.bShaded,
    squares,
    totalCells: squares * aParts * bParts,
    overlapCells,
    product: Rational.of(overlapCells, aParts * bParts),
  };
}

/** View가 칸 하나하나를 그릴 때 쓰는 값. 색이 아니라 무늬로 구분한다. */
export function cellState(
  state: MultiplyState,
  square: number,
  column: number,
  row: number,
): { readonly inA: boolean; readonly inB: boolean } {
  const globalColumn = square * state.aParts + column;
  return { inA: globalColumn < state.aShaded, inB: row < state.bShaded };
}
