/**
 * E07 나눗셈 세로셈 계산(순수 함수).
 *
 * 단계는 **학생이 쓴 몫**에서 생긴다. 정답 몫에서 만들지 않는다.
 * 몫 열 c에 0이 아닌 숫자를 쓰면 그 열에 단계가 생기고, 그 단계의 곱·뺄셈 줄
 * 기대값은 학생 몫·학생 앞 단계 값만으로 계산한다. 정답은 화면에 내보내지 않는다.
 *
 * T078: 소수 나눗셈은 격자 수 G·g와 열 범위 top … low를 쓴다. decimal이
 * 아니면 low = 0이라 T047 계산과 같다.
 * 값은 `BigInt`·`Rational`로만 계산하고 상태·화면에는 문자열 자리만 둔다.
 */
import { Rational } from '../../core/math';
import { divGridNumbers, gridDividendDigit } from './grid-div-decimal';
import type { DivGridNumbers } from './grid-div-decimal';
import type { ColumnCalcState } from './types';

const ZERO = 0n;
const TEN = 10n;

export interface DivReading {
  /** 격자 나누어지는 수 G(소수 자리는 숫자열만). */
  readonly dividend: bigint;
  /** 격자 나누는 수 g. */
  readonly divisor: bigint;
  /** 나누어지는 수의 맨 윗열. */
  readonly top: number;
  /** 가장 낮은 열(붙인 0 포함). */
  readonly low: number;
  /** 피제수의 소수 자리만 반영한 가장 낮은 열. */
  readonly baseLow: number;
  /** 붙인 0의 개수. */
  readonly appendedZeros: number;
  readonly decimal: boolean;
  readonly gridOpen: boolean;
  /** 몫 소수점: 일의 자리 열. 점은 그 칸 오른쪽에 그린다. */
  readonly quotientPoint: number | null;
  /** 몫 칸을 맨 윗열부터 가장 낮은 열까지 그대로 읽은 문자열. 빈칸은 공백. */
  readonly quotientRaw: string;
  /** 점을 뺀 몫 칸 문자열(빈칸은 공백). */
  readonly quotientCells: string;
  /** 학생 몫 값. 한 칸도 없으면 null. */
  readonly quotient: Rational | null;
  readonly quotientText: string | null;
  /** 맨 윗열에 0을 썼는가. */
  readonly quotientLeadingZero: boolean;
  /** 채워진 몫 칸 중 가장 높은 열. 없으면 null. */
  readonly quotientHighest: number | null;
  /** 채워진 몫 칸 중 가장 낮은 열. 없으면 null. */
  readonly quotientLowest: number | null;
  /** 가장 높은 몫 칸부터 (decimal이면 가장 낮은 칸, 아니면 열 0)까지 빈칸이 없는가. */
  readonly quotientComplete: boolean;
  /** 높은 몫 칸과 낮은 몫 칸 사이에 빈칸이 있는데 더 낮은 칸이 채워졌는가. */
  readonly skippedZero: boolean;
  readonly scaledDividend: Rational;
  readonly scaledDivisor: Rational;
  readonly scaleA: number;
  readonly scaleB: number;
  /** 격자 정수 I = G × 10^(−low). */
  readonly I: bigint;
}

export interface DivStepPlan {
  /** 이 단계의 몫 열. */
  readonly column: number;
  /** 학생이 쓴 0이 아닌 몫 숫자. */
  readonly digit: number;
  /** 이 단계의 부분 피제수(학생 앞 단계에서 이어짐). */
  readonly partial: bigint;
  /** 학생 몫 숫자 × 나누는 수. */
  readonly product: bigint;
  /** 부분 피제수 − 곱(음수일 수 있다). */
  readonly diff: bigint;
  /** 곱 줄 열(낮은 열 → 높은 열). */
  readonly productColumns: readonly number[];
  /** 뺄셈 줄의 뺀 결과 열(낮은 열 → 높은 열). */
  readonly diffColumns: readonly number[];
  /** 내림 칸 열(높은 열 → 낮은 열). */
  readonly bringColumns: readonly number[];
  /** 곱 줄 기대 숫자: 열 → 숫자. */
  readonly expectedProduct: Readonly<Record<string, string>>;
  /** 뺀 결과 기대 숫자: 열 → 숫자. `diff < 0`이면 null. */
  readonly expectedDiff: Readonly<Record<string, string>> | null;
  /** 내림 칸 기대 숫자: 열 → 나누어지는 수의 그 자리 숫자. */
  readonly expectedBring: Readonly<Record<string, string>>;
  /** 뺄셈 줄 전체(뺀 결과 + 내림) 열. 낮은 열 → 높은 열. */
  readonly rowColumns: readonly number[];
  /** 기대 뺄셈 줄 값(뺀 결과 × 10^내림 자릿수 + 내림 숫자). 음수면 null. */
  readonly expectedRowValue: bigint | null;
}

