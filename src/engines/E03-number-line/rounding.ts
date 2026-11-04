/**
 * E03 rounding 모드의 눈금·어림 계산. 모두 `Rational`과 BigInt만 쓴다.
 *
 * 큰 눈금 = `place`, 작은 눈금 = `place / 10`이다(카드 4번).
 * 올림·버림·반올림은 ticks의 floorRational·ceilRational·roundRational을 쓴다.
 */
import { Rational } from '../../core/math/rational';
import { ceilRational, floorRational, roundRational } from './ticks';
import type { RoundingMethod } from './types';

export function roundValue(value: Rational, place: Rational, method: RoundingMethod): Rational {
  const units = value.div(place);
  const count =
    method === 'up'
      ? ceilRational(units)
      : method === 'down'
        ? floorRational(units)
        : roundRational(units);
  return place.mul(Rational.of(count));
}

/** 값마다 가장 가까운 아래·위 큰 눈금. */
export function roundingEdges(
  value: Rational,
  place: Rational,
): { readonly lower: Rational; readonly upper: Rational } {
  const lower = place.mul(Rational.of(floorRational(value.div(place))));
  return { lower, upper: lower.add(place) };
}

/** 화면 구간: 모든 값의 [아래 큰 눈금 - place, 위 큰 눈금 + place]. */
export function roundingBounds(
  values: readonly Rational[],
  place: Rational,
): { readonly min: Rational; readonly max: Rational } {
  if (values.length === 0) {
    return { min: place.neg(), max: place.add(place) };
  }
  let low: Rational | null = null;
  let high: Rational | null = null;
  for (const value of values) {
    const edges = roundingEdges(value, place);
    const min = edges.lower.sub(place);
    const max = edges.upper.add(place);
    if (low === null || min.compareTo(low) < 0) low = min;
    if (high === null || max.compareTo(high) > 0) high = max;
  }
  return { min: low ?? place.neg(), max: high ?? place };
}

/** 큰 눈금 위의 값인가. */
export function isBigTick(value: Rational, place: Rational): boolean {
  if (place.isZero() || place.isNegative()) return false;
  return value.div(place).isInteger();
}

/** 큰 눈금에 맞춘 가장 가까운 값(정중앙은 큰 쪽). */
export function snapToBigTick(value: Rational, place: Rational): Rational {
  return place.mul(Rational.of(roundRational(value.div(place))));
}

/** 소수로 쓸 수 있으면 소수로, 아니면 분수로. 눈금 라벨용. */
export function formatNumber(value: Rational): string {
  try {
    return value.toDecimalString();
  } catch {
    return value.toString();
  }
}
