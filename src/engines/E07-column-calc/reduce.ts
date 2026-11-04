/**
 * E07의 순수 reducer. 모든 상태 변경은 Action 하나로 기록된다.
 * 수 값은 정수 자리 계산과 `Rational`로만 다루고, 상태에는 문자열만 둔다.
 */
import { computeDivPlan, divComplete, expectedDigitsFor } from './grid-div';
import { divGridNumbers, firstQuotientColumn } from './grid-div-decimal';
import { decimalEstimate, shiftDelta, shiftFits, shiftOpOf } from './grid-decimal';
import { computeMulPlan } from './grid-mul';
import type { MulPlan } from './grid-mul';
import type {
  CellRef,
  ColumnCalcAction,
  ColumnCalcConfig,
  ColumnCalcState,
  ColumnMode,
  EditableRow,
  EstimateBar,
  EstimateTolerance,
  MulStyle,
  ShiftOp,
} from './types';
import {
  anchorOf,
  compareNumbers,
  computeGrid,
  digitAt,
  isDecimalMul,
  mostOf,
  mulAlignment,
  parseNumber,
  type ParsedNumber,
} from './grid';
import { columnCalcStrings as S } from './strings.ko';

const DEFAULT_NUMBERS: Readonly<Record<ColumnMode, { a: string; b: string }>> = {
  add: { a: '47', b: '25' },
  sub: { a: '52', b: '17' },
  decimal: { a: '3.5', b: '1.27' },
  mul: { a: '46', b: '5' },
  estimate: { a: '389', b: '412' },
  div: { a: '52', b: '4' },
};

const MODES: readonly ColumnMode[] = ['add', 'sub', 'decimal', 'mul', 'estimate', 'div'];

/** 소수 곱셈 기본 수(범위 밖 설정을 고칠 때). */
const DEFAULT_DECIMAL_MUL = { a: '2.4', b: '1.3' } as const;

/** 소수 나눗셈 기본 수(범위 밖 설정을 고칠 때). */
const DEFAULT_DIV_DECIMAL = { a: '6.24', b: '3' } as const;

function normalizeMode(value: ColumnMode | undefined): ColumnMode {
  return value !== undefined && MODES.includes(value) ? value : 'add';
}

/** 소수 나눗셈 설정인가(`div` + decimal 또는 `decimal` + div). */
function isDecimalDivConfig(mode: ColumnMode, config: ColumnCalcConfig): boolean {
  return (mode === 'div' && config.decimal === true) || (mode === 'decimal' && config.op === 'div');
}

/** 소수 나눗셈 피제수: 소수점 뺀 숫자 1~5개, 소수 자리 0~3, 0보다 크다. */
function divDecimalDividend(text: string): ParsedNumber | null {
  const parsed = parseNumber(text);
  if (!parsed) return null;
  if (parsed.digits.length < 1 || parsed.digits.length > 5) return null;
  if (parsed.fracDigits > 3) return null;
  if (BigInt(parsed.digits) <= 0n) return null;
  return parsed;
}

/** 소수 나눗셈 제수: 자연수 1~99 또는 소수 자리 1~2이고 값이 1~99인 소수. */
function divDecimalDivisor(text: string): ParsedNumber | null {
  const parsed = parseNumber(text);
  if (!parsed) return null;
  if (parsed.fracDigits > 2) return null;
  const value = BigInt(parsed.digits);
  if (value < 1n || value > 99n) return null;
  return parsed;
}

function extendLimitOf(value: number | undefined): number {
  if (value === undefined) return 2;
  if (!Number.isInteger(value) || value < 0 || value > 3) return 2;
  return value;
}

function magnifierOf(value: readonly number[] | undefined): readonly number[] {
  if (!Array.isArray(value)) return [];
  const allowed = [10, 100, 1000];
  return allowed.filter((factor) => value.includes(factor));
}

/** decimal div에서 처음 고를 몫 칸. 앞자리부터 훑어 처음 g 이상이 되는 열. */
function divDecimalSelection(state: ColumnCalcState): CellRef | null {
  if (!state.decimal) return null;
  const numbers = divGridNumbers(state);
  if (!numbers.gridOpen) return null;
  const first = firstQuotientColumn(state);
  // 몫이 1보다 작으면 0.45÷5처럼 일의 자리·소수 첫째 자리에 0을 먼저 써야 한다.
  const column = Math.max(0, first ?? 0);
  if (column < numbers.low || column > numbers.top) return null;
  return { row: 'quotient', column };
}

/** 소수 곱셈 설정 수: 소수점 뺀 숫자 1~`maxDigits`개, 소수 자리 0~3. */
function decimalMulNumber(text: string, maxDigits: number): ParsedNumber | null {
  const parsed = parseNumber(text);
  if (!parsed) return null;
  if (parsed.digits.length < 1 || parsed.digits.length > maxDigits) return null;
  if (parsed.fracDigits > 3) return null;
  return parsed;
}

function shiftDemoValue(text: string): ParsedNumber | null {
  const parsed = parseNumber(text);
  if (!parsed) return null;
  if (parsed.digits.length > 6 || parsed.fracDigits > 3) return null;
  return parsed;
}

function shiftDemoOps(values: readonly string[] | undefined): readonly ShiftOp[] {
  if (!values) return [];
  const ops: ShiftOp[] = [];
  for (const value of values) {
    const op = shiftOpOf(value);
    if (op !== null) ops.push(op);
  }
  return ops;
}

function clampResultPoint(column: number | null, high: number): number | null {
  if (column === null) return null;
  if (!Number.isInteger(column) || column < 0 || column > high) return null;
  return column;
}

function requireNumber(text: string): ParsedNumber {
  const parsed = parseNumber(text);
  if (!parsed) throw new Error(S.configError(`"${text}"는 읽을 수 없는 수입니다.`));
  return parsed;
}

/** 곱셈·어림(mul)에서 쓰는 자연수. a는 1~4자리, b는 1~2자리. */
function naturalNumber(text: string, maxDigits: number): ParsedNumber | null {
  const parsed = parseNumber(text);
  if (!parsed || parsed.fracDigits !== 0) return null;
  if (parsed.intDigits < 1 || parsed.intDigits > maxDigits) return null;
  if (BigInt(parsed.digits) <= 0n) return null;
  return parsed;
}

