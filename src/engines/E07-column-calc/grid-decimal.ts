/**
 * E07 소수 곱셈의 자리 계산·결과 읽기·어림 신호(순수 함수).
 *
 * 격자는 소수점을 뺀 숫자열을 자연수로 보고 오른쪽 끝을 맞춘다.
 * 값은 `BigInt`·`Rational`로만 계산하고, 화면·상태에는 문자열 자리만 둔다.
 * 기대 소수점 위치(정답)는 Observation·화면에 내보내지 않는다.
 */
import { Rational } from '../../core/math';
import { isDecimalMul, mulAlignment, parseNumber } from './grid';
import type { ParsedNumber } from './grid';
import { computeMulPlan, normalizeDigits, rowsComplete } from './grid-mul';
import type { MulPlan } from './grid-mul';
import type { ColumnCalcState, EstimateSignal, ShiftOp } from './types';

export const SHIFT_OPS: readonly ShiftOp[] = ['×10', '×100', '×1000', '×0.1', '×0.01', '×0.001'];

const SHIFT_DELTA: Readonly<Record<ShiftOp, number>> = {
  '×10': 1,
  '×100': 2,
  '×1000': 3,
  '×0.1': -1,
  '×0.01': -2,
  '×0.001': -3,
};

/** 시프트 데모 기둥 범위: 천(3) … 소수 넷째(−4). */
export const SHIFT_LOW = -4;
export const SHIFT_HIGH = 3;

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

/** 소수 곱셈의 두 수. 읽을 수 없으면 null. */
export function decimalOperands(
  state: ColumnCalcState,
): { readonly a: ParsedNumber; readonly b: ParsedNumber } | null {
  if (!isDecimalMul(state)) return null;
  const a = parseNumber(state.aText);
  const b = parseNumber(state.bText);
  if (!a || !b) return null;
  return { a, b };
}

export function shiftDelta(op: ShiftOp): number {
  return SHIFT_DELTA[op];
}

/** 설정에서 받은 문자열이 시프트 걸음인가. */
export function shiftOpOf(value: string): ShiftOp | null {
  return (SHIFT_OPS as readonly string[]).includes(value) ? (value as ShiftOp) : null;
}

/**
 * `value`를 `10^exponent`배 한 값. 자리 카드가 기둥 밖으로 나가도 값 계산은 한다.
 * 읽을 수 없으면 null.
 */
export function valueAtShift(text: string, exponent: number): Rational | null {
  const parsed = parseNumber(text);
  if (!parsed) return null;
  const digits = BigInt(parsed.digits);
  const scale = parsed.fracDigits - exponent;
  if (scale >= 0) return Rational.of(digits, pow10(scale));
  return Rational.of(digits * pow10(-scale));
}

/** 지금 시프트 데모 값(Rational). 데모가 없으면 null. */
export function shiftValue(state: ColumnCalcState): Rational | null {
  if (state.shiftBase === null) return null;
  return valueAtShift(state.shiftBase, state.shiftExponent);
}

export function shiftValueText(state: ColumnCalcState): string | null {
  const value = shiftValue(state);
  return value === null ? null : value.toString();
}

/** 지금 값의 숫자 카드가 기둥 안에 모두 들어오는가. */
export function shiftFitsAt(text: string, exponent: number): boolean {
  const parsed = parseNumber(text);
  if (!parsed) return false;
  const most = parsed.intDigits - 1 + exponent;
  const rightmost = -parsed.fracDigits + exponent;
  return most <= SHIFT_HIGH && rightmost >= SHIFT_LOW;
}

/** `op`를 한 번 더 눌렀을 때 카드가 기둥 안에 남는가. */
export function shiftFits(state: ColumnCalcState, op: ShiftOp): boolean {
  if (state.shiftBase === null) return false;
  return shiftFitsAt(state.shiftBase, state.shiftExponent + shiftDelta(op));
}

/** 시프트 데모에서 지금 숫자 카드가 꽂힌 열과 숫자. */
export function shiftCards(
  state: ColumnCalcState,
): readonly { readonly column: number; readonly digit: string }[] {
  if (state.shiftBase === null) return [];
  const parsed = parseNumber(state.shiftBase);
  if (!parsed) return [];
  const cards: { column: number; digit: string }[] = [];
  for (let offset = 0; offset < parsed.digits.length; offset += 1) {
    const column = -parsed.fracDigits + (parsed.digits.length - 1 - offset) + state.shiftExponent;
    cards.push({ column, digit: parsed.digits[offset] ?? '0' });
  }
  return cards;
}

/** 소수 곱셈 어림값. 형식 `^\d{1,4}(\.\d{1,3})?$`, 0보다 커야 한다. */
export function decimalEstimate(state: ColumnCalcState): Rational | null {
  if (!isDecimalMul(state) || state.estimate === null) return null;
  const text = state.estimate.trim();
  if (!/^\d{1,4}(\.\d{1,3})?$/.test(text)) return null;
  try {
    const value = Rational.parse(text);
    return value.compareTo(Rational.of(0n)) > 0 ? value : null;
  } catch {
    return null;
  }
}

