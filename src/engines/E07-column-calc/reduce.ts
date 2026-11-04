/**
 * E07의 순수 reducer. 모든 상태 변경은 Action 하나로 기록된다.
 * 수 값은 정수 자리 계산과 `Rational`로만 다루고, 상태에는 문자열만 둔다.
 */
import { computeMulPlan } from './grid-mul';
import type { MulPlan } from './grid-mul';
import type {
  CellRef,
  ColumnCalcAction,
  ColumnCalcConfig,
  ColumnCalcState,
  ColumnMode,
  EditableRow,
  EstimateTolerance,
  MulStyle,
} from './types';
import {
  anchorOf,
  compareNumbers,
  computeGrid,
  digitAt,
  mostOf,
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
};

const MODES: readonly ColumnMode[] = ['add', 'sub', 'decimal', 'mul', 'estimate'];

function normalizeMode(value: ColumnMode | undefined): ColumnMode {
  return value !== undefined && MODES.includes(value) ? value : 'add';
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

  const a = requireNumber(rawA);
  const b = requireNumber(rawB);
  const op = mode === 'decimal' ? (config.op ?? 'add') : mode;

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
    // 한 줄 안에서는 일의 자리 → 높은 자리로 간다.
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
    const low = plan.requiredColumns[0];
    return low === undefined ? null : { row: 'result', column: low };
  }
  if (cell.row === 'result') {
    const higher = plan.requiredColumns.filter((column) => column > cell.column);
    const nextColumn = higher[0] ?? cell.column;
    return { row: 'result', column: nextColumn };
  }
  return null;
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
        carries: {},
        regroups: {},
        crosses: [],
        tens: [],
        selected: null,
      };
      const padded = withAutoPads(placed, a, b);
      return padded.aPoint !== null && padded.bPoint !== null
        ? { ...padded, selected: selectionFor(padded) }
        : padded;
    }

    case 'select': {
      if (!rowAllowed(state, action.row, action.index)) return state;
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
      if (!rowAllowed(state, action.row, action.index)) return state;
      if (action.digit !== null && !/^[0-9]$/.test(action.digit)) return state;
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
      if (state.mode !== 'decimal' || state.padZeros === 'off') return state;
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
      if (state.op !== 'mul') return state;
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
      for (const value of action.fill) {
        if (value.kind === 'carry') {
          if (carries[String(value.column)] === undefined) {
            carries = { ...carries, [String(value.column)]: value.digit };
          }
        } else {
          regroups = { ...regroups, [String(value.column)]: value.digit };
        }
      }
      return {
        ...state,
        carries,
        regroups,
        crosses: sortedUnique([...state.crosses, ...action.crosses]),
        tens: sortedUnique([...state.tens, ...action.tens]),
        linkHighlights: action.marks.map((mark) => `${mark.kind}:${mark.column}`),
      };
    }

    case 'link-colors': {
      return { ...state, rowColors: { ...action.colors } };
    }

    case 'enter-estimate': {
      if (state.mode !== 'estimate' || state.phase !== 'estimate') return state;
      return enterEstimate(state, action);
    }

    case 'lock-estimate': {
      if (state.mode !== 'estimate') return state;
      return lockEstimate(state);
    }

    case 'unlock-estimate': {
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

    default:
      return state;
  }
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