export interface DivPlan {
  readonly reading: DivReading;
  readonly divisorDigits: number;
  readonly steps: readonly DivStepPlan[];
}

export interface DivRemainderDetail {
  /** 원래 단위 나머지. */
  readonly value: Rational;
  /** 격자 단위 나머지(R × 10^L). */
  readonly gridValue: Rational;
  /** 마지막 뺄셈 줄의 가장 낮은 열. */
  readonly low: number;
}

function absBig(value: bigint): bigint {
  return value < ZERO ? -value : value;
}

export function pow10Big(exponent: number): bigint {
  return TEN ** BigInt(exponent);
}

function pow10Rational(exponent: number): Rational {
  return exponent >= 0 ? Rational.of(pow10Big(exponent)) : Rational.of(1n, pow10Big(-exponent));
}

/** 0 이상의 정수를 자리 문자열로. */
export function digitsOf(value: bigint): string {
  return value.toString();
}

/**
 * `text`를 `width`칸에 낮은 자리부터 채운 기대 숫자 표.
 * 예: value 72, columns [1, 2] → { "1": "2", "2": "7" }.
 */
export function expectedDigitsFor(
  value: bigint,
  columns: readonly number[],
): Record<string, string> {
  if (columns.length === 0) return {};
  const padded = digitsOf(absBig(value)).padStart(columns.length, '0');
  const record: Record<string, string> = {};
  for (let index = 0; index < columns.length; index += 1) {
    // columns는 낮은 열부터. 문자열은 높은 자리부터이므로 뒤에서 읽는다.
    record[String(columns[index])] = padded.charAt(padded.length - 1 - index) ?? '0';
  }
  return record;
}

/** 열 목록에서 학생이 쓴 숫자를 읽는다. 빈칸은 0, 한 칸도 없으면 null. */
export function readRowValue(
  record: Readonly<Record<string, string>> | undefined,
  columns: readonly number[],
): bigint | null {
  if (!record) return null;
  const sorted = [...columns].sort((left, right) => right - left);
  let text = '';
  let filled = false;
  for (const column of sorted) {
    const digit = record[String(column)];
    if (digit === undefined) {
      text += '0';
    } else {
      text += digit;
      filled = true;
    }
  }
  if (!filled) return null;
  return BigInt(text);
}

/** 뺀 결과(내림 앞부분)만 읽는다. 빈칸은 0. */
export function readDiffResultValue(
  record: Readonly<Record<string, string>> | undefined,
  columns: readonly number[],
): bigint | null {
  return readRowValue(record, columns);
}

/** 열 목록에서 낮은 열부터 빈칸 없이 이어진 숫자가 하나 이상 있는가. */
export function rowHasRun(
  record: Readonly<Record<string, string>> | undefined,
  columns: readonly number[],
): boolean {
  if (!record || columns.length === 0) return false;
  const sorted = [...columns].sort((left, right) => left - right);
  const lowest = sorted[0];
  if (lowest === undefined || record[String(lowest)] === undefined) return false;
  let run = 0;
  for (const column of sorted) {
    if (record[String(column)] === undefined) break;
    run += 1;
  }
  return run > 0;
}

function quotientRawOf(
  state: ColumnCalcState,
  numbers: DivGridNumbers,
  point: number | null,
): string {
  let cells = '';
  let highest: number | null = null;
  for (let column = numbers.top; column >= numbers.low; column -= 1) {
    const digit = state.quotient[String(column)] ?? ' ';
    if (digit !== ' ' && highest === null) highest = column;
    cells += digit;
  }
  // 마지막으로 쓴 숫자 뒤의 빈칸은 적지 않는다(가운데 빈칸은 남긴다).
  cells = cells.replace(/\s+$/, '');
  if (point === null) return cells;
  // 점이 모든 숫자보다 위에 있으면 앞에 0.을 붙인다.
  if (highest === null || point > highest) return `0.${cells.replace(/^\s+/, '')}`;
  let raw = '';
  for (let column = numbers.top; column >= numbers.low; column -= 1) {
    raw += state.quotient[String(column)] ?? ' ';
    if (column === point) raw += '.';
  }
  return raw.replace(/\s+$/, '').replace(/^\s+/, '');
}