function sortedUnique(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function autoPad(
  state: ColumnCalcState,
  a: ParsedNumber,
  b: ParsedNumber,
): { aPads: readonly number[]; bPads: readonly number[] } {
  if (state.aPoint === null || state.bPoint === null) {
    return { aPads: state.aPads, bPads: state.bPads };
  }
  const low = Math.min(anchorOf(a, state.aPoint), anchorOf(b, state.bPoint));
  const high = Math.max(mostOf(a, state.aPoint), mostOf(b, state.bPoint));
  const aPads: number[] = [];
  const bPads: number[] = [];
  for (let column = low; column <= high; column += 1) {
    if (digitAt(a, state.aPoint, column) === null) aPads.push(column);
    if (digitAt(b, state.bPoint, column) === null) bPads.push(column);
  }
  return { aPads, bPads };
}

function withAutoPads(state: ColumnCalcState, a: ParsedNumber, b: ParsedNumber): ColumnCalcState {
  if (state.padZeros !== 'auto') return state;
  const pads = autoPad(state, a, b);
  return { ...state, aPads: pads.aPads, bPads: pads.bPads };
}

function selectionFor(state: ColumnCalcState): CellRef | null {
  const grid = computeGrid(state);
  const column = grid.requiredColumns[0] ?? grid.resultColumns[0];
  return column === undefined ? null : { row: 'result', column };
}

/** 곱셈은 첫 부분곱 줄의 일의 자리부터 오른쪽→왼쪽(낮은 자리→높은 자리)으로 쓴다. */
function mulSelection(plan: MulPlan | null): CellRef | null {
  if (!plan) return null;
  const first = plan.rows[0];
  const column = first?.columns[0];
  if (first && column !== undefined) {
    return { row: 'partial', column, index: first.index };
  }
  const low = plan.requiredColumns[0];
  return low === undefined ? null : { row: 'result', column: low };
}

function mulStyleOf(config: ColumnCalcConfig, b: ParsedNumber): MulStyle {
  if (config.style !== 'partial-products' && config.style !== 'two-rows') return 'carry';
  if (b.intDigits !== 1) return 'carry';
  return config.style === 'partial-products' ? 'partial-products' : 'carry';
}

function roundToOf(value: number | undefined): number {
  return value === 10 || value === 100 || value === 1000 ? value : 100;
}

function positiveIntegerText(value: number | string | undefined, fallback: number): string {
  if (value === undefined) return String(fallback);
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return String(fallback);
  const parsed = BigInt(text);
  return parsed > 0n ? parsed.toString() : String(fallback);
}

/** div: 1 이상 `max` 이하의 자연수만 받는다. 벗어나면 기본값. */
function boundedNaturalText(
  value: number | string | undefined,
  max: number,
  fallback: string,
): string {
  if (value === undefined) return fallback;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return fallback;
  const parsed = BigInt(text);
  if (parsed < 1n || parsed > BigInt(max)) return fallback;
  return parsed.toString();
}

function estimateBarShow(value: EstimateBar | undefined): EstimateBar['show'] {
  if (!value || value.show === false) return false;
  return value.show;
}

function estimateMaxMultiple(value: EstimateBar | undefined): number {
  const multiple = value?.maxMultiple;
  if (typeof multiple !== 'number' || !Number.isInteger(multiple)) return 9;
  return Math.min(9, Math.max(1, multiple));
}

function baseState(
  mode: ColumnMode,
  op: ColumnCalcState['op'],
  a: ParsedNumber,
  b: ParsedNumber,
  config: ColumnCalcConfig,
): ColumnCalcState {
  const style = mode === 'mul' || op === 'mul' ? mulStyleOf(config, b) : 'carry';
  return {
    mode,
    op,
    aText: a.text,
    bText: b.text,
    padZeros: config.padZeros ?? 'optional',
    aPoint: mode === 'decimal' ? null : 0,
    bPoint: mode === 'decimal' ? null : 0,
    aPads: [],
    bPads: [],
    result: {},
    carries: {},
    regroups: {},
    crosses: [],
    tens: [],
    selected: null,
    style,
    showZeroPlaceholder: config.showZeroPlaceholder ?? true,
    hasDebugSample: config.debugSample !== undefined && config.debugSample !== null,
    partials: [],
    partialCarries: [],
    flagged: [],
    rowColors: {},
    linkMarks: config.linkMarks ?? 'hint',
    linkHighlights: [],
    estimate: null,
    phase: 'estimate',
    rechecked: false,
    hasSample: false,
    roundTo: 100,
    toleranceGreen: '100',
    toleranceYellow: '200',
    quotient: {},
    divProducts: {},
    divDiffs: {},
    estimateTries: {},
    rewound: false,
    alarmEnabled: config.remainderAlarm === true,
    flagSkippedZero: config.flagSkippedZero === true,
    rewindEnabled: Boolean(config.rewindCheck),
    estimateBarShow: estimateBarShow(config.estimateBar),
    estimateMaxMultiple: estimateMaxMultiple(config.estimateBar),
    decimal: false,
    scaleA: 0,
    scaleB: 0,
    quotientPoint: null,
    extendLimit: 0,
    magnifier: [],
    allowOneSideScale: false,
    oneSideTried: false,
    resultPoint: null,
    requireEstimate: config.requireEstimate === true,
    placeCards: config.placeCards === true,
    shiftBase: null,
    shiftOps: [],
    shiftExponent: 0,
    shiftHistory: [],
    shiftHideGrid: config.shiftDemo?.hideGrid === true,
  };
}

/** 수를 일의 자리에 맞춰 오른쪽부터 쓴다. 틀린 풀이도 그대로 보이게 한다. */
function digitsAtOnes(text: string): Record<string, string> {
  const digits = text.replace(/[^0-9]/g, '');
  const record: Record<string, string> = {};
  for (let index = 0; index < digits.length; index += 1) {
    record[String(digits.length - 1 - index)] = digits[index] ?? '0';
  }
  return record;
}

function withDebugSample(state: ColumnCalcState, config: ColumnCalcConfig): ColumnCalcState {
  const sample = config.debugSample;
  if (!sample) return state;
  const plan = computeMulPlan(state);
  if (!plan) return state;
  const rows = sample.rows ?? [];
  const partials = plan.rows.map((row) => {
    const text = rows[row.index];
    if (text === undefined) return {};
    return digitsAtOnes(String(text));
  });
  const partialCarries = plan.rows.map(() => ({}));
  const sum = sample.sum === undefined ? {} : digitsAtOnes(String(sample.sum));
  return {
    ...state,
    partials,
    partialCarries,
    result: sum,
  };
}

/** 소수 나눗셈 디버그 몫 문자열을 칸과 점으로 읽는다. 형식이 안 맞으면 null. */
function decimalQuotientSample(
  state: ColumnCalcState,
  raw: string,
): { quotient: Record<string, string>; quotientPoint: number | null } | null {
  const numbers = divGridNumbers(state);
  if (!numbers.gridOpen) return null;
  const quotient: Record<string, string> = {};
  let quotientPoint: number | null = null;
  let column = numbers.top;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw.charAt(index);
    if (char === '.') {
      if (quotientPoint !== null) return null;
      // 점은 바로 앞 칸 오른쪽에 있다.
      quotientPoint = column + 1;
      if (quotientPoint > numbers.top) return null;
      continue;
    }
    if (column < numbers.low) return null;
    if (char === ' ') {
      column -= 1;
      continue;
    }
    if (!/^[0-9]$/.test(char)) return null;
    quotient[String(column)] = char;
    column -= 1;
  }
  if (column !== numbers.low - 1) return null;
  return { quotient, quotientPoint };
}

