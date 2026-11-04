/**
 * E07 곱셈 격자의 부분곱 줄 계산(순수 함수).
 *
 * - `carry`: b의 자리마다 부분곱 줄을 만들고, 둘째 줄부터는 자리만큼 왼쪽으로 민다.
 * - `partial-products`: b가 한 자리일 때 a의 0이 아닌 자리마다 부분곱 줄을 만든다.
 *
 * 값은 `BigInt`로만 계산하고, 화면·상태에는 문자열 자리만 둔다.
 * 기대값(정답)은 Observation·힌트에 숫자로 내보내지 않는다.
 */
import { parseNumber } from './grid';
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

function placeProductRow(index: number, factor: number, place: number, b: bigint): MulRowPlan {
  const value = BigInt(factor) * b * 10n ** BigInt(place);
  const digits = value.toString();
  const start = 0;
  const end = digits.length - 1;
  const expectedDigits: Record<string, string> = {};
  for (let offset = 0; offset < digits.length; offset += 1) {
    expectedDigits[String(end - offset)] = digits[offset] ?? '0';
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
  if (!a || !b || a.fracDigits !== 0 || b.fracDigits !== 0) return null;

  const aValue = BigInt(a.digits);
  const bValue = BigInt(b.digits);
  const product = aValue * bValue;
  const productDigits = product.toString();
  const singleDigit = b.intDigits === 1;
  const style: MulStyle =
    state.style === 'partial-products' && !singleDigit ? 'carry' : state.style;
  const showZeroPlaceholder = state.showZeroPlaceholder && !state.hasDebugSample;
  const rows: MulRowPlan[] = [];

  if (style === 'carry') {
    if (!singleDigit) {
      for (let place = 0; place < b.intDigits; place += 1) {
        const factor = Number(b.digits[b.intDigits - 1 - place] ?? '0');
        const value = aValue * BigInt(factor);
        const digits = value.toString();
        const start = place;
        const end = place + digits.length - 1;
        const placeholderColumns = showZeroPlaceholder && place > 0 ? range(0, place - 1) : [];
        const columns = range(0, end).filter((column) => !placeholderColumns.includes(column));
        rows.push(
          carryRow(place, a.digits, factor, place, value, start, end, columns, placeholderColumns),
        );
      }
    }
  } else {
    for (let place = 0; place < a.intDigits; place += 1) {
      const factor = Number(a.digits[a.intDigits - 1 - place] ?? '0');
      if (factor === 0) continue;
      rows.push(placeProductRow(rows.length, factor, place, bValue));
    }
  }

  const aLength = a.intDigits;
  const bLength = b.intDigits;
  const rowHigh = rows.reduce((high, row) => Math.max(high, row.end), 0);
  const high = Math.max(aLength, bLength, productDigits.length, rowHigh);
  const requiredColumns = range(0, productDigits.length - 1);
  // 합 줄은 참값보다 한 칸 더 쓸 수 있다(틀린 풀이도 그대로 보이게).
  const resultColumns = range(0, productDigits.length);

  return {
    aText: state.aText,
    bText: state.bText,
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

/** 부분곱 줄을 다 채웠는가. 자리 밀기로 비는 낮은 열은 비어 있거나 0이면 된다. */
export function rowsComplete(state: ColumnCalcState, plan: MulPlan): boolean {
  return plan.rows.every((row) => {
    const record = state.partials[row.index];
    for (let column = row.start; column <= row.end; column += 1) {
      if (digitOf(record, column) === null) return false;
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
