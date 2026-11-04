/**
 * E07의 수 읽기·자리 계산.
 *
 * 수 문자열(`"12.08"`)을 `intDigits`·`fracDigits`로 나누고, 모든 열 계산은
 * 정수 덧셈·뺄셈으로만 한다. 값 비교가 필요하면 `Rational`을 쓴다.
 * 이 파일은 순수 함수만 내보낸다.
 */
import { Rational } from '../../core/math';
import type { ColumnCalcState, ColumnOp } from './types';

export interface ParsedNumber {
  readonly text: string;
  /** 소수점을 뺀 숫자들. 예: "12.08" → "1208". */
  readonly digits: string;
  readonly intDigits: number;
  readonly fracDigits: number;
}

/** `"347"`, `"3.5"`, `"12.08"`만 받는다. 음수·지수 표기·쉼표는 받지 않는다. */
export function parseNumber(text: string): ParsedNumber | null {
  const trimmed = text.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return null;
  const intPart = match[1] ?? '';
  const fracPart = match[2] ?? '';
  if (intPart.length === 0) return null;
  return {
    text: trimmed,
    digits: intPart + fracPart,
    intDigits: intPart.length,
    fracDigits: fracPart.length,
  };
}

/** 일의 자리(소수점 왼쪽) 열의 지수가 `point`일 때 가장 낮은 자리 열. */
export function anchorOf(parsed: ParsedNumber, point: number): number {
  return point - parsed.fracDigits;
}

/** 가장 높은 자리 열. */
export function mostOf(parsed: ParsedNumber, point: number): number {
  return point + parsed.intDigits - 1;
}

/**
 * `point`에 놓인 수의 `column` 자리 숫자. 그 자리에 숫자가 없으면 null.
 * `pads`에 든 열은 학생이 0을 채운 것으로 읽는다.
 */
export function digitAt(
  parsed: ParsedNumber,
  point: number,
  column: number,
  pads: readonly number[] = [],
): string | null {
  const offset = column - anchorOf(parsed, point);
  const index = parsed.digits.length - 1 - offset;
  if (index >= 0 && index < parsed.digits.length) return parsed.digits[index] ?? null;
  if (pads.includes(column)) return '0';
  return null;
}

/** 자릿값. 예: column 2 → 100, column −1 → 1/10. */
export function placeValue(column: number): Rational {
  if (column >= 0) return Rational.of(10n ** BigInt(column));
  return Rational.of(1n, 10n ** BigInt(-column));
}

/** 그 자리 숫자가 뜻하는 수. 예: 5가 소수 첫째 자리면 0.5. */
export function digitValue(digit: string, column: number): string {
  const value = Rational.of(BigInt(digit)).mul(placeValue(column));
  return value.isInteger() ? value.toString() : value.toDecimalString();
}

export type Alignment = 'point' | 'right-edge' | 'other';

export interface AlignmentResult {
  readonly aligned: boolean;
  readonly alignment: Alignment | null;
  /** 두 소수점이 같은 열에 있을 때의 그 열(일의 자리). */
  readonly pointColumn: number | null;
}

export function alignmentOf(state: ColumnCalcState): AlignmentResult {
  if (state.mode !== 'decimal') return { aligned: true, alignment: null, pointColumn: 0 };
  if (state.aPoint === null || state.bPoint === null) {
    return { aligned: false, alignment: null, pointColumn: null };
  }
  const a = parseNumber(state.aText);
  const b = parseNumber(state.bText);
  if (!a || !b) return { aligned: false, alignment: null, pointColumn: null };
  if (state.aPoint === state.bPoint) {
    return { aligned: true, alignment: 'point', pointColumn: state.aPoint };
  }
  if (anchorOf(a, state.aPoint) === anchorOf(b, state.bPoint)) {
    return { aligned: false, alignment: 'right-edge', pointColumn: null };
  }
  return { aligned: false, alignment: 'other', pointColumn: null };
}

/** 소수 곱셈인가(mode decimal + op mul). */
export function isDecimalMul(state: ColumnCalcState): boolean {
  return state.mode === 'decimal' && state.op === 'mul';
}

/**
 * 소수 곱셈의 정렬. `'right-edge'`만 바른 정렬이다.
 * 두 수의 소수 자리 수가 같으면 point와 right-edge가 같은 자리이므로 right-edge로 본다.
 */