/** div 디버그 풀이: 주어진 몫으로 모든 단계 줄을 계산해 채운다. */
function withDivDebugSample(state: ColumnCalcState, config: ColumnCalcConfig): ColumnCalcState {
  const sample = config.debugSample;
  let quotient: Record<string, string>;
  let quotientPoint = state.quotientPoint;

  if (state.decimal) {
    if (sample?.quotientRaw !== undefined) {
      const parsed = decimalQuotientSample(state, String(sample.quotientRaw));
      if (!parsed) return state;
      quotient = parsed.quotient;
      quotientPoint = parsed.quotientPoint;
    } else if (sample?.quotient !== undefined) {
      const digits = String(sample.quotient).replace(/\D/g, '');
      if (digits.length === 0) return state;
      const numbers = divGridNumbers(state);
      quotient = {};
      for (let offset = 0; offset < digits.length; offset += 1) {
        const column = numbers.top - offset;
        if (column < numbers.low) break;
        quotient[String(column)] = digits.charAt(offset) ?? '0';
      }
      if (Object.keys(quotient).length === 0) return state;
    } else {
      return state;
    }
  } else {
    const quotientText = sample?.quotient;
    if (quotientText === undefined) return state;
    const digits = String(quotientText).replace(/\D/g, '');
    if (digits.length === 0) return state;
    const top = Math.max(0, state.aText.replace(/\D/g, '').length - 1);
    quotient = {};
    for (let offset = 0; offset < digits.length; offset += 1) {
      const column = digits.length - 1 - offset;
      if (column >= 0 && column <= top) quotient[String(column)] = digits.charAt(offset) ?? '0';
    }
  }

  const seeded: ColumnCalcState = { ...state, quotient, quotientPoint };
  const plan = computeDivPlan(seeded);
  const products: Record<string, Record<string, string>> = {};
  const diffs: Record<string, Record<string, string>> = {};
  let partial: bigint | null = null;
  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    if (!step) continue;
    const current: bigint = index === 0 ? step.partial : (partial ?? 0n);
    const product = step.product;
    const diff: bigint = current - product;
    products[String(step.column)] = { ...step.expectedProduct };
    const record: Record<string, string> = {};
    if (diff >= 0n) Object.assign(record, expectedDigitsFor(diff, step.diffColumns));
    Object.assign(record, step.expectedBring);
    diffs[String(step.column)] = record;

    if (diff >= 0n) {
      let bringValue = 0n;
      for (const column of step.bringColumns) {
        bringValue = bringValue * 10n + BigInt(step.expectedBring[String(column)] ?? '0');
      }
      partial = diff * 10n ** BigInt(step.bringColumns.length) + bringValue;
    } else {
      partial = null;
    }
  }
  return { ...seeded, divProducts: products, divDiffs: diffs };
}

function withEstimateSample(state: ColumnCalcState, config: ColumnCalcConfig): ColumnCalcState {
  if (config.sample === undefined || config.sample === null) return state;
  const text = String(config.sample).trim();
  if (!/^\d+$/.test(text)) return state;
  return { ...state, result: digitsAtOnes(text), hasSample: true };
}

