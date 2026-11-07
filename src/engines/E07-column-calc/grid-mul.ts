/**
 * E07 곱셈 격자의 부분곱 줄 계산(순수 함수).
 *
 * - `carry`: b의 자리마다 부분곱 줄을 만들고, 둘째 줄부터는 자리만큼 왼쪽으로 민다.
 * - `partial-products`: b가 한 자리일 때 a의 0이 아닌 자리마다 부분곱 줄을 만든다.
 *
 * 값은 `BigInt`로만 계산하고, 화면·상태에는 문자열 자리만 둔다.
 * 기대값(정답)은 Observation·힌트에 숫자로 내보내지 않는다.
 */
import { isDecimalMul, parseNumber } from './grid';
import type { ColumnCalcState, MulStyle } from './types';

/**
 * 한 부분곱 줄.
 *
 * `value`는 곱한 값 그대로(예: 46×7 → 322), `shift`는 그 값이 놓이는 자리 수,
 * `shiftedValue`는 자리를 민 실제 기여값(예: 322×10 = 3220)이다.
 * `start`~`end`가 학생이 채워야 하는 열이고, `placeholderColumns`는
 * 자리 밀기 때문에 0으로 미리 채우는 열(수정 불가)이다.
 */
export interface MulRowPlan {
  readonly index: number;
  readonly factor: number;
  readonly shift: number;
  readonly value: bigint;
  readonly shiftedValue: bigint;
  readonly start: number;
  readonly end: number;
  readonly columns: readonly number[];
  readonly placeholderColumns: readonly number[];
  /** 열 → 기대 숫자. `start`~`end`만 담는다. */
  readonly expectedDigits: Readonly<Record<string, string>>;
  /** 열 → 기대 받아올림 숫자. */
  readonly expectedCarries: Readonly<Record<string, string>>;
  readonly carryColumns: readonly number[];
}

export interface MulPlan {
  readonly aText: string;
  readonly bText: string;
  readonly a: bigint;
  readonly b: bigint;
  readonly product: bigint;
  readonly productDigits: string;
  readonly style: MulStyle;
  readonly singleDigit: boolean;
  readonly showZeroPlaceholder: boolean;
  readonly rows: readonly MulRowPlan[];
  readonly resultColumns: readonly number[];
  readonly requiredColumns: readonly number[];
  readonly low: number;
  readonly high: number;
}

function range(low: number, high: number): number[] {
  const values: number[] = [];
  for (let column = low; column <= high; column += 1) values.push(column);
  return values;
}

/** `"0322"` 같은 값에서 앞의 0을 지운다. `"0"`은 그대로 둔다. */
export function normalizeDigits(text: string): string {
  const trimmed = text.replace(/^0+(?=\d)/, '');
  return trimmed.length === 0 ? '0' : trimmed;
}

function carryRow(
  index: number,
  aDigits: string,
  factor: number,
  shift: number,
  value: bigint,
  start: number,
  end: number,
  columns: readonly number[],
  placeholderColumns: readonly number[],
): MulRowPlan {
  const digits = value.toString();
  const expectedDigits: Record<string, string> = {};
  for (let offset = 0; offset < digits.length; offset += 1) {
    const column = shift + (digits.length - 1 - offset);
    expectedDigits[String(column)] = digits[offset] ?? '0';
  }

  const expectedCarries: Record<string, string> = {};
  const carryColumns: number[] = [];
  let carryIn = 0;
  for (let place = 0; place < aDigits.length; place += 1) {
    const topDigit = Number(aDigits[aDigits.length - 1 - place] ?? '0');
    const product = topDigit * factor + carryIn;
    const carryOut = Math.floor(product / 10);
    if (carryOut > 0) {
      const column = place + 1 + shift;
      expectedCarries[String(column)] = String(carryOut);
      carryColumns.push(column);
    }
    carryIn = carryOut;
  }

  return {
    index,
    factor,
    shift,
    value,
    shiftedValue: value * 10n ** BigInt(shift),
    start,
    end,
    columns,
    placeholderColumns,
    expectedDigits,
    expectedCarries,
    carryColumns,
  };
}