export function readDivReading(state: ColumnCalcState): DivReading {
  const numbers = divGridNumbers(state);
  const point = numbers.decimal ? state.quotientPoint : null;

  let cells = '';
  let highest: number | null = null;
  let lowest: number | null = null;
  let leadingZero = false;
  for (let column = numbers.top; column >= numbers.low; column -= 1) {
    const digit = state.quotient[String(column)] ?? null;
    cells += digit ?? ' ';
    if (digit !== null) {
      if (highest === null) highest = column;
      lowest = column;
    }
    if (column === numbers.top && digit === '0') leadingZero = true;
  }

  let quotient: Rational | null = null;
  let quotientComplete = false;
  let skippedZero = false;
  if (highest !== null && lowest !== null) {
    let digits = '';
    let fracDigits = 0;
    for (let column = highest; column >= lowest; column -= 1) {
      const digit = state.quotient[String(column)];
      if (digit === undefined) continue;
      digits += digit;
      if (point !== null && column < point) fracDigits += 1;
    }
    if (digits.length > 0) {
      quotient =
        fracDigits === 0
          ? Rational.of(BigInt(digits))
          : Rational.of(BigInt(digits), pow10Big(fracDigits));
    }

    quotientComplete = true;
    const end = numbers.decimal ? lowest : 0;
    const blanks: number[] = [];
    const filled: number[] = [];
    for (let column = highest; column >= end; column -= 1) {
      const digit = state.quotient[String(column)];
      if (digit === undefined) {
        quotientComplete = false;
        blanks.push(column);
      } else {
        filled.push(column);
      }
    }
    skippedZero = blanks.some((blank) => filled.some((column) => column < blank));
  }

  return {
    dividend: BigInt(numbers.G.digits),
    divisor: BigInt(numbers.g.digits),
    top: numbers.top,
    low: numbers.low,
    baseLow: numbers.baseLow,
    appendedZeros: numbers.appended,
    decimal: numbers.decimal,
    gridOpen: numbers.gridOpen,
    quotientPoint: point,
    quotientRaw: quotientRawOf(state, numbers, point),
    quotientCells: cells,
    quotient,
    quotientText: quotient === null ? null : quotient.toString(),
    quotientLeadingZero: leadingZero,
    quotientHighest: highest,
    quotientLowest: lowest,
    quotientComplete,
    skippedZero,
    scaledDividend: numbers.G.value,
    scaledDivisor: numbers.g.value,
    scaleA: numbers.scaleA,
    scaleB: numbers.scaleB,
    I: numbers.I,
  };
}

/** 단계로 삼을 몫 열(0이 아닌 몫 숫자)을 높은 열부터 모은다. */
export function stepColumns(state: ColumnCalcState, reading: DivReading): number[] {
  const columns: number[] = [];
  for (let column = reading.top; column >= reading.low; column -= 1) {
    const digit = state.quotient[String(column)];
    if (digit !== undefined && digit !== '0') columns.push(column);
  }
  return columns;
}

/**
 * 한 단계의 내림 칸 범위.
 *
 * decimal에서는 마지막 단계의 몫 열이 0 이하이고 그 아래에 학생이 쓴 0이
 * 없으면 내림 칸을 만들지 않는다. c > 0이면 열 0까지 내린다.
 * T047(decimal=false)은 기존 규칙 그대로다.
 */
export function bringEnd(
  state: ColumnCalcState,
  numbers: DivGridNumbers,
  column: number,
  nextStepColumn: number | null,
): number {
  if (nextStepColumn !== null) return nextStepColumn;

  if (numbers.decimal) {
    let cursor = column - 1;
    let sawZero = false;
    const floor = column > 0 ? 0 : numbers.low;
    while (cursor >= floor && state.quotient[String(cursor)] === '0') {
      sawZero = true;
      cursor -= 1;
    }
    if (sawZero) return Math.max(floor, cursor);
    if (column > 0) return 0;
    return column;
  }

  if (column <= 0) return column;
  let cursor = column - 1;
  let sawZero = false;
  while (cursor >= 0 && state.quotient[String(cursor)] === '0') {
    sawZero = true;
    cursor -= 1;
  }
  if (!sawZero) return column - 1;
  return Math.max(0, cursor);
}