export function createInitialState(config: ColumnCalcConfig = {}): ColumnCalcState {
  const mode = normalizeMode(config.mode);
  const defaults = DEFAULT_NUMBERS[mode];
  const rawA = String(config.a ?? defaults.a);
  const rawB = String(config.b ?? defaults.b);

  if (mode === 'mul') {
    const a = naturalNumber(rawA, 4) ?? naturalNumber(DEFAULT_NUMBERS.mul.a, 4);
    const b = naturalNumber(rawB, 2) ?? naturalNumber(DEFAULT_NUMBERS.mul.b, 2);
    if (!a || !b) throw new Error(S.configError('곱셈 기본 수를 읽을 수 없습니다.'));
    const base = withDebugSample(baseState(mode, 'mul', a, b, config), config);
    return { ...base, selected: mulSelection(computeMulPlan(base)) };
  }

  if (mode === 'div' || (mode === 'decimal' && config.op === 'div')) {
    const decimal = isDecimalDivConfig(mode, config);
    if (decimal) {
      const rawDividend = config.dividend ?? config.a;
      const rawDivisor = config.divisor ?? config.b;
      const a =
        divDecimalDividend(String(rawDividend ?? DEFAULT_DIV_DECIMAL.a)) ??
        requireNumber(DEFAULT_DIV_DECIMAL.a);
      const b =
        divDecimalDivisor(String(rawDivisor ?? DEFAULT_DIV_DECIMAL.b)) ??
        requireNumber(DEFAULT_DIV_DECIMAL.b);
      const seeded: ColumnCalcState = {
        ...baseState('div', 'div', a, b, config),
        decimal: true,
        extendLimit: extendLimitOf(config.extendZeros),
        magnifier: magnifierOf(config.magnifier),
        allowOneSideScale: config.allowOneSideScale === true,
        rewindEnabled: false,
      };
      const sampled = withDivDebugSample(seeded, config);
      return { ...sampled, selected: divDecimalSelection(sampled) };
    }
    const rawDividend = config.dividend ?? config.a;
    const rawDivisor = config.divisor ?? config.b;
    const dividendText = boundedNaturalText(rawDividend, 9999, DEFAULT_NUMBERS.div.a);
    const divisorText = boundedNaturalText(rawDivisor, 99, DEFAULT_NUMBERS.div.b);
    const a = requireNumber(dividendText);
    const b = requireNumber(divisorText);
    const base = withDivDebugSample(baseState(mode, 'div', a, b, config), config);
    return { ...base, selected: { row: 'quotient', column: a.intDigits - 1 } };
  }

  if (mode === 'estimate') {
    const op = config.op === 'sub' || config.op === 'mul' ? config.op : 'add';
    let a: ParsedNumber;
    let b: ParsedNumber;
    if (op === 'mul') {
      a = naturalNumber(rawA, 4) ?? requireNumber(DEFAULT_NUMBERS.mul.a);
      b = naturalNumber(rawB, 2) ?? requireNumber(DEFAULT_NUMBERS.mul.b);
    } else {
      a = requireNumber(rawA);
      b = requireNumber(rawB);
    }
    if (op === 'sub' && compareNumbers(a, b) < 0) {
      throw new Error(S.configError('빼는 수가 빼어지는 수보다 큽니다.'));
    }
    const roundTo = roundToOf(config.roundTo);
    const tolerance: EstimateTolerance = config.tolerance ?? {};
    const state: ColumnCalcState = {
      ...baseState(mode, op, a, b, config),
      roundTo,
      toleranceGreen: positiveIntegerText(tolerance.green, roundTo),
      toleranceYellow: positiveIntegerText(tolerance.yellow, roundTo * 2),
      phase: 'estimate',
    };
    return withEstimateSample(state, config);
  }

  const op = mode === 'decimal' ? (config.op ?? 'add') : mode;

  if (mode === 'decimal' && op === 'mul') {
    const mulA = decimalMulNumber(rawA, 4) ?? requireNumber(DEFAULT_DECIMAL_MUL.a);
    const mulB = decimalMulNumber(rawB, 3) ?? requireNumber(DEFAULT_DECIMAL_MUL.b);
    const placeCards = config.placeCards === true;
    const requireEstimate = config.requireEstimate === true;
    const shift = config.shiftDemo;
    let shiftBase: string | null = null;
    let shiftOps: readonly ShiftOp[] = [];
    if (shift && shift.value !== undefined) {
      const parsed = shiftDemoValue(String(shift.value));
      if (parsed) {
        shiftBase = parsed.text;
        shiftOps = shiftDemoOps(shift.ops);
      }
    }
    const seeded: ColumnCalcState = {
      ...baseState('decimal', 'mul', mulA, mulB, config),
      aPoint: mulA.fracDigits,
      bPoint: placeCards ? null : mulB.fracDigits,
      phase: requireEstimate ? 'estimate' : 'calc',
      requireEstimate,
      placeCards,
      shiftBase,
      shiftOps,
      shiftExponent: 0,
      shiftHistory: [],
      shiftHideGrid: shift?.hideGrid === true,
    };
    return {
      ...seeded,
      selected: mulAlignment(seeded).aligned ? mulSelection(computeMulPlan(seeded)) : null,
    };
  }

  const a = requireNumber(rawA);
  const b = requireNumber(rawB);

  if (op === 'sub' && compareNumbers(a, b) < 0) {
    throw new Error(S.configError('빼는 수가 빼어지는 수보다 큽니다.'));
  }

  const base = baseState(mode, op, a, b, config);
  if (mode === 'decimal') return base;

  const withSelection: ColumnCalcState = { ...base, selected: selectionFor(base) };
  return withAutoPads(withSelection, a, b);
}

function rowAllowed(state: ColumnCalcState, row: EditableRow, index?: number): boolean {
  if (row === 'result') return true;
  if (row === 'carry') {
    if (state.op === 'add') return true;
    if (state.op !== 'mul') return false;
    return computeMulPlan(state)?.rows.length === 0;
  }
  if (row === 'regroup') return state.op === 'sub';
  if (row === 'partial' || row === 'partial-carry') {
    if (state.op !== 'mul' || index === undefined) return false;
    const plan = computeMulPlan(state);
    const rowPlan = plan?.rows[index];
    if (!rowPlan) return false;
    if (row === 'partial') return true;
    return rowPlan.carryColumns.length > 0;
  }
  if (row === 'quotient') return state.op === 'div';
  if (row === 'div-product' || row === 'div-diff') {
    return state.op === 'div' && index !== undefined;
  }
  return false;
}

function writeDigit(
  record: Readonly<Record<string, string>>,
  column: number,
  digit: string | null,
): Record<string, string> {
  const key = String(column);
  const next: Record<string, string> = {};
  for (const [existing, value] of Object.entries(record)) {
    if (existing !== key) next[existing] = value;
  }
  if (digit !== null) next[key] = digit;
  return next;
}

function writeIndexed(
  records: readonly Readonly<Record<string, string>>[],
  index: number,
  column: number,
  digit: string | null,
): Record<string, string>[] {
  const next = records.map((record) => ({ ...record }));
  // 아직 없는 줄 index에 처음 쓸 때도 값이 사라지지 않도록 먼저 줄을 만든다.
  while (next.length <= index) next.push({});
  next[index] = writeDigit(next[index] ?? {}, column, digit);
  return next;
}

function toggleNumber(values: readonly number[], column: number): number[] {
  return values.includes(column) ? values.filter((value) => value !== column) : [...values, column];
}

/** 한 열의 값을 지운 새 레코드. */
function withoutKey<T>(record: Readonly<Record<string, T>>, column: number): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key !== String(column)) next[key] = value;
  }
  return next;
}

/** 단계별 줄에서 한 열을 지운 새 레코드. */
function withoutColumn(
  records: Readonly<Record<string, Readonly<Record<string, string>>>>,
  column: number,
): Record<string, Record<string, string>> {
  const next: Record<string, Record<string, string>> = {};
  for (const [key, record] of Object.entries(records)) {
    next[key] = withoutKey(record, column);
  }
  return next;
}

function cellOf(cell: CellRef): CellRef {
  return cell.index === undefined
    ? { row: cell.row, column: cell.column }
    : { row: cell.row, column: cell.column, index: cell.index };
}

function mulAfterEnter(state: ColumnCalcState, cell: CellRef): CellRef | null {
  const plan = computeMulPlan(state);
  if (!plan) return null;
  if (cell.row === 'partial' && cell.index !== undefined) {
    const row = plan.rows[cell.index];
    if (!row) return null;
    // 한 줄 안에서는 일의 자리 → 높은 자리로, 열린 칸을 모두 지난다.
    // 정답 자릿수에서 멈추면 커서가 답의 길이를 알려 주므로 여분 앞자리 칸도 건너뛰지 않는다.
    const higher = row.columns.filter((column) => column > cell.column);
    const nextColumn = higher[0];
    if (nextColumn !== undefined) {
      return { row: 'partial', column: nextColumn, index: row.index };
    }
    const nextRow = plan.rows[cell.index + 1];
    const nextRowColumn = nextRow?.columns[0];
    if (nextRow && nextRowColumn !== undefined) {
      return { row: 'partial', column: nextRowColumn, index: nextRow.index };
    }
    const low = plan.resultColumns[0];
    return low === undefined ? null : { row: 'result', column: low };
  }
  if (cell.row === 'result') {
    // 합 줄도 정답 자릿수가 아니라 열린 칸 전체를 따라간다.
    const higher = plan.resultColumns.filter((column) => column > cell.column);
    const nextColumn = higher[0] ?? cell.column;
    return { row: 'result', column: nextColumn };
  }
  return null;
}

