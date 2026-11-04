/**
 * E03 double 모드(이중 수직선)의 대응·라벨·눈금 계산.
 *
 * 두 줄의 x 비율은 첫 anchor의 top/bottom 비로 고정한다. 그래서 대응선이 늘 수직이다.
 * 새 쌍의 기본 라벨은 값이 아니라 **만든 식**(`2/3 ÷ 2`, `1 ÷ 2 × 3`)이다(카드 6·10번).
 */
import { Rational } from '../../core/math/rational';
import { parseValue } from './ticks';
import type { DoubleLabelStyle, DoubleOpState, DoublePairState } from './types';

export interface DoubleAnchor {
  readonly top: Rational;
  readonly bottom: Rational;
}

export const ELEVEN_TENTHS = Rational.of(11, 10);

export function normalizeAnchors(
  values: readonly (readonly [number | string, number | string])[] | undefined,
): DoubleAnchor[] {
  const anchors: DoubleAnchor[] = [];
  for (const pair of values ?? []) {
    const top = parseValue(String(pair[0]));
    const bottom = parseValue(String(pair[1]));
    if (!top || !bottom) continue;
    anchors.push({ top, bottom });
  }
  if (anchors.length === 0) {
    return [{ top: Rational.of(1), bottom: Rational.of(1) }];
  }
  return anchors;
}

/** 첫 anchor의 아래/위 비. 아래 값 = 위 값 × ratio. */
export function doubleRatio(anchors: readonly DoubleAnchor[]): Rational {
  const first = anchors[0];
  if (!first || first.top.isZero()) return Rational.of(1);
  return first.bottom.div(first.top);
}

function gcd(a: bigint, b: bigint): bigint {
  let left = a < 0n ? -a : a;
  let right = b < 0n ? -b : b;
  while (right !== 0n) {
    const rest = left % right;
    left = right;
    right = rest;
  }
  return left;
}

function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 1n;
  return (a / gcd(a, b)) * b;
}

/** 두 줄에 함께 쓰는 눈금. 분모의 최소공배수로 1/n. 너무 잘면 1로 둔다. */
export function doubleTick(
  topMax: Rational,
  pairs: readonly { readonly top: Rational; readonly bottom: Rational }[],
): Rational {
  let denominator = topMax.d;
  for (const pair of pairs) {
    denominator = lcm(denominator, pair.top.d);
    denominator = lcm(denominator, pair.bottom.d);
  }
  if (denominator <= 0n || denominator > 120n) return Rational.of(1);
  return Rational.of(1, denominator);
}

/** 화면 구간 = max(top.max, 모든 쌍의 top) × 1.1. top 1이 3/4보다 커지는 문제를 담는다. */
export function doubleViewMax(topMax: Rational, tops: readonly Rational[]): Rational {
  let highest = topMax;
  for (const top of tops) {
    if (top.compareTo(highest) > 0) highest = top;
  }
  return highest.mul(ELEVEN_TENTHS);
}

export interface DoublePairText {
  readonly top: string;
  readonly bottom: string;
}

/** 쌍의 화면 라벨. 기본은 만든 식, `values`는 교사 시연용 값. */
export function pairTexts(
  pairs: readonly DoublePairState[],
  index: number,
  style: DoubleLabelStyle | undefined,
): DoublePairText {
  const pair = pairs[index];
  if (!pair) return { top: '', bottom: '' };
  if (style === 'values' || pair.from === null || pair.op === null) {
    return { top: pair.top, bottom: pair.bottom };
  }
  const parent = pairTexts(pairs, pair.from, style);
  const symbol = pair.op.kind === 'divide' ? '÷' : '×';
  return {
    top: `${parent.top} ${symbol} ${pair.op.factor}`,
    bottom: `${parent.bottom} ${symbol} ${pair.op.factor}`,
  };
}

/** 고른 쌍까지 누른 연산을 차례로. 합친 결과(× 3/2)는 만들지 않는다. */
export function pairOps(pairs: readonly DoublePairState[], index: number): DoubleOpState[] {
  const ops: DoubleOpState[] = [];
  let cursor = pairs[index];
  let guard = 0;
  while (cursor && cursor.op !== null && cursor.from !== null && guard < 64) {
    ops.unshift(cursor.op);
    cursor = pairs[cursor.from];
    guard += 1;
  }
  return ops;
}
