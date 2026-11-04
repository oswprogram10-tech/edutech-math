/**
 * E07 나눗셈 세로셈 계산(순수 함수).
 *
 * 단계는 **학생이 쓴 몫**에서 생긴다. 정답 몫에서 만들지 않는다.
 * 몫 열 c에 0이 아닌 숫자를 쓰면 그 열에 단계가 생기고, 그 단계의 곱·뺄셈 줄
 * 기대값은 학생 몫·학생 앞 단계 값만으로 계산한다. 정답은 화면에 내보내지 않는다.
 *
 * 값은 `BigInt`로만 계산하고 상태·화면에는 문자열 자리만 둔다.
 */
import type { ColumnCalcState } from './types';

const ZERO = 0n;
const TEN = 10n;

export interface DivReading {
  /** 나누어지는 수. */
  readonly dividend: bigint;
  /** 나누는 수. */
  readonly divisor: bigint;
  /** 나누어지는 수의 맨 윗열. */
  readonly top: number;
  /** 몫 칸을 맨 윗열부터 열 0까지 그대로 읽은 문자열. 빈칸은 공백. */
  readonly quotientRaw: string;
  /** 학생 몫 값(맨 앞 0 무시). 한 칸도 없으면 null. */
  readonly quotient: bigint | null;
  readonly quotientText: string | null;
  /** 맨 윗열에 0을 썼는가. */
  readonly quotientLeadingZero: boolean;
  /** 채워진 몫 칸 중 가장 높은 열. 없으면 null. */
  readonly quotientHighest: number | null;
  /** 가장 높은 몫 칸부터 열 0까지 빈칸이 없는가. */
  readonly quotientComplete: boolean;
  /** 높은 몫 칸과 열 0 사이에 빈칸이 있는데 더 낮은 칸이 채워졌는가. */
  readonly skippedZero: boolean;
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

function absBig(value: bigint): bigint {
  return value < ZERO ? -value : value;
}

export function pow10Big(exponent: number): bigint {
  return TEN ** BigInt(exponent);
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

export function readDivReading(state: ColumnCalcState): DivReading {
  const dividend = /^\d+$/.test(state.aText) ? BigInt(state.aText) : ZERO;
  const divisor = /^\d+$/.test(state.bText) ? BigInt(state.bText) : 1n;
  const top = Math.max(0, state.aText.replace(/\D/g, '').length - 1);

  let raw = '';
  let leadingZero = false;
  let highest: number | null = null;
  for (let column = top; column >= 0; column -= 1) {
    const digit = state.quotient[String(column)] ?? null;
    raw += digit ?? ' ';
    if (digit !== null && highest === null) highest = column;
    if (column === top && digit === '0') leadingZero = true;
  }

  let quotient: bigint | null = null;
  if (highest !== null) {
    let text = '';
    for (let column = highest; column >= 0; column -= 1) {
      text += state.quotient[String(column)] ?? '';
    }
    quotient = BigInt(text.length === 0 ? '0' : text);
  }

  let quotientComplete = false;
  let skippedZero = false;
  if (highest !== null) {
    quotientComplete = true;
    const blanks: number[] = [];
    const filled: number[] = [];
    for (let column = highest; column >= 0; column -= 1) {
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
    dividend,
    divisor,
    top,
    quotientRaw: raw,
    quotient,
    quotientText: quotient === null ? null : quotient.toString(),
    quotientLeadingZero: leadingZero,
    quotientHighest: highest,
    quotientComplete,
    skippedZero,
  };
}

/** 단계로 삼을 몫 열(0이 아닌 몫 숫자)을 높은 열부터 모은다. */
export function stepColumns(state: ColumnCalcState, reading: DivReading): number[] {
  const columns: number[] = [];
  for (let column = reading.top; column >= 0; column -= 1) {
    const digit = state.quotient[String(column)];
    if (digit !== undefined && digit !== '0') columns.push(column);
  }
  return columns;
}

/**
 * 한 단계의 내림 칸 범위.
 *
 * 다음 단계가 있으면 그 몫 열까지, 없으면 바로 아래부터 이어지는 학생의 0 몫
 * 칸을 지나 한 열 더 내려간다(0 미만이면 0). 0이 없으면 `c − 1` 하나다.
 */
export function bringEnd(
  state: ColumnCalcState,
  column: number,
  nextStepColumn: number | null,
): number {
  if (column <= 0) return column;
  if (nextStepColumn !== null) return nextStepColumn;
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
  const scaled = reading.dividend / pow10Big(Math.max(0, column));
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
  const reading = readDivReading(state);
  const divisorDigits = state.bText.replace(/\D/g, '').length;
  const columns = stepColumns(state, reading);
  const steps: DivStepPlan[] = [];

  let partial = columns.length > 0 ? reading.dividend / pow10Big(columns[0] as number) : ZERO;

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

    const end = bringEnd(state, column, nextColumn);
    const bringColumns: number[] = [];
    if (column > 0) {
      for (let current = column - 1; current >= end; current -= 1) bringColumns.push(current);
    }

    const expectedProduct = expectedDigitsFor(product, productColumns);
    const expectedDiff = diff < ZERO ? null : expectedDigitsFor(diff, diffColumns);
    const expectedBring: Record<string, string> = {};
    for (const current of bringColumns) {
      expectedBring[String(current)] = state.aText.charAt(reading.top - current) || '0';
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

/** 마지막 단계의 뺄셈 줄 값. 단계가 없으면 몫을 쓴 경우 나누어지는 수. */
export function divRemainder(state: ColumnCalcState, plan: DivPlan): bigint | null {
  const last = plan.steps[plan.steps.length - 1];
  if (last) {
    return readRowValue(state.divDiffs[String(last.column)], last.rowColumns);
  }
  return plan.reading.quotientText === null ? null : plan.reading.dividend;
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
