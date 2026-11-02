/**
 * E07의 순수 reducer. 모든 상태 변경은 Action 하나로 기록된다.
 * 수 값은 정수 자리 계산과 `Rational`로만 다루고, 상태에는 문자열만 둔다.
 */
import type { ColumnCalcAction, ColumnCalcConfig, ColumnCalcState, EditableRow } from './types';
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

const DEFAULT_NUMBERS: Readonly<Record<'add' | 'sub' | 'decimal', { a: string; b: string }>> = {
  add: { a: '47', b: '25' },
  sub: { a: '52', b: '17' },
  decimal: { a: '3.5', b: '1.27' },
};

function requireNumber(text: string): ParsedNumber {
  const parsed = parseNumber(text);
  if (!parsed) throw new Error(S.configError(`"${text}"는 읽을 수 없는 수입니다.`));
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

function selectionFor(state: ColumnCalcState): ColumnCalcState['selected'] {
  const grid = computeGrid(state);
  const column = grid.requiredColumns[0] ?? grid.resultColumns[0];
  return column === undefined ? null : { row: 'result', column };
}

export function createInitialState(config: ColumnCalcConfig = {}): ColumnCalcState {
  const mode = config.mode ?? 'add';
  const defaults = DEFAULT_NUMBERS[mode];
  const aText = config.a ?? defaults.a;
  const bText = config.b ?? defaults.b;
  const a = requireNumber(aText);
  const b = requireNumber(bText);
  const op = mode === 'decimal' ? (config.op ?? 'add') : mode;

  if (op === 'sub' && compareNumbers(a, b) < 0) {
    throw new Error(S.configError('빼는 수가 빼어지는 수보다 큽니다.'));
  }

  const base: ColumnCalcState = {
    mode,
    op,
    aText,
    bText,
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
  };

  if (mode === 'decimal') return base;

  const withSelection: ColumnCalcState = { ...base, selected: selectionFor(base) };
  return withAutoPads(withSelection, a, b);
}

function rowAllowed(state: ColumnCalcState, row: EditableRow): boolean {
  if (row === 'carry') return state.op === 'add';
  if (row === 'regroup') return state.op === 'sub';
  return true;
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

function toggleNumber(values: readonly number[], column: number): number[] {
  return values.includes(column) ? values.filter((value) => value !== column) : [...values, column];
}

export function reduce(state: ColumnCalcState, action: ColumnCalcAction): ColumnCalcState {
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
      if (!rowAllowed(state, action.row)) return state;
      const grid = computeGrid(state);
      if (action.column < grid.low || action.column > grid.high) return state;
      if (action.row === 'result' && !grid.resultColumns.includes(action.column)) return state;
      return { ...state, selected: { row: action.row, column: action.column } };
    }

    case 'enter': {
      if (!rowAllowed(state, action.row)) return state;
      if (action.digit !== null && !/^[0-9]$/.test(action.digit)) return state;
      const grid = computeGrid(state);
      if (action.row === 'result' && !grid.resultColumns.includes(action.column)) return state;
      if (action.column < grid.low || action.column > grid.high) return state;

      let next: ColumnCalcState;
      if (action.row === 'result') {
        next = { ...state, result: writeDigit(state.result, action.column, action.digit) };
        if (action.digit !== null) {
          const ahead = grid.requiredColumns.find((column) => column > action.column);
          next = {
            ...next,
            selected: { row: 'result', column: ahead ?? action.column },
          };
        } else {
          next = { ...next, selected: { row: 'result', column: action.column } };
        }
      } else if (action.row === 'carry') {
        next = {
          ...state,
          carries: writeDigit(state.carries, action.column, action.digit),
          selected: { row: 'carry', column: action.column },
        };
      } else {
        next = {
          ...state,
          regroups: writeDigit(state.regroups, action.column, action.digit),
          selected: { row: 'regroup', column: action.column },
        };
      }
      return next;
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

    default:
      return state;
  }
}