function upperQuotientValue(state: ColumnCalcState, reading: DivReading, column: number): bigint {
  let text = '';
  for (let current = reading.top; current > column; current -= 1) {
    text += state.quotient[String(current)] ?? '0';
  }
  if (text.length === 0) return ZERO;
  return BigInt(text);
}

/** 배수 사다리의 현재 부분 피제수. 학생 입력에서만 계산한다. */
export function estimatePartial(
  state: ColumnCalcState,
  reading: DivReading,
  column: number,
): bigint {
  const scaled = reading.I / pow10Big(Math.max(0, column - reading.low));
  const above = upperQuotientValue(state, reading, column);
  return scaled - TEN * (reading.divisor * above);
}

/** 후보 k가 선을 넘는가(나누는 수 × k > 부분 피제수). */
export function estimateOver(
  state: ColumnCalcState,
  reading: DivReading,
  column: number,
  k: number,
): boolean {
  return reading.divisor * BigInt(k) > estimatePartial(state, reading, column);
}

export function computeDivPlan(state: ColumnCalcState): DivPlan {
  const numbers = divGridNumbers(state);
  const reading = readDivReading(state);
  const divisorDigits = numbers.g.digits.length;
  const columns = stepColumns(state, reading);
  const steps: DivStepPlan[] = [];

  let partial =
    columns.length > 0 ? reading.I / pow10Big((columns[0] as number) - reading.low) : ZERO;

  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index] as number;
    const digit = Number(state.quotient[String(column)] ?? '1');
    const product = BigInt(digit) * reading.divisor;
    const diff = partial - product;
    const nextColumn = index + 1 < columns.length ? (columns[index + 1] as number) : null;

    const productHigh = Math.min(reading.top, column + divisorDigits);
    const productColumns: number[] = [];
    for (let current = column; current <= productHigh; current += 1) productColumns.push(current);

    const diffHigh = Math.min(reading.top, column + divisorDigits);
    const diffColumns: number[] = [];
    for (let current = column; current <= diffHigh; current += 1) diffColumns.push(current);

    const end = bringEnd(state, numbers, column, nextColumn);
    const bringColumns: number[] = [];
    for (let current = column - 1; current >= end; current -= 1) bringColumns.push(current);

    const expectedProduct = expectedDigitsFor(product, productColumns);
    const expectedDiff = diff < ZERO ? null : expectedDigitsFor(diff, diffColumns);
    const expectedBring: Record<string, string> = {};
    for (const current of bringColumns) {
      expectedBring[String(current)] = gridDividendDigit(numbers, current) || '0';
    }

    const rowColumns = [...new Set([...diffColumns, ...bringColumns])].sort(
      (left, right) => left - right,
    );

    let expectedRowValue: bigint | null = null;
    if (diff >= ZERO) {
      let bringValue = 0n;
      for (const current of bringColumns) {
        bringValue = bringValue * TEN + BigInt(expectedBring[String(current)] ?? '0');
      }
      expectedRowValue = diff * pow10Big(bringColumns.length) + bringValue;
    }

    steps.push({
      column,
      digit,
      partial,
      product,
      diff,
      productColumns,
      diffColumns,
      bringColumns,
      expectedProduct,
      expectedDiff,
      expectedBring,
      rowColumns,
      expectedRowValue,
    });

    const record = state.divDiffs[String(column)];
    const studentRow = readRowValue(record, rowColumns);
    partial = studentRow ?? ZERO;
  }

  return { reading, divisorDigits, steps };
}

export interface DivStepReading {
  readonly column: number;
  readonly q: string;
  readonly product: string | null;
  readonly diff: string | null;
}

