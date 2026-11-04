/**
 * T049 `partition` variant=divide-whole: 분수 ÷ 자연수 → ×1/n.
 *
 * - 나뉨수를 세로 띠로 칠한 상태로 시작한다. 1보다 크면 정사각형을 여러 개 잇는다.
 * - "÷ n" 카드(`open-rows`)를 누르면 가로 칸 수(`rows`)를 1~divisor로 바꿀 수 있다.
 * - `keep-row`는 가로 줄 하나만 남긴 값, `keep-bundle`은 묶음 하나만 남긴 값이다.
 *   두 값 모두 `Rational`로 정확히 계산하고, 화면에는 쓰지 않는다(정답 노출 금지).
 */
import { Rational } from '../../core/math';
import { clamp } from '../../core/engine-sdk';
import { denominatorNumber, numeratorNumber, parseFraction, wholeUnits } from './fractions';
import { MAX_SQUARES } from './layout';
import { EMPTY_COUNTS, bumpCounts } from './types';
import type { DivideWholeState, FractionModelAction, FractionModelConfig } from './types';

const MAX_PARTS = 144;
const MIN_DIVISOR = 2;
const MAX_DIVISOR = 6;

export function createDivideWhole(config: FractionModelConfig): DivideWholeState {
  const dividend = parseFraction(config.fraction, '4/5');
  const safeDividend =
    dividend.isNegative() || dividend.isZero() ? parseFraction('4/5', '4/5') : dividend;
  const parts = clamp(denominatorNumber(safeDividend) ?? 1, 1, MAX_PARTS);
  const shaded = clamp(numeratorNumber(safeDividend) ?? 0, 0, parts * MAX_SQUARES);
  const rawDivisor =
    typeof config.divisor === 'string' ? Number(config.divisor) : (config.divisor ?? 3);
  const divisor = Number.isFinite(rawDivisor) ? rawDivisor : 3;
  return {
    mode: 'partition',
    variant: 'divide-whole',
    shape: config.shape ?? 'square',
    dividend: safeDividend.toString(),
    dividendParts: parts,
    dividendShaded: shaded,
    divisor: clamp(Math.trunc(divisor), MIN_DIVISOR, MAX_DIVISOR),
    rowsOpen: false,
    rows: 1,
    keptRow: null,
    bundleOpen: false,
    keptBundle: null,
    morphToMultiply: config.morphToMultiply ?? false,
    groupShortcut: config.groupShortcut ?? true,
    counters: EMPTY_COUNTS,
  };
}

export interface DivideWholeSummary {
  readonly dividend: Rational;
  readonly divisor: number;
  readonly rows: number;
  readonly keptRow: number | null;
  readonly keptBundle: number | null;
  /** 그려야 하는 정사각형 수(올림, 최대 4). */
  readonly squares: number;
  /** 묶음 하나에 들어가는 칠한 띠 수. 묶을 수 없으면 null. */
  readonly bundleSize: number | null;
  /** 지금 남긴 값. 아직 고르지 않았으면 null. */
  readonly kept: Rational | null;
  readonly canBundle: boolean;
  readonly bundled: boolean;
}

export function divideWholeSummary(state: DivideWholeState): DivideWholeSummary {
  const dividend = Rational.parse(state.dividend);
  const parts = Math.max(1, state.dividendParts);
  const shaded = Math.max(0, state.dividendShaded);
  const divisor = Math.max(1, state.divisor);
  const rows = Math.max(1, state.rows);
  const canBundle = state.groupShortcut && shaded > 0 && shaded % divisor === 0 && parts > 0;
  const bundleSize = canBundle ? shaded / divisor : null;
  let kept: Rational | null = null;
  if (state.keptBundle !== null && canBundle) {
    kept = Rational.of(shaded, parts * divisor);
  } else if (state.keptRow !== null && rows > 1) {
    kept = Rational.of(shaded, parts * rows);
  }
  return {
    dividend,
    divisor,
    rows,
    keptRow: state.keptRow,
    keptBundle: state.keptBundle,
    squares: clamp(Math.max(1, wholeUnits(dividend)), 1, MAX_SQUARES),
    bundleSize,
    kept,
    canBundle,
    bundled: state.bundleOpen,
  };
}

export function reduceDivideWhole(
  state: DivideWholeState,
  action: FractionModelAction,
): DivideWholeState {
  const divisor = Math.max(1, state.divisor);
  switch (action.type) {
    case 'open-rows':
      if (state.rowsOpen) return state;
      return { ...state, rowsOpen: true };
    case 'set-rows': {
      const rows = clamp(Math.trunc(action.rows), 1, divisor);
      if (rows === state.rows) return state;
      return {
        ...state,
        rows,
        rowsOpen: true,
        keptRow: null,
        keptBundle: null,
        bundleOpen: false,
        counters: bumpCounts(state.counters, 'partitioned'),
      };
    }
    case 'keep-row': {
      if (state.rows <= 1) return state;
      if (!Number.isInteger(action.row) || action.row < 0 || action.row >= state.rows) {
        return state;
      }
      if (state.keptRow === action.row && state.keptBundle === null) return state;
      return {
        ...state,
        keptRow: action.row,
        keptBundle: null,
        counters: bumpCounts(state.counters, 'valueChanged'),
      };
    }
    case 'bundle': {
      if (state.bundleOpen) return state;
      const summary = divideWholeSummary(state);
      if (!summary.canBundle) return state;
      return { ...state, bundleOpen: true, keptRow: null };
    }
    case 'keep-bundle': {
      const summary = divideWholeSummary(state);
      if (!summary.canBundle) return state;
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= divisor) {
        return state;
      }
      if (state.keptBundle === action.index && state.bundleOpen) return state;
      return {
        ...state,
        bundleOpen: true,
        keptRow: null,
        keptBundle: action.index,
        counters: bumpCounts(state.counters, 'valueChanged'),
      };
    }
    default:
      return state;
  }
}
