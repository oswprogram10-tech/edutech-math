/**
 * 어림값 → 결과 비교 신호(순수 함수).
 *
 * 신호는 학생이 쓴 결과와 학생이 쓴 어림값의 차이로만 만든다.
 * 정답·기대값은 계산하지 않고 Observation에도 숫자 차이를 넣지 않는다.
 */
import { Rational } from '../../core/math';
import { computeGrid, readResult } from './grid';
import type { ColumnCalcState, EstimateSignal } from './types';

export function estimateDigits(state: ColumnCalcState): string | null {
  if (state.estimate === null) return null;
  const trimmed = state.estimate.trim();
  return /^\d{1,6}$/.test(trimmed) ? trimmed : null;
}

/** 어림값이 `roundTo`의 배수인가. 어림값이 없으면 null. */
export function estimateIsMultiple(state: ColumnCalcState): boolean | null {
  const digits = estimateDigits(state);
  if (digits === null) return null;
  return BigInt(digits) % BigInt(state.roundTo) === 0n;
}

/** 학생 결과와 어림값의 차이로 신호를 고른다. 결과가 완성되지 않았으면 null. */
export function estimateSignal(state: ColumnCalcState): EstimateSignal | null {
  if (state.mode !== 'estimate' || state.phase !== 'calc') return null;
  const estimate = estimateDigits(state);
  if (estimate === null) return null;
  // 결과 줄만 완성되면 신호를 낸다. 곱셈에서도 `sample`로 결과만 채운
  // 과제("다시 확인")가 바로 신호를 보여 줄 수 있어야 한다.
  const reading = readResult(state, computeGrid(state));
  if (!reading.complete || reading.value === null) return null;

  let result: Rational;
  let target: Rational;
  try {
    result = Rational.parse(reading.value);
    target = Rational.parse(estimate);
  } catch {
    return null;
  }
  const difference = result.sub(target).abs();
  const green = readTolerance(state.toleranceGreen);
  const yellow = readTolerance(state.toleranceYellow);
  if (green === null || yellow === null) return null;
  if (difference.compareTo(green) <= 0) return 'green';
  if (difference.compareTo(yellow) <= 0) return 'yellow';
  return 'red';
}

function readTolerance(text: string): Rational | null {
  try {
    const value = Rational.parse(text);
    return value.n < 0n ? null : value;
  } catch {
    return null;
  }
}
