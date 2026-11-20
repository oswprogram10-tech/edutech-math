/**
 * roll-circle 측정 규칙(부동소수 없음). 원주율 근삿값은 Rational 상수이고,
 * 측정 원주는 지름 × 근삿값을 0.1cm(바닥 자 mm 눈금)로, 비는 `precision` 자리로 반올림한다(사사오입).
 */
import { Rational } from '../../../../core/math';

/** 원주율 근삿값(소수점 아래 14자리). */
export const PI_APPROX: Rational = Rational.parse('3.14159265358979');

function pow10(digits: number): bigint {
  return BigInt(10) ** BigInt(digits);
}

/** 0 이상 값을 소수점 아래 `digits`자리로 반올림한다(0.5는 올림). */
export function roundToDigits(value: Rational, digits: number): Rational {
  const scale = pow10(digits);
  const two = BigInt(2);
  const scaled = value.abs().n * scale;
  const rounded = (two * scaled + value.d) / (two * value.d);
  return Rational.of(rounded, scale);
}

/** 소수점 아래 `digits`자리를 모두 쓴 글("3.150", "6.3", "22.0"). 값은 그 자리의 배수여야 한다. */
export function formatFixed(value: Rational, digits: number): string {
  const scaled = (value.abs().n * pow10(digits)) / value.d;
  const padded = scaled.toString().padStart(digits + 1, '0');
  const integer = padded.slice(0, padded.length - digits);
  const fraction = padded.slice(padded.length - digits);
  return digits === 0 ? integer : `${integer}.${fraction}`;
}

/** 굴렁쇠를 한 바퀴 굴렸을 때 자에서 읽는 측정 원주(0.1cm 단위). */
export function measuredCircumference(diameter: Rational): Rational {
  return roundToDigits(diameter.mul(PI_APPROX), 1);
}

/** 측정 원주 ÷ 지름을 `digits`자리로 반올림한 값. */
export function ratioOf(circumference: Rational, diameter: Rational, digits: number): Rational {
  return roundToDigits(circumference.div(diameter), digits);
}
