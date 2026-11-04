/**
 * 나눗셈 오류 분류(순수 함수).
 *
 * 학생이 쓴 값과 문제의 수만으로 판정한다. 정답 몫은 (a) 몫의 0 누락을
 * 알아보는 데만 쓰고 화면·Observation에 내보내지 않는다.
 * 순서대로 검사하고 코드마다 한 번만 기록한다(T047 결정 13).
 */
import type { ColumnError, MisconceptionCode } from './classify';
import { divWrongColumns, pow10Big, readDiffResultValue, readRowValue } from './grid-div';
import type { DivPlan, DivStepPlan } from './grid-div';
import type { ColumnCalcState } from './types';

const ZERO = 0n;

/**
 * 정답 몫 표기에서 0을 하나 이상 뺀 값들.
 * 맨 앞 0은 빼지 않는다(값이 달라지지 않으므로 오개념이 아니다).
 * `20` → `2`, `102` → `12`처럼 끝·가운데 0을 모두 본다.
 */
function zeroRemovedCandidates(text: string): Set<string> {
  const digits = text.replace(/\D/g, '');
  const removable: number[] = [];
  let sawNonZero = false;
  for (let index = 0; index < digits.length; index += 1) {
    const char = digits.charAt(index);
    if (char === '0' && sawNonZero) removable.push(index);
    if (char !== '0') sawNonZero = true;
  }
  const results = new Set<string>();
  if (removable.length === 0 || removable.length > 10) return results;
  const total = 1 << removable.length;
  for (let mask = 1; mask < total; mask += 1) {
    const kept: string[] = [];
    for (let index = 0; index < digits.length; index += 1) {
      const bit = removable.indexOf(index);
      if (bit >= 0 && (mask & (1 << bit)) !== 0) continue;
      kept.push(digits.charAt(index));
    }
    const candidate = kept.join('').replace(/^0+(?=\d)/, '');
    if (candidate.length > 0) results.add(candidate);
  }
  return results;
}

function digitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}

/** 내림 숫자만으로 만든 값(내림 칸이 하나도 없으면 null). */
function bringOnlyValue(step: DivStepPlan): bigint | null {
  if (step.bringColumns.length === 0) return null;
  let value = ZERO;
  for (const column of step.bringColumns) {
    value = value * 10n + BigInt(step.expectedBring[String(column)] ?? '0');
  }
  return value;
}

function studentRowValue(state: ColumnCalcState, step: DivStepPlan): bigint | null {
  return readRowValue(state.divDiffs[String(step.column)], step.rowColumns);
}

function bringHasBlank(state: ColumnCalcState, step: DivStepPlan): boolean {
  const record = state.divDiffs[String(step.column)];
  return step.bringColumns.some((column) => record?.[String(column)] === undefined);
}

function quotientZeroColumn(state: ColumnCalcState, plan: DivPlan): number | null {
  const highest = plan.reading.quotientHighest;
  if (highest === null) return null;
  for (let column = highest - 1; column >= 0; column -= 1) {
    if (state.quotient[String(column)] === undefined) return column;
  }
  return highest;
}

export function classifyDiv(state: ColumnCalcState, plan: DivPlan): ColumnError[] {
  const errors: ColumnError[] = [];
  const used = new Set<MisconceptionCode>();

  function add(code: MisconceptionCode, column: number): void {
    if (used.has(code)) return;
    used.add(code);
    errors.push({ column, code });
  }

  const dividend = plan.reading.dividend;
  const divisor = plan.reading.divisor;

  // ① 몫의 0 누락.
  if (divisor > ZERO) {
    const correctText = (dividend / divisor).toString();
    const studentText = plan.reading.quotientText;
    if (
      studentText !== null &&
      studentText !== correctText &&
      zeroRemovedCandidates(correctText).has(digitsOnly(studentText))
    ) {
      add('MC-DIV-QUOTIENT-ZERO', quotientZeroColumn(state, plan) ?? plan.reading.top);
    } else if (plan.reading.skippedZero) {
      add('MC-DIV-QUOTIENT-ZERO', quotientZeroColumn(state, plan) ?? plan.reading.top);
    }
  }

  // ② 나머지가 나누는 수 이상.
  for (const step of plan.steps) {
    const value = readDiffResultValue(state.divDiffs[String(step.column)], step.diffColumns);
    if (value !== null && divisor > ZERO && value >= divisor) {
      add('MC-DIV-REMAINDER-TOO-BIG', step.column);
      break;
    }
  }

  // ③ 내림 누락.
  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index] as DivStepPlan;
    if (step.diff !== ZERO) {
      const bring = bringOnlyValue(step);
      const row = studentRowValue(state, step);
      if (bring !== null && row !== null && row === bring) {
        add('MC-DIV-BRING-DOWN', step.column);
        break;
      }
    }
    if (index + 1 < plan.steps.length && bringHasBlank(state, step)) {
      add('MC-DIV-BRING-DOWN', step.column);
      break;
    }
  }

  // ④ 몫 어림 틀림: 곱이 부분 피제수보다 크거나, 뺀 결과가 나누는 수 이상.
  for (const step of plan.steps) {
    if (step.product > step.partial) {
      add('MC-DIV-ESTIMATE-OFF', step.column);
      break;
    }
    const value = readDiffResultValue(state.divDiffs[String(step.column)], step.diffColumns);
    if (value !== null && divisor > ZERO && value >= divisor) {
      add('MC-DIV-ESTIMATE-OFF', step.column);
      break;
    }
  }

  // ⑤ 위 넷에 해당하지 않는 틀린 칸.
  const covered = new Set(errors.map((error) => error.column));
  for (const column of divWrongColumns(state, plan)) {
    if (covered.has(column)) continue;
    add('unknown', column);
  }

  return errors;
}

/** 정답 몫을 알려 주지 않고 0을 뺀 후보만 확인하는 테스트용 도우미. */
export function quotientZeroCandidates(expected: bigint): Set<string> {
  return zeroRemovedCandidates(expected.toString());
}

/** `10^exponent`(테스트에서 기대값을 만들 때 쓴다). */
export { pow10Big };