function placeProductRow(
  index: number,
  factor: number,
  place: number,
  b: bigint,
  bIntDigits: number,
): MulRowPlan {
  const value = BigInt(factor) * b * 10n ** BigInt(place);
  const digits = value.toString();
  const start = 0;
  // 그 자리 곱의 최대 자릿수(한 자리 × b → b 자릿수 + 1)만큼 연다. 자리 밀기 포함.
  const end = place + bIntDigits;
  const expectedDigits: Record<string, string> = {};
  for (let offset = 0; offset < digits.length; offset += 1) {
    // 자리 밀기(end)가 아니라 값의 실제 자리에 놓는다(23×4의 80 → 십·일).
    expectedDigits[String(digits.length - 1 - offset)] = digits[offset] ?? '0';
  }
  return {
    index,
    factor,
    shift: 0,
    value,
    shiftedValue: value,
    start,
    end,
    columns: range(0, end),
    placeholderColumns: [],
    expectedDigits,
    expectedCarries: {},
    carryColumns: [],
  };
}

/** 설정·상태에서 곱셈 줄 계획을 만든다. 읽을 수 없는 수면 null. */
export function computeMulPlan(state: ColumnCalcState): MulPlan | null {
  const a = parseNumber(state.aText);
  const b = parseNumber(state.bText);
  const decimalMul = isDecimalMul(state);
  if (!a || !b) return null;
  if (!decimalMul && (a.fracDigits !== 0 || b.fracDigits !== 0)) return null;

  // 소수 곱셈은 소수점을 뺀 숫자열을 자연수로 보고 오른쪽 끝을 맞춘다.
  // 앞의 0은 격자 값에 영향을 주지 않으므로 지운다(0.25 → 25).
  const aDigits = decimalMul ? normalizeDigits(a.digits) : a.digits;
  const bDigits = decimalMul ? normalizeDigits(b.digits) : b.digits;
  const aLength = aDigits.length;
  const bLength = bDigits.length;

  const aValue = BigInt(aDigits);
  const bValue = BigInt(bDigits);
  const product = aValue * bValue;
  const productDigits = product.toString();
  const singleDigit = bLength === 1;
  const style: MulStyle = decimalMul
    ? 'carry'
    : state.style === 'partial-products' && !singleDigit
      ? 'carry'
      : state.style;
  const showZeroPlaceholder = !decimalMul && state.showZeroPlaceholder && !state.hasDebugSample;
  const rows: MulRowPlan[] = [];

  if (style === 'carry') {
    if (!singleDigit) {
      for (let place = 0; place < bLength; place += 1) {
        const factor = Number(bDigits[bLength - 1 - place] ?? '0');
        const value = aValue * BigInt(factor);
        const start = place;
        // 정답 자릿수가 아니라 그 줄이 가질 수 있는 최대 자릿수(a 자릿수 + 1)만큼 연다.
        const end = place + aDigits.length;
        const placeholderColumns = showZeroPlaceholder && place > 0 ? range(0, place - 1) : [];
        const columns = range(0, end).filter((column) => !placeholderColumns.includes(column));
        rows.push(
          carryRow(place, aDigits, factor, place, value, start, end, columns, placeholderColumns),
        );
      }
    }
  } else {
    for (let place = 0; place < aLength; place += 1) {
      const factor = Number(aDigits[aLength - 1 - place] ?? '0');
      if (factor === 0) continue;
      rows.push(placeProductRow(rows.length, factor, place, bValue, bLength));
    }
  }

  const rowHigh = rows.reduce((high, row) => Math.max(high, row.end), 0);
  // 합 줄도 a·b 자릿수 합만큼 연다(정답 자릿수에 맞추지 않는다).
  // 소수 곱셈은 앞에 0을 써야 하는 경우(0.25 × 0.4의 0.100)까지 연다.
  const resultHigh = decimalMul
    ? Math.max(aLength + bLength - 1, a.fracDigits + b.fracDigits)
    : aLength + bLength - 1;
  const displayHigh = decimalMul ? Math.max(a.digits.length - 1, b.digits.length - 1) : 0;
  const high = Math.max(aLength, bLength, productDigits.length, rowHigh, resultHigh, displayHigh);
  const requiredColumns = range(0, productDigits.length - 1);
  const resultColumns = range(0, resultHigh);

  return {
    aText: decimalMul ? aDigits : state.aText,
    bText: decimalMul ? bDigits : state.bText,
    a: aValue,
    b: bValue,
    product,
    productDigits,
    style,
    singleDigit,
    showZeroPlaceholder,
    rows,
    resultColumns,
    requiredColumns,
    low: 0,
    high,
  };
}