export function mulAlignment(state: ColumnCalcState): AlignmentResult {
  if (!isDecimalMul(state)) return { aligned: true, alignment: null, pointColumn: 0 };
  const a = parseNumber(state.aText);
  const b = parseNumber(state.bText);
  if (!a || !b || state.aPoint === null || state.bPoint === null) {
    return { aligned: false, alignment: null, pointColumn: null };
  }
  if (anchorOf(a, state.aPoint) === anchorOf(b, state.bPoint)) {
    return { aligned: true, alignment: 'right-edge', pointColumn: null };
  }
  if (state.aPoint === state.bPoint) {
    return { aligned: false, alignment: 'point', pointColumn: state.aPoint };
  }
  return { aligned: false, alignment: 'other', pointColumn: null };
}

export interface ColumnComputation {
  readonly column: number;
  /** 윗수·아랫수의 그 자리 숫자(받아내림으로 고치기 전). */
  readonly top: number;
  readonly bottom: number;
  /** add: 오른쪽 열에서 받아온 수. sub: 0. */
  readonly carryIn: number;
  /** add: 왼쪽 열로 보내는 받아올림. sub: 0. */
  readonly carryOut: number;
  /** sub: 이 열이 윗자리에서 받아내린 수(0/1). */
  readonly borrowFromHigher: number;
  /** sub: 오른쪽 열이 이 열에서 받아내려서 이 열의 윗수가 1 줄었는지(0/1). */
  readonly decrement: number;
  /** 바른 결과 숫자. */
  readonly expected: number;
  /** add: 받아올림을 잊고 계산했을 때의 숫자. sub에서는 null. */
  readonly noCarryDigit: number | null;
  /** sub: 이 열을 원래 윗수로 계산했을 때의 숫자. add에서는 null. */
  readonly originalTopDigit: number | null;
}

export interface GridComputation {
  readonly a: ParsedNumber | null;
  readonly b: ParsedNumber | null;
  readonly aPoint: number | null;
  readonly bPoint: number | null;
  /** 화면에 그리는 열 범위(양 끝 포함). */
  readonly low: number;
  readonly high: number;
  readonly alignment: AlignmentResult;
  /** 결과 칸을 입력할 수 있는 열. */
  readonly resultColumns: readonly number[];
  /** 다 채워야 하는 결과 열(가장 높은 0 아닌 기대값까지). */
  readonly requiredColumns: readonly number[];
  /** 화면에 그릴 열. decimal에서 카드를 놓기 전에는 빈 자리 안내 칸을 그린다. */
  readonly displayColumns: readonly number[];
  readonly columns: readonly ColumnComputation[];
  /** 열 지수 → 계산. 없는 열은 null. */
  readonly byColumn: ReadonlyMap<number, ColumnComputation>;
}

function columnRange(low: number, high: number): number[] {
  const result: number[] = [];
  for (let column = low; column <= high; column += 1) result.push(column);
  return result;
}

function templateRange(
  state: ColumnCalcState,
  a: ParsedNumber,
  b: ParsedNumber,
): {
  low: number;
  high: number;
} {
  if (state.mode === 'decimal') {
    const maxFrac = Math.max(a.fracDigits, b.fracDigits);
    const maxInt = Math.max(a.intDigits, b.intDigits);
    return { low: -(maxFrac + 3), high: maxInt + 1 };
  }
  return {
    low: Math.min(anchorOf(a, 0), anchorOf(b, 0)),
    high: Math.max(mostOf(a, 0), mostOf(b, 0)) + 1,
  };
}

function stripLeadingZeros(text: string): string {
  const trimmed = text.replace(/^0+(?=\d)/, '');
  return trimmed.length === 0 ? '0' : trimmed;
}

/**
 * 곱셈 격자의 뼈대. 결과 줄의 기대 숫자만 여기서 만들고, 부분곱 줄은
 * `grid-mul.ts`가 학생 상태와 함께 계산한다(이 파일은 순수 자리 계산만).
 *
 * 소수 곱셈은 소수점을 뺀 숫자열을 자연수로 보고 오른쪽 끝을 맞춘다.
 * 결과 줄은 `max(자연수 곱 자릿수, aFrac + bFrac)`까지 연다(0.25 × 0.4의 0.100).
 */
