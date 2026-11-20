/**
 * proportion 읽기(순수 함수): 두 접시의 격자(가로·세로 칸)와 넓이, 기울기.
 * 왼쪽 = pairSelect가 아니면 외항 a×d, pairSelect이면 고른 두 항의 곱. 오른쪽 = 나머지 두 항의 곱.
 * □ 값을 모르면 그 격자와 기울기는 알 수 없다('unknown').
 */
import { Rational } from '../../../core/math';
import type { BalanceTilt } from '../types';
import type { ProportionState } from './types';

export const MC_RATIO_ADDITIVE = 'MC-RATIO-ADDITIVE';
export const MC_CROSS_WRONG = 'MC-PROPORTION-CROSS-WRONG';

export interface GridDims {
  readonly w: Rational | null;
  readonly h: Rational | null;
}

export interface ProportionReading {
  /** 저울에 올릴 것이 정해졌는가(카드를 골랐고, pairSelect면 두 항도 골랐다). */
  readonly placed: boolean;
  readonly leftDims: GridDims;
  readonly rightDims: GridDims;
  readonly left: Rational | null;
  readonly right: Rational | null;
  readonly balanced: boolean;
  readonly tilt: BalanceTilt;
}

const NONE: GridDims = { w: null, h: null };

export function areaOf(dims: GridDims): Rational | null {
  return dims.w === null || dims.h === null ? null : dims.w.mul(dims.h);
}

/** 네 항의 값. □ 자리에는 `tryValue`를 넣는다(없으면 null). */
export function termValues(state: ProportionState, tryValue: string | null): (Rational | null)[] {
  return state.terms.map((term) => {
    const text = term === null ? tryValue : term;
    return text === null ? null : Rational.parse(text);
  });
}

/** 오른쪽 접시에 올라가는 나머지 두 항의 번호(작은 번호가 가로). */
export function restOf(pair: readonly [number, number]): [number, number] {
  const rest = [0, 1, 2, 3].filter((index) => index !== pair[0] && index !== pair[1]);
  return [rest[0] ?? 0, rest[1] ?? 0];
}

export function readProportionWith(
  state: ProportionState,
  tryValue: string | null,
): ProportionReading {
  const empty: ProportionReading = {
    placed: false,
    leftDims: NONE,
    rightDims: NONE,
    left: null,
    right: null,
    balanced: false,
    tilt: 'unknown',
  };
  if (state.terms.length !== 4) return empty;
  const values = termValues(state, tryValue);
  let leftIndex: [number, number] = [0, 3];
  let rightIndex: [number, number] = [1, 2];
  if (state.settings.pairSelect) {
    if (state.pair === null) return empty;
    leftIndex = [state.pair[0], state.pair[1]];
    rightIndex = restOf(state.pair);
  }
  const leftDims: GridDims = { w: values[leftIndex[0]] ?? null, h: values[leftIndex[1]] ?? null };
  const rightDims: GridDims = {
    w: values[rightIndex[0]] ?? null,
    h: values[rightIndex[1]] ?? null,
  };
  const left = areaOf(leftDims);
  const right = areaOf(rightDims);
  if (left === null || right === null) {
    return { placed: true, leftDims, rightDims, left, right, balanced: false, tilt: 'unknown' };
  }
  const order = left.compareTo(right);
  const tilt: BalanceTilt = order > 0 ? 'left' : order < 0 ? 'right' : 'level';
  return { placed: true, leftDims, rightDims, left, right, balanced: order === 0, tilt };
}

export function readProportion(state: ProportionState): ProportionReading {
  return readProportionWith(state, state.tryValue);
}

/** 네 항이 모두 정해졌을 때 외항의 곱 = 내항의 곱인가. 모르면 null. */
export function isProportionOf(values: readonly (Rational | null)[]): boolean | null {
  const [a, b, c, d] = values;
  if (a == null || b == null || c == null || d == null) return null;
  return a.mul(d).equals(b.mul(c));
}

/** □ 자리에서 '차를 보존한' 값(가법 오개념). □가 없으면 null. */
export function additiveValue(state: ProportionState): Rational | null {
  if (state.boxIndex === null || state.terms.length !== 4) return null;
  const [a, b, c, d] = state.terms.map((term) => (term === null ? null : Rational.parse(term)));
  switch (state.boxIndex) {
    case 0:
      return b != null && c != null && d != null ? c.sub(d.sub(b)) : null;
    case 1:
      return a != null && c != null && d != null ? d.sub(c.sub(a)) : null;
    case 2:
      return a != null && b != null && d != null ? a.add(d.sub(b)) : null;
    case 3:
      return a != null && b != null && c != null ? b.add(c.sub(a)) : null;
    default:
      return null;
  }
}

/** 넣어 본 값 가운데 '차 보존' 값과 같고 비례식이 안 되는 것이 있는가(MC-RATIO-ADDITIVE). */
export function additiveTried(state: ProportionState): boolean {
  const target = additiveValue(state);
  if (target === null) return false;
  return state.tries.some((tried) => {
    if (!Rational.parse(tried).equals(target)) return false;
    return isProportionOf(termValues(state, tried)) === false;
  });
}

/** pairSelect에서 고른 짝이 외항 짝({0,3}) 또는 내항 짝({1,2})인가. */
export function pairingOf(state: ProportionState): 'extremes-means' | 'other' | null {
  if (state.pair === null) return null;
  const low = Math.min(state.pair[0], state.pair[1]);
  const high = Math.max(state.pair[0], state.pair[1]);
  return (low === 0 && high === 3) || (low === 1 && high === 2) ? 'extremes-means' : 'other';
}