function divColumnLow(state: ColumnCalcState): number {
  return state.decimal ? divGridNumbers(state).low : 0;
}

function selectDiv(
  state: ColumnCalcState,
  action: Extract<ColumnCalcAction, { type: 'select' }>,
): ColumnCalcState {
  if (state.decimal && !divGridNumbers(state).gridOpen) return state;
  const top = divGridNumbers(state).top;
  const low = divColumnLow(state);
  if (action.row === 'quotient') {
    if (action.column < low || action.column > top) return state;
    return { ...state, selected: { row: 'quotient', column: action.column } };
  }
  if (action.index === undefined) return state;
  const plan = computeDivPlan(state);
  const step = plan.steps.find((entry) => entry.column === action.index);
  if (!step) return state;
  if (action.row === 'div-product') {
    if (!step.productColumns.includes(action.column)) return state;
    return {
      ...state,
      selected: { row: 'div-product', column: action.column, index: action.index },
    };
  }
  if (action.row === 'div-diff') {
    if (!step.rowColumns.includes(action.column)) return state;
    return { ...state, selected: { row: 'div-diff', column: action.column, index: action.index } };
  }
  return state;
}

/** 교과서 순서로 커서를 옮긴다(몫 → 곱 → 뺄셈 → 내림 → 다음 몫). */
function divAfterEnter(state: ColumnCalcState, cell: CellRef): CellRef | null {
  const plan = computeDivPlan(state);
  const numbers = divGridNumbers(state);
  const decimal = state.decimal;

  if (cell.row === 'quotient') {
    const column = cell.column;
    const digit = state.quotient[String(column)];
    if (digit === undefined) return null;

    if (decimal) {
      // 위쪽 단계의 아직 안 쓴 내림 칸이 있으면 먼저 그리로 간다.
      let previous: (typeof plan.steps)[number] | undefined;
      for (const step of plan.steps) {
        if (step.column <= column) break;
        previous = step;
      }
      if (previous) {
        const record = state.divDiffs[String(previous.column)];
        const unfilled = previous.bringColumns.find(
          (bringColumn) => record?.[String(bringColumn)] === undefined,
        );
        if (unfilled !== undefined) {
          return { row: 'div-diff', column: unfilled, index: previous.column };
        }
      }
      if (digit === '0') {
        const nextColumn = column - 1;
        return nextColumn >= numbers.low ? { row: 'quotient', column: nextColumn } : null;
      }
      const step = plan.steps.find((entry) => entry.column === column);
      if (!step) return null;
      const firstProduct = step.productColumns[0];
      if (firstProduct !== undefined) {
        return { row: 'div-product', column: firstProduct, index: column };
      }
      const firstDiff = step.diffColumns[0];
      if (firstDiff !== undefined) return { row: 'div-diff', column: firstDiff, index: column };
      return null;
    }

    if (digit === '0') {
      if (column <= 0) return null;
      // 단계는 높은 열부터 정렬돼 있다. column보다 높은 단계 중 가장 가까운(열이 작은) 단계.
      let previous: (typeof plan.steps)[number] | undefined;
      for (const step of plan.steps) {
        if (step.column <= column) break;
        previous = step;
      }
      if (previous && previous.bringColumns.includes(column - 1)) {
        return { row: 'div-diff', column: column - 1, index: previous.column };
      }
      return { row: 'quotient', column: column - 1 };
    }
    const step = plan.steps.find((entry) => entry.column === column);
    if (!step) return null;
    const firstProduct = step.productColumns[0];
    if (firstProduct !== undefined) {
      return { row: 'div-product', column: firstProduct, index: column };
    }
    const firstDiff = step.diffColumns[0];
    if (firstDiff !== undefined) return { row: 'div-diff', column: firstDiff, index: column };
    return null;
  }

  if (cell.row === 'div-product' && cell.index !== undefined) {
    const step = plan.steps.find((entry) => entry.column === cell.index);
    if (!step) return null;
    const nextProduct = step.productColumns.find((column) => column > cell.column);
    if (nextProduct !== undefined) {
      return { row: 'div-product', column: nextProduct, index: cell.index };
    }
    const firstDiff = step.diffColumns[0];
    if (firstDiff !== undefined) return { row: 'div-diff', column: firstDiff, index: cell.index };
    return null;
  }

  if (cell.row === 'div-diff' && cell.index !== undefined) {
    const step = plan.steps.find((entry) => entry.column === cell.index);
    if (!step) return null;
    if (step.diffColumns.includes(cell.column)) {
      const nextDiff = step.diffColumns.find((column) => column > cell.column);
      if (nextDiff !== undefined) {
        return { row: 'div-diff', column: nextDiff, index: cell.index };
      }
      const firstBring = step.bringColumns[0];
      if (firstBring !== undefined) {
        return { row: 'div-diff', column: firstBring, index: cell.index };
      }
      // 소수: 마지막 단계가 일의 자리 이하에서 끝나면 다음 소수 자리 몫으로 간다.
      if (decimal && step.column <= 0 && step.column - 1 >= numbers.low) {
        return { row: 'quotient', column: step.column - 1 };
      }
      return null;
    }
    if (step.bringColumns.includes(cell.column)) {
      if (decimal) {
        // 내린 칸에 이미 몫 단계가 있으면 그 단계의 곱 줄부터 이어 쓴다.
        const nextStep = plan.steps.find(
          (entry) => entry.column === cell.column && entry.column !== step.column,
        );
        if (nextStep) {
          const productRecord = state.divProducts[String(nextStep.column)];
          const firstProduct = nextStep.productColumns.find(
            (column) => productRecord?.[String(column)] === undefined,
          );
          if (firstProduct !== undefined) {
            return { row: 'div-product', column: firstProduct, index: nextStep.column };
          }
          const diffRecord = state.divDiffs[String(nextStep.column)];
          const firstDiff = nextStep.diffColumns.find(
            (column) => diffRecord?.[String(column)] === undefined,
          );
          if (firstDiff !== undefined) {
            return { row: 'div-diff', column: firstDiff, index: nextStep.column };
          }
        }
      }
      const nextBring = step.bringColumns.find((column) => column < cell.column);
      if (nextBring !== undefined) {
        return { row: 'div-diff', column: nextBring, index: cell.index };
      }
      const lastBring = step.bringColumns[step.bringColumns.length - 1];
      if (lastBring !== undefined) return { row: 'quotient', column: lastBring };
      return null;
    }
  }
  return null;
}