function computeMulGrid(
  state: ColumnCalcState,
  a: ParsedNumber,
  b: ParsedNumber,
  alignment: AlignmentResult,
): GridComputation {
  const decimalMul = isDecimalMul(state);
  if (!decimalMul && (a.fracDigits !== 0 || b.fracDigits !== 0)) {
    return {
      a,
      b,
      aPoint: state.aPoint,
      bPoint: state.bPoint,
      low: 0,
      high: 1,
      alignment,
      resultColumns: [],
      requiredColumns: [],
      displayColumns: columnRange(0, 1),
      columns: [],
      byColumn: new Map(),
    };
  }

  const aDigits = decimalMul ? stripLeadingZeros(a.digits) : a.digits;
  const bDigits = decimalMul ? stripLeadingZeros(b.digits) : b.digits;
  const aLength = aDigits.length;
  const bLength = bDigits.length;
  const productText = (BigInt(aDigits) * BigInt(bDigits)).toString();
  const productLength = productText.length;
  const resultHigh = decimalMul
    ? Math.max(aLength + bLength - 1, a.fracDigits + b.fracDigits)
    : aLength + bLength - 1;
  const displayHigh = decimalMul ? Math.max(a.digits.length - 1, b.digits.length - 1) : 0;
  const high = Math.max(aLength, bLength, productLength, resultHigh, displayHigh);
  const resultColumns = columnRange(0, resultHigh);
  const requiredColumns = columnRange(0, productLength - 1);
  const columns: ColumnComputation[] = [];
  const byColumn = new Map<number, ColumnComputation>();
  for (let column = 0; column <= high; column += 1) {
    const expected = Number(productText[productLength - 1 - column] ?? '0');
    const computation: ColumnComputation = {
      column,
      top: Number(aDigits[aLength - 1 - column] ?? '0'),
      bottom: Number(bDigits[bLength - 1 - column] ?? '0'),
      carryIn: 0,
      carryOut: 0,
      borrowFromHigher: 0,
      decrement: 0,
      expected,
      noCarryDigit: null,
      originalTopDigit: null,
    };
    columns.push(computation);
    byColumn.set(column, computation);
  }

  return {
    a,
    b,
    aPoint: state.aPoint,
    bPoint: state.bPoint,
    low: 0,
    high,
    alignment,
    resultColumns,
    requiredColumns,
    displayColumns: columns.map((entry) => entry.column),
    columns,
    byColumn,
  };
}

/** 두 수가 놓인 자리로 기대값을 계산한다. decimal에서 아직 안 놓았으면 빈 격자. */
export function computeGrid(state: ColumnCalcState): GridComputation {
  const a = parseNumber(state.aText);
  const b = parseNumber(state.bText);
  const alignment = alignmentOf(state);
  if (!a || !b) {
    return {
      a,
      b,
      aPoint: state.aPoint,
      bPoint: state.bPoint,
      low: -2,
      high: 1,
      alignment,
      resultColumns: [],
      requiredColumns: [],
      displayColumns: columnRange(-2, 1),
      columns: [],
      byColumn: new Map(),
    };
  }

  const template = templateRange(state, a, b);
  const aPoint = state.aPoint ?? 0;
  const bPoint = state.bPoint ?? 0;
  const placed = state.aPoint !== null && state.bPoint !== null;

  // 곱셈은 b 카드를 놓기 전에도 격자 뼈대를 그린다(정렬 전 입력은 reduce가 막는다).
  if (state.op === 'mul') return computeMulGrid(state, a, b, alignment);

  if (!placed && state.mode === 'decimal') {
    return {
      a,
      b,
      aPoint: state.aPoint,
      bPoint: state.bPoint,
      low: template.low,
      high: template.high,
      alignment,
      resultColumns: [],
      requiredColumns: [],
      displayColumns: columnRange(template.low, template.high),
      columns: [],
      byColumn: new Map(),
    };
  }

  const aAnchor = anchorOf(a, aPoint);
  const bAnchor = anchorOf(b, bPoint);
  const aMost = mostOf(a, aPoint);
  const bMost = mostOf(b, bPoint);
  const resultHigh = Math.max(aMost, bMost) + 1;
  const low = Math.min(template.low, aAnchor, bAnchor);
  // 두 카드를 다 놓은 뒤에는 실제로 놓인 범위만 그린다(빈 열을 줄인다).
  const high = placed ? resultHigh : Math.max(template.high, resultHigh);
  const op: ColumnOp = state.op;

  const columns: ColumnComputation[] = [];
  const byColumn = new Map<number, ColumnComputation>();
  let carryIn = 0;
  let decrement = 0;

  for (let column = low; column <= high; column += 1) {
    const top = Number(digitAt(a, aPoint, column, state.aPads) ?? '0');
    const bottom = Number(digitAt(b, bPoint, column, state.bPads) ?? '0');

    if (op === 'add') {
      const sum = top + bottom + carryIn;
      const expected = sum % 10;
      const carryOut = sum >= 10 ? 1 : 0;
      const computation: ColumnComputation = {
        column,
        top,
        bottom,
        carryIn,
        carryOut,
        borrowFromHigher: 0,
        decrement: 0,
        expected,
        noCarryDigit: (top + bottom) % 10,
        originalTopDigit: null,
      };
      columns.push(computation);
      byColumn.set(column, computation);
      carryIn = carryOut;
    } else {
      const effectiveTop = top - decrement;
      const borrowFromHigher = effectiveTop < bottom ? 1 : 0;
      const expected = borrowFromHigher ? effectiveTop + 10 - bottom : effectiveTop - bottom;
      const computation: ColumnComputation = {
        column,
        top,
        bottom,
        carryIn: 0,
        carryOut: 0,
        borrowFromHigher,
        decrement,
        expected,
        noCarryDigit: null,
        originalTopDigit: decrement > 0 ? (top < bottom ? top + 10 - bottom : top - bottom) : null,
      };
      columns.push(computation);
      byColumn.set(column, computation);
      decrement = borrowFromHigher;
    }
  }

  const resultLow = Math.min(aAnchor, bAnchor);
  const resultColumns = columnRange(resultLow, resultHigh);
  let highestNonZero = resultLow;
  for (const computation of columns) {
    if (
      computation.column >= resultLow &&
      computation.column <= resultHigh &&
      computation.expected !== 0
    ) {
      highestNonZero = Math.max(highestNonZero, computation.column);
    }
  }
  const requiredColumns = columnRange(resultLow, highestNonZero);

  return {
    a,
    b,
    aPoint: state.aPoint,
    bPoint: state.bPoint,
    low,
    high,
    alignment,
    resultColumns,
    requiredColumns,
    displayColumns: columns.map((entry) => entry.column),
    columns,
    byColumn,
  };
}

