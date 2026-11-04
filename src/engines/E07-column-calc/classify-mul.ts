/**
 * 곱셈 오류 분류(순수 함수).
 *
 * 판정은 학생이 쓴 줄 값과 기대값의 비교로만 한다. 순서대로 검사해
 * 첫 일치만 돌려준다(T046 결정 4).
 */
import type { ColumnError, MisconceptionCode } from './classify';
import { computeMulPlan, readRowValue, readSumValue } from './grid-mul';
import type { MulPlan, MulRowPlan } from './grid-mul';
import type { ColumnCalcState } from './types';

function big(text: string | null): bigint | null {
  if (text === null || !/^\d+$/.test(text)) return null;
  return BigInt(text);
}

function digitAt(text: string, column: number): number {
  const index = text.length - 1 - column;
  if (index < 0 || index >= text.length) return 0;
  return Number(text[index] ?? '0');
}

function shiftOf(row: MulRowPlan): bigint {
  return 10n ** BigInt(row.shift);
}

/** 둘째 줄부터 자리 밀기를 하지 않아 값이 1/10^k로 작아진 경우. */
function shiftedAway(state: ColumnCalcState, plan: MulPlan): ColumnError | null {
  for (const row of plan.rows) {
    if (row.index === 0 || row.shift === 0) continue;
    const value = big(readRowValue(state, row));
    if (value === null) continue;
    if (value === row.shiftedValue) continue;
    const unshifted = row.shiftedValue / shiftOf(row);
    if (value === unshifted) return { column: row.end, code: 'MC-MUL-PARTIAL-SHIFT' };
  }
  return null;
}

/** 합 줄이 부분곱 하나만 더한 값(또는 하나를 뺀 값)인 경우. */
function missingPartial(state: ColumnCalcState, plan: MulPlan): ColumnError | null {
  if (plan.rows.length < 2) return null;
  const sum = big(readSumValue(state, plan));
  if (sum === null) return null;
  for (const row of plan.rows) {
    if (sum === row.shiftedValue) {
      return { column: plan.productDigits.length - 1, code: 'MC-MUL-PARTIAL-MISSING' };
    }
    const rest: bigint = plan.product - row.shiftedValue;
    if (rest >= 0n && sum === rest) {
      return { column: plan.productDigits.length - 1, code: 'MC-MUL-PARTIAL-MISSING' };
    }
  }
  return null;
}

interface CellMismatch {
  readonly row: MulRowPlan;
  readonly column: number;
  readonly student: number;
  readonly expected: number;
  readonly aDigit: number;
  readonly factor: number;
  readonly carryIn: number;
}

function rowMismatches(state: ColumnCalcState, plan: MulPlan): CellMismatch[] {
  const mismatches: CellMismatch[] = [];
  for (const row of plan.rows) {
    const record = state.partials[row.index];
    if (!record) continue;
    for (const column of row.columns) {
      const expectedText = row.expectedDigits[String(column)];
      const studentText = record[String(column)];
      if (expectedText === undefined || studentText === undefined) continue;
      const student = Number(studentText);
      const expected = Number(expectedText);
      if (student === expected) continue;
      const place = column - row.shift;
      mismatches.push({
        row,
        column,
        student,
        expected,
        aDigit: digitAt(plan.aText, place),
        factor: row.factor,
        carryIn: Number(row.expectedCarries[String(column)] ?? '0'),
      });
    }
  }

  // b가 한 자리면 합 줄도 한 열씩 곱해서 쓴다.
  if (plan.singleDigit) {
    const factor = Number(plan.bText);
    let carryIn = 0;
    const productDigits = plan.productDigits;
    for (let column = 0; column < productDigits.length; column += 1) {
      const aDigit = digitAt(plan.aText, column);
      const carryBefore = carryIn;
      const expected = (aDigit * factor + carryBefore) % 10;
      carryIn = Math.floor((aDigit * factor + carryBefore) / 10);
      const studentText = state.result[String(column)];
      if (studentText === undefined) continue;
      const student = Number(studentText);
      if (student === expected) continue;
      mismatches.push({
        row: {
          index: -1,
          factor,
          shift: 0,
          value: 0n,
          shiftedValue: 0n,
          start: 0,
          end: column,
          columns: [],
          placeholderColumns: [],
          expectedDigits: {},
          expectedCarries: {},
          carryColumns: [],
        },
        column,
        student,
        expected,
        aDigit,
        factor,
        carryIn: carryBefore,
      });
    }
  }
  return mismatches;
}

/** 받은 올림을 곱하기 전에 더한 경우. */
function carryAddedBefore(state: ColumnCalcState, plan: MulPlan): ColumnError | null {
  for (const cell of rowMismatches(state, plan)) {
    const modified = ((cell.aDigit + cell.carryIn) * cell.factor) % 10;
    if (modified !== cell.expected && cell.student === modified) {
      return { column: cell.column, code: 'MC-MUL-CARRY-ADD-BEFORE' };
    }
  }
  return null;
}

/** 받아올림을 더하지 않았거나, 두 자리 곱을 그대로 쓴 경우. */
function noCarry(state: ColumnCalcState, plan: MulPlan): ColumnError | null {
  for (const cell of rowMismatches(state, plan)) {
    const bare = cell.aDigit * cell.factor;
    const noCarryDigit = bare % 10;
    const tensDigit = Math.floor(bare / 10);
    if (cell.student === noCarryDigit || (bare >= 10 && cell.student === tensDigit)) {
      return { column: cell.column, code: 'MC-PV-NO-CARRY' };
    }
  }
  return null;
}

/** 자릿값 없이 자리마다 곱한 값을 그대로 더한 경우(4×23 → 8+12=20). */
function noPlaceValue(state: ColumnCalcState, plan: MulPlan): ColumnError | null {
  const sum = big(readSumValue(state, plan));
  if (sum === null || sum === plan.product) return null;
  let digitwise = 0n;
  for (let column = 0; column < plan.aText.length; column += 1) {
    digitwise += BigInt(digitAt(plan.aText, column)) * plan.b;
  }
  if (digitwise !== plan.product && sum === digitwise) {
    return { column: 0, code: 'MC-MUL-NO-PLACE-VALUE' };
  }
  return null;
}

/** 첫 번째로 맞는 곱셈 오개념 하나. 없으면 null. */
export function classifyMul(
  state: ColumnCalcState,
  plan: MulPlan = computeMulPlan(state) ?? emptyPlan(),
): ColumnError | null {
  // 자릿값 없이 더한 합(4×23 → 8+12=20)은 열 단위 규칙(올림·받아올림)과
  // 우연히 겹치므로(CARRY-ADD-BEFORE가 20을 만들 수 있다) 열 규칙보다 먼저 본다.
  return (
    shiftedAway(state, plan) ??
    missingPartial(state, plan) ??
    noPlaceValue(state, plan) ??
    carryAddedBefore(state, plan) ??
    noCarry(state, plan)
  );
}

function emptyPlan(): MulPlan {
  return {
    aText: '0',
    bText: '0',
    a: 0n,
    b: 0n,
    product: 0n,
    productDigits: '0',
    style: 'carry',
    singleDigit: true,
    showZeroPlaceholder: false,
    rows: [],
    resultColumns: [0],
    requiredColumns: [0],
    low: 0,
    high: 0,
  };
}

export type { MisconceptionCode };