function digitOf(
  record: Readonly<Record<string, string>> | undefined,
  column: number,
): string | null {
  const value = record?.[String(column)];
  return value !== undefined && /^[0-9]$/.test(value) ? value : null;
}

/**
 * 부분곱 줄 값을 읽는다. 가장 높은 칸부터 일의 자리(0)까지 빈칸은 0으로 읽는다.
 * 아무것도 쓰지 않았으면 null.
 */
export function readRowValue(state: ColumnCalcState, row: MulRowPlan): string | null {
  const record = state.partials[row.index];
  let highest = -1;
  for (let column = 0; column <= row.end; column += 1) {
    if (digitOf(record, column) !== null) highest = column;
  }
  if (highest < 0) return null;
  let text = '';
  for (let column = highest; column >= 0; column -= 1) {
    text += digitOf(record, column) ?? '0';
  }
  return normalizeDigits(text);
}

/** 합 줄 값을 읽는다(가장 높은 칸부터 일의 자리까지, 빈칸은 0). */
export function readSumValue(state: ColumnCalcState, plan: MulPlan): string | null {
  let highest = -1;
  for (const column of plan.resultColumns) {
    if (state.result[String(column)] !== undefined) highest = Math.max(highest, column);
  }
  if (highest < 0) return null;
  let text = '';
  for (let column = highest; column >= 0; column -= 1) {
    text += state.result[String(column)] ?? '0';
  }
  return normalizeDigits(text);
}

/** 줄마다 하나도 안 썼으면 null, 쓰였으면 정규화한 값. */
export function partialValues(state: ColumnCalcState, plan: MulPlan): (string | null)[] {
  return plan.rows.map((row) => readRowValue(state, row));
}

/**
 * 부분곱 줄을 다 채웠는가. 자리 밀기로 비는 낮은 열은 비어 있거나 0이면 되고,
 * 최대 자릿수만큼 열어 둔 앞자리 빈칸도 0으로 읽으므로 채우지 않아도 된다.
 */
export function rowsComplete(state: ColumnCalcState, plan: MulPlan): boolean {
  return plan.rows.every((row) => {
    const record = state.partials[row.index];
    for (const key of Object.keys(row.expectedDigits)) {
      if (digitOf(record, Number(key)) === null) return false;
    }
    for (let column = 0; column < row.start; column += 1) {
      const digit = digitOf(record, column);
      if (digit !== null && digit !== '0') return false;
    }
    return true;
  });
}

/** `showZeroPlaceholder`로 미리 채우는 0인가. 화면이 점선 칸으로 그린다. */
export function isPlaceholder(row: MulRowPlan, column: number): boolean {
  return row.placeholderColumns.includes(column);
}

/** 받아올림 줄이 있는 줄인가(자리마다 올림 칸을 그린다). */
export function hasCarryRow(row: MulRowPlan): boolean {
  return row.carryColumns.length > 0 || row.expectedCarries !== undefined;
}