function enterDiv(
  state: ColumnCalcState,
  action: Extract<ColumnCalcAction, { type: 'enter' }>,
): ColumnCalcState {
  if (action.digit !== null && !/^[0-9]$/.test(action.digit)) return state;
  if (state.decimal && !divGridNumbers(state).gridOpen) return state;
  const top = divGridNumbers(state).top;
  const low = divColumnLow(state);
  if (action.row === 'quotient') {
    if (action.column < low || action.column > top) return state;
    const next: ColumnCalcState = {
      ...state,
      quotient: writeDigit(state.quotient, action.column, action.digit),
      linkHighlights: [],
    };
    if (action.digit === null) {
      return { ...next, selected: { row: 'quotient', column: action.column } };
    }
    const moved = divAfterEnter(next, { row: 'quotient', column: action.column });
    return { ...next, selected: moved ?? { row: 'quotient', column: action.column } };
  }
  if (action.index === undefined) return state;
  const plan = computeDivPlan(state);
  const step = plan.steps.find((entry) => entry.column === action.index);
  if (!step) return state;

  if (action.row === 'div-product') {
    if (!step.productColumns.includes(action.column)) return state;
    const record = writeDigit(
      state.divProducts[String(action.index)] ?? {},
      action.column,
      action.digit,
    );
    const next: ColumnCalcState = {
      ...state,
      divProducts: { ...state.divProducts, [String(action.index)]: record },
      linkHighlights: [],
    };
    if (action.digit === null) {
      return {
        ...next,
        selected: { row: 'div-product', column: action.column, index: action.index },
      };
    }
    const moved = divAfterEnter(next, {
      row: 'div-product',
      column: action.column,
      index: action.index,
    });
    return {
      ...next,
      selected: moved ?? { row: 'div-product', column: action.column, index: action.index },
    };
  }

  if (action.row === 'div-diff') {
    if (!step.rowColumns.includes(action.column)) return state;
    const record = writeDigit(
      state.divDiffs[String(action.index)] ?? {},
      action.column,
      action.digit,
    );
    const next: ColumnCalcState = {
      ...state,
      divDiffs: { ...state.divDiffs, [String(action.index)]: record },
      linkHighlights: [],
    };
    if (action.digit === null) {
      return { ...next, selected: { row: 'div-diff', column: action.column, index: action.index } };
    }
    const moved = divAfterEnter(next, {
      row: 'div-diff',
      column: action.column,
      index: action.index,
    });
    return {
      ...next,
      selected: moved ?? { row: 'div-diff', column: action.column, index: action.index },
    };
  }
  return state;
}