export interface DecimalResultReading {
  /** 결과 줄이 0 … max(가장 높은 채운 칸, 점)까지 빈칸 없이 찼는가. */
  readonly complete: boolean;
  /** 칸 그대로 + 점 자리에 `.`. */
  readonly raw: string | null;
  /** Rational 정규 문자열. 완성되지 않았으면 null. */
  readonly value: string | null;
  readonly resultPoint: number | null;
  readonly pointPlaced: boolean;
  readonly highest: number | null;
}

function resultDigit(state: ColumnCalcState, column: number): string | null {
  const value = state.result[String(column)];
  return value !== undefined && /^[0-9]$/.test(value) ? value : null;
}

/** 결과 줄을 읽어 완성 여부·값·점을 구한다. 값 = N / 10^p. */
export function readDecimalResult(state: ColumnCalcState): DecimalResultReading {
  const point = state.resultPoint;
  const p = point ?? 0;
  const filled: number[] = [];
  for (const [key, value] of Object.entries(state.result)) {
    if (!/^-?\d+$/.test(key)) continue;
    if (!/^[0-9]$/.test(value)) continue;
    filled.push(Number(key));
  }
  if (filled.length === 0) {
    return {
      complete: false,
      raw: null,
      value: null,
      resultPoint: point,
      pointPlaced: point !== null,
      highest: null,
    };
  }
  const highest = Math.max(...filled);
  const targetHigh = Math.max(highest, p);
  let complete = true;
  for (let column = 0; column <= targetHigh; column += 1) {
    if (resultDigit(state, column) === null) {
      complete = false;
      break;
    }
  }

  let raw = '';
  for (let column = targetHigh; column >= 0; column -= 1) {
    raw += resultDigit(state, column) ?? '';
    if (p > 0 && column === p) raw += '.';
  }

  let value: string | null = null;
  if (complete) {
    let digits = '';
    for (let column = highest; column >= 0; column -= 1) {
      digits += resultDigit(state, column) ?? '0';
    }
    value = Rational.of(BigInt(digits), pow10(p)).toString();
  }

  return {
    complete,
    raw,
    value,
    resultPoint: point,
    pointPlaced: point !== null,
    highest,
  };
}

/** 소수 곱셈 완성: 부분곱 줄 + 결과 줄 + (소수 자리가 있으면 점). */
export function decimalMulComplete(state: ColumnCalcState, plan?: MulPlan | null): boolean {
  if (!isDecimalMul(state)) return false;
  const current = plan === undefined ? computeMulPlan(state) : plan;
  if (!current) return false;
  if (!rowsComplete(state, current)) return false;
  const operands = decimalOperands(state);
  if (!operands) return false;
  const needsPoint = operands.a.fracDigits + operands.b.fracDigits > 0;
  if (needsPoint && state.resultPoint === null) return false;
  return readDecimalResult(state).complete;
}

/** 결과 숫자 N이 숫자열 곱과 다른 열. 점 위치는 보지 않는다. */
export function decimalWrongColumns(
  state: ColumnCalcState,
  plan?: MulPlan | null,
): readonly number[] {
  const current = plan === undefined ? computeMulPlan(state) : plan;
  if (!current || !isDecimalMul(state)) return [];
  const wrong: number[] = [];
  for (const column of current.resultColumns) {
    const student = resultDigit(state, column);
    if (student === null) continue;
    const expected = current.productDigits[current.productDigits.length - 1 - column] ?? '0';
    if (student !== expected) wrong.push(column);
  }
  return wrong;
}

/**
 * 소수 곱셈 신호등. 완성 + 어림값이 있을 때만 낸다.
 * r = 결과 ÷ 어림값. 1/2 … 2 초록, 1/5 … 5 노랑, 그 밖은 빨강.
 */
export function decimalSignal(state: ColumnCalcState): EstimateSignal | null {
  if (!isDecimalMul(state) || state.phase !== 'calc') return null;
  const estimate = decimalEstimate(state);
  if (estimate === null) return null;
  const reading = readDecimalResult(state);
  if (!decimalMulComplete(state) || reading.value === null) return null;
  let result: Rational;
  try {
    result = Rational.parse(reading.value);
  } catch {
    return null;
  }
  const ratio = result.div(estimate);
  const half = Rational.of(1n, 2n);
  const two = Rational.of(2n);
  const fifth = Rational.of(1n, 5n);
  const five = Rational.of(5n);
  if (ratio.compareTo(half) >= 0 && ratio.compareTo(two) <= 0) return 'green';
  if (ratio.compareTo(fifth) >= 0 && ratio.compareTo(five) <= 0) return 'yellow';
  return 'red';
}

/** 소수 곱셈의 정렬(카드가 아직 안 놓였으면 aligned false). */
export function decimalMulAlignment(state: ColumnCalcState): ReturnType<typeof mulAlignment> {
  return mulAlignment(state);
}

/** 결과 읽기에 쓰는 N(숫자열). 테스트·분류용. */
export function decimalResultDigits(state: ColumnCalcState): string | null {
  const reading = readDecimalResult(state);
  if (reading.highest === null) return null;
  let digits = '';
  for (let column = reading.highest; column >= 0; column -= 1) {
    digits += resultDigit(state, column) ?? '0';
  }
  return normalizeDigits(digits);
}