/** 단계별 학생 값(Observation `steps`). */
export function divStepReadings(state: ColumnCalcState, plan: DivPlan): DivStepReading[] {
  return plan.steps.map((step) => {
    const product = readRowValue(state.divProducts[String(step.column)], step.productColumns);
    const diff = readRowValue(state.divDiffs[String(step.column)], step.rowColumns);
    return {
      column: step.column,
      q: String(step.digit),
      product: product === null ? null : product.toString(),
      diff: diff === null ? null : diff.toString(),
    };
  });
}

/** 마지막 단계의 뺄셈 줄에서 원래 단위·격자 단위 나머지를 구한다. */
export function divRemainderDetail(
  state: ColumnCalcState,
  plan: DivPlan,
): DivRemainderDetail | null {
  const last = plan.steps[plan.steps.length - 1];
  if (last) {
    const row = readRowValue(state.divDiffs[String(last.column)], last.rowColumns);
    if (row === null) return null;
    const low = last.rowColumns[0] ?? 0;
    const gridValue = Rational.of(row).mul(pow10Rational(low));
    return {
      value: gridValue.div(pow10Rational(plan.reading.scaleA)),
      gridValue,
      low,
    };
  }
  if (plan.reading.quotientText === null) return null;
  const original = Rational.parse(state.aText);
  return {
    value: original,
    gridValue: plan.reading.scaledDividend,
    low: plan.reading.low,
  };
}

/** T047 호환: 마지막 뺄셈 줄 값(정수). */
export function divRemainder(state: ColumnCalcState, plan: DivPlan): bigint | null {
  const detail = divRemainderDetail(state, plan);
  if (!detail) return null;
  return detail.value.n;
}

/** 마지막 단계의 뺄셈 줄에서 내림 앞부분(뺀 결과) 값. 경고등 판정에 쓴다. */
export function divDiffResultValues(state: ColumnCalcState, plan: DivPlan): bigint[] {
  const values: bigint[] = [];
  for (const step of plan.steps) {
    const value = readDiffResultValue(state.divDiffs[String(step.column)], step.diffColumns);
    if (value !== null) values.push(value);
  }
  return values;
}

export function divAlarm(state: ColumnCalcState, plan: DivPlan, enabled: boolean): boolean {
  if (!enabled) return false;
  for (const step of plan.steps) {
    const value = readDiffResultValue(state.divDiffs[String(step.column)], step.diffColumns);
    if (value !== null && value >= plan.reading.divisor) return true;
  }
  return false;
}

export function divComplete(state: ColumnCalcState, plan: DivPlan): boolean {
  if (!plan.reading.quotientComplete) return false;
  if (plan.steps.length === 0) return false;
  if (plan.reading.decimal) {
    if (plan.reading.quotientLowest === null) return false;
    if (plan.reading.quotientLowest > 0) return false;
    if (plan.reading.quotientLowest < 0 && plan.reading.quotientPoint === null) return false;
  }
  for (const step of plan.steps) {
    if (!rowHasRun(state.divProducts[String(step.column)], step.productColumns)) return false;
    if (!rowHasRun(state.divDiffs[String(step.column)], step.rowColumns)) return false;
  }
  return true;
}

export function divWrongColumns(state: ColumnCalcState, plan: DivPlan): number[] {
  const wrong = new Set<number>();
  for (const step of plan.steps) {
    const product = state.divProducts[String(step.column)];
    for (const column of step.productColumns) {
      const digit = product?.[String(column)];
      const expected = step.expectedProduct[String(column)];
      if (digit !== undefined && expected !== undefined && digit !== expected) {
        wrong.add(column);
      }
    }
    const diff = state.divDiffs[String(step.column)];
    for (const column of step.rowColumns) {
      const digit = diff?.[String(column)];
      const expected = step.expectedDiff?.[String(column)] ?? step.expectedBring[String(column)];
      if (digit !== undefined && expected !== undefined && digit !== expected) {
        wrong.add(column);
      }
    }
  }
  return [...wrong].sort((left, right) => left - right);
}

export function estimateRevised(state: ColumnCalcState, plan: DivPlan): boolean {
  for (const [columnText, tries] of Object.entries(state.estimateTries)) {
    const column = Number(columnText);
    let sawOver = false;
    let overValue: number | null = null;
    for (const k of tries) {
      const over = estimateOver(state, plan.reading, column, k);
      if (over) {
        sawOver = true;
        overValue = k;
      } else if (sawOver && overValue !== null && k < overValue) {
        return true;
      }
    }
  }
  return false;
}