export function reduce(state: ColumnCalcState, action: ColumnCalcAction): ColumnCalcState {
  if (state.mode === 'estimate' && state.phase === 'estimate') {
    if (action.type === 'enter-estimate') return enterEstimate(state, action);
    if (action.type === 'lock-estimate') return lockEstimate(state);
    if (action.type === 'enter' || action.type === 'select' || action.type === 'flag-cell') {
      return state;
    }
  }

  switch (action.type) {
    case 'place': {
      if (state.mode !== 'decimal') return state;
      // 소수 곱셈은 b 카드만, placeCards일 때만 놓는다.
      if (isDecimalMul(state) && (!state.placeCards || action.number !== 'b')) return state;
      if (!Number.isInteger(action.pointColumn)) return state;
      if (action.pointColumn < -20 || action.pointColumn > 12) return state;
      if (action.number === 'a' && state.aPoint === action.pointColumn) return state;
      if (action.number === 'b' && state.bPoint === action.pointColumn) return state;

      const a = requireNumber(state.aText);
      const b = requireNumber(state.bText);
      // 카드를 옮기면 앞서 쓴 결과·표시는 새 자리와 맞지 않으므로 비운다.
      const placed: ColumnCalcState = {
        ...state,
        aPoint: action.number === 'a' ? action.pointColumn : state.aPoint,
        bPoint: action.number === 'b' ? action.pointColumn : state.bPoint,
        aPads: [],
        bPads: [],
        result: {},
        resultPoint: null,
        carries: {},
        regroups: {},
        crosses: [],
        tens: [],
        selected: null,
      };
      const padded = withAutoPads(placed, a, b);
      if (isDecimalMul(padded)) {
        return {
          ...padded,
          selected: mulAlignment(padded).aligned ? mulSelection(computeMulPlan(padded)) : null,
        };
      }
      return padded.aPoint !== null && padded.bPoint !== null
        ? { ...padded, selected: selectionFor(padded) }
        : padded;
    }

    case 'select': {
      if (isDecimalMul(state) && !mulAlignment(state).aligned) return state;
      if (!rowAllowed(state, action.row, action.index)) return state;
      if (state.op === 'div') return selectDiv(state, action);
      const grid = computeGrid(state);
      if (action.row === 'result') {
        if (!grid.resultColumns.includes(action.column)) return state;
        return { ...state, selected: { row: 'result', column: action.column } };
      }
      if (action.column < grid.low || action.column > grid.high) return state;
      if (action.row === 'partial' || action.row === 'partial-carry') {
        const plan = computeMulPlan(state);
        const row = action.index === undefined ? undefined : plan?.rows[action.index];
        if (!row) return state;
        if (action.row === 'partial' && !row.columns.includes(action.column)) return state;
        if (action.row === 'partial-carry' && !row.carryColumns.includes(action.column)) {
          return state;
        }
        return {
          ...state,
          selected: { row: action.row, column: action.column, index: action.index },
        };
      }
      return { ...state, selected: { row: action.row, column: action.column } };
    }

    case 'enter': {
      if (isDecimalMul(state) && !mulAlignment(state).aligned) return state;
      if (!rowAllowed(state, action.row, action.index)) return state;
      if (action.digit !== null && !/^[0-9]$/.test(action.digit)) return state;
      if (state.op === 'div') return enterDiv(state, action);
      const grid = computeGrid(state);
      if (action.row === 'result' && !grid.resultColumns.includes(action.column)) return state;
      if (action.column < grid.low || action.column > grid.high) return state;

      let next: ColumnCalcState;
      if (action.row === 'result') {
        next = { ...state, result: writeDigit(state.result, action.column, action.digit) };
        if (action.digit !== null) {
          if (state.op === 'mul') {
            const moved = mulAfterEnter(next, { row: 'result', column: action.column });
            next = { ...next, selected: moved ?? { row: 'result', column: action.column } };
          } else {
            const ahead = grid.requiredColumns.find((column) => column > action.column);
            next = {
              ...next,
              selected: { row: 'result', column: ahead ?? action.column },
            };
          }
        } else {
          next = { ...next, selected: { row: 'result', column: action.column } };
        }
      } else if (action.row === 'carry') {
        next = {
          ...state,
          carries: writeDigit(state.carries, action.column, action.digit),
          selected: { row: 'carry', column: action.column },
        };
      } else if (action.row === 'regroup') {
        next = {
          ...state,
          regroups: writeDigit(state.regroups, action.column, action.digit),
          selected: { row: 'regroup', column: action.column },
        };
      } else if (action.row === 'partial' && action.index !== undefined) {
        const plan = computeMulPlan(state);
        const row = plan?.rows[action.index];
        if (!row || !row.columns.includes(action.column)) return state;
        next = {
          ...state,
          partials: writeIndexed(state.partials, action.index, action.column, action.digit),
          selected: { row: 'partial', column: action.column, index: action.index },
        };
        if (action.digit !== null) {
          const moved = mulAfterEnter(next, {
            row: 'partial',
            column: action.column,
            index: action.index,
          });
          if (moved) next = { ...next, selected: cellOf(moved) };
        }
      } else if (action.row === 'partial-carry' && action.index !== undefined) {
        const plan = computeMulPlan(state);
        const row = plan?.rows[action.index];
        if (!row || !row.carryColumns.includes(action.column)) return state;
        next = {
          ...state,
          partialCarries: writeIndexed(
            state.partialCarries,
            action.index,
            action.column,
            action.digit,
          ),
          selected: { row: 'partial-carry', column: action.column, index: action.index },
        };
      } else {
        return state;
      }

      // 연결 강조는 다음 입력에서 지운다.
      return next.linkHighlights.length > 0 ? { ...next, linkHighlights: [] } : next;
    }

    case 'pad-zero': {
      if (state.padZeros === 'off') return state;

      if (state.op === 'div') {
        if (!state.decimal || action.number !== 'a') return state;
        const numbers = divGridNumbers(state);
        if (!numbers.gridOpen) return state;
        if (action.column === numbers.low - 1) {
          if (numbers.appended >= state.extendLimit) return state;
          return { ...state, aPads: sortedUnique([...state.aPads, action.column]) };
        }
        if (action.column === numbers.low && numbers.appended > 0) {
          const removed = action.column;
          return {
            ...state,
            aPads: state.aPads.filter((column) => column !== removed),
            quotient: withoutKey(state.quotient, removed),
            divProducts: withoutColumn(state.divProducts, removed),
            divDiffs: withoutColumn(state.divDiffs, removed),
            estimateTries: withoutKey(state.estimateTries, removed),
            quotientPoint: state.quotientPoint === removed ? null : state.quotientPoint,
            flagged: state.flagged.filter((cell) => cell.column !== removed),
            selected: state.selected?.column === removed ? null : state.selected,
          };
        }
        return state;
      }

      if (state.mode !== 'decimal') return state;
      if (state.aPoint === null || state.bPoint === null) return state;
      const a = requireNumber(state.aText);
      const b = requireNumber(state.bText);
      const low = Math.min(anchorOf(a, state.aPoint), anchorOf(b, state.bPoint));
      const high = Math.max(mostOf(a, state.aPoint), mostOf(b, state.bPoint));
      if (action.column < low || action.column > high) return state;

      const parsed = action.number === 'a' ? a : b;
      const point = action.number === 'a' ? state.aPoint : state.bPoint;
      const pads = action.number === 'a' ? state.aPads : state.bPads;
      if (digitAt(parsed, point, action.column, pads) !== null) return state;
      if (state.padZeros === 'auto') return state;

      return action.number === 'a'
        ? { ...state, aPads: sortedUnique([...state.aPads, action.column]) }
        : { ...state, bPads: sortedUnique([...state.bPads, action.column]) };
    }

    case 'toggle-cross': {
      if (state.op !== 'sub') return state;
      return { ...state, crosses: toggleNumber(state.crosses, action.column) };
    }

    case 'toggle-ten': {
      if (state.op !== 'sub') return state;
      return { ...state, tens: toggleNumber(state.tens, action.column) };
    }

    case 'flag-cell': {
      if (state.op !== 'mul' && state.op !== 'div') return state;
      const match = (cell: CellRef): boolean =>
        cell.row === action.row && cell.column === action.column && cell.index === action.index;
      const exists = state.flagged.some(match);
      const base = {
        row: action.row,
        column: action.column,
        ...(action.index === undefined ? {} : { index: action.index }),
      };
      const flagged = exists
        ? state.flagged.filter((cell) => !match(cell))
        : [...state.flagged, base];
      return { ...state, flagged };
    }

    case 'link-mark': {
      let carries = state.carries;
      let regroups = state.regroups;
      let quotient = state.quotient;
      for (const value of action.fill) {
        if (value.kind === 'carry') {
          if (carries[String(value.column)] === undefined) {
            carries = { ...carries, [String(value.column)]: value.digit };
          }
        } else if (value.kind === 'regroup') {
          regroups = { ...regroups, [String(value.column)]: value.digit };
        } else if (state.op === 'div') {
          quotient = { ...quotient, [String(value.column)]: value.digit };
        }
      }
      return {
        ...state,
        carries,
        regroups,
        quotient,
        crosses: sortedUnique([...state.crosses, ...action.crosses]),
        tens: sortedUnique([...state.tens, ...action.tens]),
        linkHighlights: action.marks.map((mark) => `${mark.kind}:${mark.column}`),
      };
    }

    case 'link-colors': {
      return { ...state, rowColors: { ...action.colors } };
    }

    case 'enter-estimate': {
      if (isDecimalMul(state)) {
        if (state.phase !== 'estimate') return state;
        return enterDecimalEstimate(state, action);
      }
      if (state.mode !== 'estimate' || state.phase !== 'estimate') return state;
      return enterEstimate(state, action);
    }

    case 'lock-estimate': {
      if (isDecimalMul(state)) {
        if (state.phase !== 'estimate' || decimalEstimate(state) === null) return state;
        const next: ColumnCalcState = { ...state, phase: 'calc' };
        return {
          ...next,
          selected: mulAlignment(next).aligned ? mulSelection(computeMulPlan(next)) : null,
        };
      }
      if (state.mode !== 'estimate') return state;
      return lockEstimate(state);
    }

    case 'unlock-estimate': {
      if (isDecimalMul(state)) {
        if (state.phase !== 'calc') return state;
        // 놓은 점은 그대로 둔다(T077 결정 5).
        return { ...state, phase: 'estimate', selected: null };
      }
      if (state.mode !== 'estimate' || state.phase !== 'calc') return state;
      return { ...state, phase: 'estimate', selected: null };
    }

    case 'recheck': {
      if (state.mode !== 'estimate' || !state.hasSample) return state;
      return {
        ...state,
        rechecked: true,
        result: {},
        selected:
          state.op === 'mul'
            ? mulSelection(computeMulPlan(state))
            : selectionFor({ ...state, result: {} }),
      };
    }

    case 'try-estimate': {
      if (state.op !== 'div') return state;
      const numbers = divGridNumbers(state);
      if (state.decimal && !numbers.gridOpen) return state;
      const low = state.decimal ? numbers.low : 0;
      if (!Number.isInteger(action.column) || action.column < low || action.column > numbers.top) {
        return state;
      }
      if (!Number.isInteger(action.k) || action.k < 1 || action.k > state.estimateMaxMultiple) {
        return state;
      }
      const previous = state.estimateTries[String(action.column)] ?? [];
      return {
        ...state,
        estimateTries: {
          ...state.estimateTries,
          [String(action.column)]: [...previous, action.k],
        },
      };
    }

    case 'rewind': {
      if (state.op !== 'div' || !state.rewindEnabled) return state;
      if (state.rewound) return state;
      if (!divComplete(state, computeDivPlan(state))) return state;
      return { ...state, rewound: true };
    }

    case 'place-point': {
      if (action.target === 'quotient') {
        if (state.op !== 'div' || !state.decimal) return state;
        const numbers = divGridNumbers(state);
        if (!numbers.gridOpen) return state;
        if (action.column === null) {
          return state.quotientPoint === null ? state : { ...state, quotientPoint: null };
        }
        if (
          !Number.isInteger(action.column) ||
          action.column < numbers.low ||
          action.column > numbers.top
        ) {
          return state;
        }
        // 같은 자리를 다시 누르면 지운다.
        const next = state.quotientPoint === action.column ? null : action.column;
        return { ...state, quotientPoint: next };
      }
      if (!isDecimalMul(state) || action.target !== 'result') return state;
      if (state.requireEstimate && state.phase === 'estimate') return state;
      // 바른 정렬 전에는 부분곱·결과 칸과 마찬가지로 점도 놓지 않는다.
      if (!mulAlignment(state).aligned) return state;
      const plan = computeMulPlan(state);
      if (!plan) return state;
      const high = plan.resultColumns[plan.resultColumns.length - 1] ?? 0;
      const requested = action.column === null ? null : clampResultPoint(action.column, high);
      if (action.column !== null && requested === null) return state;
      // 같은 자리를 다시 누르면 지운다.
      const next = requested !== null && state.resultPoint === requested ? null : requested;
      return { ...state, resultPoint: next };
    }

    case 'scale': {
      if (state.op !== 'div' || !state.decimal) return state;
      if (!Number.isInteger(action.to) || action.to < 0 || action.to > 3) return state;
      const scaleA =
        action.side === 'both' || action.side === 'dividend' ? action.to : state.scaleA;
      const scaleB = action.side === 'both' || action.side === 'divisor' ? action.to : state.scaleB;
      if (scaleA === state.scaleA && scaleB === state.scaleB) return state;
      // 격자 수가 바뀌면 이전 칸은 새 수와 맞지 않으므로 모두 비운다.
      return {
        ...state,
        scaleA,
        scaleB,
        oneSideTried: state.oneSideTried || action.side !== 'both',
        quotient: {},
        divProducts: {},
        divDiffs: {},
        estimateTries: {},
        aPads: [],
        quotientPoint: null,
        flagged: [],
        selected: null,
        rewound: false,
      };
    }

    case 'shift': {
      if (state.shiftBase === null || !state.shiftOps.includes(action.op)) return state;
      if (!shiftFits(state, action.op)) return state;
      return {
        ...state,
        shiftExponent: state.shiftExponent + shiftDelta(action.op),
        shiftHistory: [...state.shiftHistory, action.op],
      };
    }

    case 'shift-reset': {
      if (state.shiftBase === null) return state;
      if (state.shiftExponent === 0) return state;
      // 기록은 남기고 처음 자리로 돌아간다.
      return { ...state, shiftExponent: 0 };
    }

    default:
      return state;
  }
}