function resultDigit(state: ColumnCalcState, column: number): string | null {
  return state.result[String(column)] ?? null;
}

export interface ResultReading {
  readonly complete: boolean;
  readonly raw: string | null;
  /** Rational 정규 문자열. 다 채우지 않았으면 null. */
  readonly value: string | null;
  readonly wrongColumns: readonly number[];
}

/** 결과 줄을 읽어 완성 여부·값·틀린 열을 구한다. */
export function readResult(state: ColumnCalcState, grid: GridComputation): ResultReading {
  const filled = grid.resultColumns.filter((column) => resultDigit(state, column) !== null);
  const complete = grid.requiredColumns.every((column) => resultDigit(state, column) !== null);
  const wrongColumns = grid.resultColumns.filter((column) => {
    const digit = resultDigit(state, column);
    const computation = grid.byColumn.get(column);
    if (digit === null || !computation) return false;
    return Number(digit) !== computation.expected;
  });

  if (filled.length === 0) return { complete, raw: null, value: null, wrongColumns };

  const highest = Math.max(...filled);
  const lowest = Math.min(...filled);
  const point = grid.alignment.alignment === 'point' ? grid.alignment.pointColumn : null;
  let raw = '';
  for (let column = highest; column >= lowest; column -= 1) {
    raw += resultDigit(state, column) ?? '';
    if (point !== null && column === point && lowest < point) raw += '.';
  }
  if (raw.startsWith('.')) raw = `0${raw}`;

  if (!complete) return { complete, raw, value: null, wrongColumns };
  try {
    const parsed = Rational.parse(raw);
    // 이 엔진의 결과는 항상 유한소수다. 화면·콘텐츠가 읽기 쉬운 소수 표기를 쓴다.
    const value = parsed.isTerminatingDecimal() ? parsed.toDecimalString() : parsed.toString();
    return { complete, raw, value, wrongColumns };
  } catch {
    return { complete, raw, value: null, wrongColumns };
  }
}

/** decimal에서 결과 칸을 입력할 수 있는 열인가. */
export function isResultColumn(column: number): boolean {
  return Number.isInteger(column);
}

/** 마지막 두 수를 견주어 `sub` 설정 오류를 찾는다. */
export function compareNumbers(a: ParsedNumber, b: ParsedNumber): -1 | 0 | 1 {
  return Rational.parse(a.text).compareTo(Rational.parse(b.text));
}
