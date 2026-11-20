/** E13 측정값 도우미. 측정값은 Rational 문자열로 두고, 화면 좌표를 낼 때만 number로 바꾼다. */
import { Rational } from '../../core/math';

/** 문자열을 Rational로. 읽을 수 없으면 null. */
export function rat(text: unknown): Rational | null {
  if (typeof text !== 'string') return null;
  try {
    return Rational.parse(text);
  } catch {
    return null;
  }
}

/** 설정에서 온 값(문자열 또는 0.5 격자 숫자)을 Rational로. 0.5 격자가 아니면 null. */
export function ratFromConfig(value: unknown): Rational | null {
  if (typeof value === 'string') return rat(value);
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value * 2)) {
    return Rational.of(Math.round(value * 2), 2);
  }
  return null;
}

/** 화면 그림용 number. 측정 판정에는 쓰지 않는다. */
export function toNumber(value: Rational): number {
  return Number(value.n) / Number(value.d);
}

/** 문자열 Rational → 화면 그림용 number. 읽을 수 없으면 0. */
export function num(text: string): number {
  const value = rat(text);
  return value === null ? 0 : toNumber(value);
}

/** 화면에서 얻은 number를 0.5 격자 Rational로(가장 가까운 격자). */
export function halfGrid(value: number): Rational {
  return Rational.of(Math.round(value * 2), 2);
}

/** 정수 칸으로 둥글게 맞춘 Rational. */
export function wholeGrid(value: number): Rational {
  return Rational.of(Math.round(value));
}

export function isIntegerString(text: string): boolean {
  const value = rat(text);
  return value !== null && value.isInteger();
}