/** 소수 곱셈 어림 입력: 숫자와 소수점 하나를 받는다. */
function enterDecimalEstimate(
  state: ColumnCalcState,
  action: Extract<ColumnCalcAction, { type: 'enter-estimate' }>,
): ColumnCalcState {
  if (action.digit === null) {
    if (state.estimate === null || state.estimate.length === 0) return state;
    const next = state.estimate.slice(0, -1);
    return { ...state, estimate: next.length === 0 ? null : next };
  }
  if (action.digit !== '.' && !/^[0-9]$/.test(action.digit)) return state;
  const current = state.estimate ?? '';
  const candidate = `${current}${action.digit}`;
  // 입력 중에는 잠정 형식을 허용한다(정하기에서 최종 검사).
  if (!/^\d{0,4}(\.\d{0,3})?$/.test(candidate)) return state;
  return { ...state, estimate: candidate };
}

function enterEstimate(
  state: ColumnCalcState,
  action: Extract<ColumnCalcAction, { type: 'enter-estimate' }>,
): ColumnCalcState {
  if (action.digit === null) {
    if (state.estimate === null || state.estimate.length === 0) return state;
    const next = state.estimate.slice(0, -1);
    return { ...state, estimate: next.length === 0 ? null : next };
  }
  if (!/^[0-9]$/.test(action.digit)) return state;
  const current = state.estimate ?? '';
  if (current.length >= 6) return state;
  return { ...state, estimate: `${current}${action.digit}` };
}

function lockEstimate(state: ColumnCalcState): ColumnCalcState {
  if (state.mode !== 'estimate' || state.phase !== 'estimate') return state;
  if (state.estimate === null || !/^\d{1,6}$/.test(state.estimate)) return state;
  return {
    ...state,
    phase: 'calc',
    selected: state.op === 'mul' ? mulSelection(computeMulPlan(state)) : selectionFor(state),
  };
}
