/**
 * 소수 곱셈 오류 분류(순수 함수).
 *
 * 순서대로 검사하고 모든 일치를 기록한다(T077 결정 8).
 * ① 소수점끼리 맞춘 정렬 ② 숫자 칸 오류 ③ 결과 소수점 위치.
 * 기대 소수점 위치(정답)는 코드로만 쓰고 화면·Observation에 숫자로 내보내지 않는다.
 */
import type { ColumnError, MisconceptionCode } from './classify';
import { classifyMul } from './classify-mul';
import { isDecimalMul } from './grid';
import { decimalResultDigits, decimalOperands, readDecimalResult } from './grid-decimal';
import { computeMulPlan, normalizeDigits } from './grid-mul';
import type { MulPlan } from './grid-mul';
import type { ColumnCalcState } from './types';

/** 소수 곱셈에서 지금까지 맞는 오류 코드(순서 유지). */
export function classifyDecimalMul(
  state: ColumnCalcState,
  plan: MulPlan | null = computeMulPlan(state),
): ColumnError[] {
  if (!isDecimalMul(state)) return [];
  const errors: ColumnError[] = [];

  // ① 두 소수점을 맞춰 놓았다.
  if (state.aPoint !== null && state.bPoint !== null && state.aPoint === state.bPoint) {
    const operands = decimalOperands(state);
    const differentFrac = operands !== null && operands.a.fracDigits !== operands.b.fracDigits;
    if (differentFrac) {
      errors.push({ column: state.aPoint, code: 'MC-DEC-MULT-ALIGN-POINT' });
    }
  }

  // ② 숫자 칸 오류는 기존 곱셈 분류를 숫자열 격자에 그대로 돌린다.
  if (plan) {
    const mulError = classifyMul(state, plan);
    if (mulError) errors.push(mulError);
  }

  // ③ 결과 숫자는 맞는데 소수점만 다른 자리에 놓았다.
  const operands = decimalOperands(state);
  const reading = readDecimalResult(state);
  const digits = decimalResultDigits(state);
  if (operands && reading.complete && digits !== null) {
    const aDigits = normalizeDigits(operands.a.digits);
    const bDigits = normalizeDigits(operands.b.digits);
    const expectedDigits = (BigInt(aDigits) * BigInt(bDigits)).toString();
    const point = state.resultPoint ?? 0;
    if (BigInt(digits) === BigInt(expectedDigits)) {
      if (point !== operands.a.fracDigits + operands.b.fracDigits) {
        errors.push({ column: point, code: 'MC-DEC-POINT-PLACEMENT' });
      }
    }
  }

  return errors;
}

export type { MisconceptionCode };
