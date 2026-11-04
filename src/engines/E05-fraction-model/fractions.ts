/** E05의 분수 계산 보조. 값은 모두 Rational, 칸 수·묶음 수만 정수(number)다. */
import { Rational } from '../../core/math';
import type { FractionDisplay } from './types';

export function gcd(a: number, b: number): number {
  let left = Math.abs(Math.trunc(a));
  let right = Math.abs(Math.trunc(b));
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
}

export function lcm(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0;
  return (a / gcd(a, b)) * b;
}

export function isSafePositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function parseFraction(input: string | number | undefined, fallback: string): Rational {
  if (typeof input === 'number') {
    if (!Number.isSafeInteger(input)) return Rational.parse(fallback);
    return Rational.of(input);
  }
  if (input === undefined || input.trim() === '') return Rational.parse(fallback);
  try {
    return Rational.parse(input);
  } catch {
    return Rational.parse(fallback);
  }
}

export function parseRational(input: string | undefined): Rational | null {
  if (input === undefined || input.trim() === '') return null;
  try {
    return Rational.parse(input);
  } catch {
    return null;
  }
}

export function denominatorNumber(value: Rational): number | null {
  const denominator = Number(value.d);
  return Number.isSafeInteger(denominator) && denominator > 0 ? denominator : null;
}

/**
 * 설정에서 온 수를 Rational로 읽는다(T049 결정 2).
 * 문자열(`"2/3"`, `"1 1/2"`, `"4"`)과 안전한 정수 number를 받는다.
 * 읽을 수 없으면 fallback 문자열을 쓴다.
 */
export function parseAnyRational(input: string | number | undefined, fallback: string): Rational {
  return parseFraction(input, fallback);
}

/**
 * 값이 차지하는 전체의 수(올림). 0 이하는 0이다.
 * 화면에 정사각형을 몇 개 그릴지 정할 때만 쓴다(수학 값은 Rational).
 */
export function wholeUnits(value: Rational): number {
  if (value.isNegative() || value.isZero()) return 0;
  const mixed = value.toMixed();
  return Number(mixed.whole) + (Number(mixed.num) > 0 ? 1 : 0);
}

/** 화면 길이(논리 좌표)로 바꿀 때만 쓰는 number 근사. 수학 판정에는 쓰지 않는다. */
export function screenLength(value: Rational): number {
  return Number(value.n) / Number(value.d);
}

export function numeratorNumber(value: Rational): number | null {
  const numerator = Number(value.n);
  return Number.isSafeInteger(numerator) ? numerator : null;
}

export function fractionDisplay(shaded: number, parts: number): FractionDisplay {
  if (parts <= 0) return { raw: '0/1', reduced: '0' };
  const safeShaded = Math.max(0, Math.min(parts, Math.trunc(shaded)));
  return {
    raw: `${safeShaded}/${parts}`,
    reduced: Rational.of(safeShaded, parts).toString(),
  };
}

export function valueOf(shaded: number, parts: number): Rational {
  if (parts <= 0) return Rational.of(0);
  return Rational.of(Math.max(0, Math.min(parts, Math.trunc(shaded))), parts);
}

/** 두 분모의 최소공배수(공통 격자의 최소값). */
export function commonGridOf(a: Rational, b: Rational): number | null {
  const da = denominatorNumber(a);
  const db = denominatorNumber(b);
  if (da === null || db === null) return null;
  return lcm(da, db);
}

/** 두 분모의 곱(타일을 그대로 겹쳤을 때의 격자). */
export function productGridOf(a: Rational, b: Rational): number | null {
  const da = denominatorNumber(a);
  const db = denominatorNumber(b);
  if (da === null || db === null) return null;
  const product = da * db;
  return Number.isSafeInteger(product) && product > 0 ? product : null;
}

/** 공통 격자에서 분수가 차지하는 칸 수. 격자가 분모의 배수가 아니면 null. */
export function cellsAt(value: Rational, grid: number): number | null {
  const denominator = denominatorNumber(value);
  const numerator = numeratorNumber(value);
  if (denominator === null || numerator === null || grid <= 0 || grid % denominator !== 0) {
    return null;
  }
  const cells = numerator * (grid / denominator);
  return Number.isSafeInteger(cells) ? cells : null;
}

/** 대분수 표기. 예: 11/4 → "2 3/4", 3/4 → "3/4", 2 → "2". */
export function mixedLabel(value: Rational): string {
  const mixed = value.toMixed();
  const whole = Number(mixed.whole);
  const numerator = Number(mixed.num);
  const denominator = Number(mixed.den);
  if (numerator === 0) return String(whole);
  if (whole === 0) return `${numerator}/${denominator}`;
  return `${whole} ${numerator}/${denominator}`;
}

export function decimalLabel(value: Rational): string | null {
  if (!value.isTerminatingDecimal()) return null;
  return value.toDecimalString();
}

export function sortNumbers(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

export function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}
