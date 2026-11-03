/**
 * E04 배열·넓이 모델의 순수 reducer.
 *
 * - 무작위·시간을 쓰지 않는다(모든 상태는 Action 목록으로 재생된다).
 * - reduce는 config를 받지 않으므로 필요한 설정은 `state.settings`에 복사한다.
 * - 전체 곱은 상태에 저장하지 않는다. 부분곱은 화면이 `area.ts`로 계산한다.
 */
import { clamp } from '../../core/engine-sdk';
import {
  arrayTotal,
  boundariesFor,
  cellKey,
  piecesOfArea,
  piecesOfSplit,
  placeValueBoundaries,
  sameSplits,
  snapToHint,
  sortSplits,
  tableProduct,
} from './area';
import type { Piece } from './area';
import type {
  ArrayAreaAction,
  ArrayAreaConfig,
  ArrayAreaSettings,
  ArrayAreaState,
  Arrangement,
  ArrayIcon,
  ArrayMode,
  FactHide,
  GridDisplay,
  PartialDisplay,
  SentenceMode,
  SideSplit,
  SplitLine,
  SplitOrientation,
  TableNumberCell,
  TablePrefill,
} from './types';
import { MAX_AREA_SPLITS } from './types';

const MAX_ROWS = 20;
const MAX_COLS = 20;
const MAX_EXTENDED_ROWS = 3;

function integer(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value), min, max);
}

export function inferMode(config: ArrayAreaConfig): ArrayMode {
  if (config.mode !== undefined) return config.mode;
  if (
    config.size !== undefined ||
    config.prefill !== undefined ||
    config.symmetryReveal !== undefined ||
    config.colorSameValue !== undefined ||
    config.includeZero !== undefined
  ) {
    return 'times-table';
  }
  if (
    config.a !== undefined ||
    config.b !== undefined ||
    config.splitA !== undefined ||
    config.splitB !== undefined ||
    config.showGrid !== undefined
  ) {
    return 'area-model';
  }
  if (
    config.maxSplits !== undefined ||
    config.orientation !== undefined ||
    config.snapHints !== undefined ||
    config.allowExtend !== undefined
  ) {
    return 'split';
  }
  return 'dot-array';
}

function splitOrientationOf(
  value: SplitOrientation | 'either' | undefined,
): SplitOrientation | 'either' {
  return value === 'rows' || value === 'cols' ? value : 'either';
}

function sideSplitOf(value: SideSplit | undefined): SideSplit {
  return value === 'place-value' || value === 'none' ? value : 'free';
}

function prefillOf(value: ArrayAreaConfig['prefill']): TablePrefill | readonly TableNumberCell[] {
  if (Array.isArray(value)) return value;
  return value === 'rows-2-5' ? 'rows-2-5' : 'none';
}

function settingsOf(config: ArrayAreaConfig): ArrayAreaSettings {
  const size = config.size ?? [9, 9];
  return {
    maxRows: integer(config.maxRows, 10, 1, MAX_ROWS),
    maxCols: integer(config.maxCols, 10, 1, MAX_COLS),
    icon: (config.icon ?? 'dot') as ArrayIcon,
    rotate: config.rotate === true,
    showSentence: (config.showSentence ?? 'none') as SentenceMode,
    factFamily: config.factFamily === true,
    factHide: (config.factHide ?? null) as FactHide,
    showSplitLines: config.showSplitLines === true,

    maxSplits: integer(config.maxSplits, 1, 1, 3),
    orientation: splitOrientationOf(config.orientation),
    snapHints: (config.snapHints ?? []).filter((hint) => Number.isFinite(hint)),
    showPartials: (config.showPartials ?? 'color') as PartialDisplay,
    allowExtend: config.allowExtend === true,

    a: integer(config.a, 23, 1, 999),
    b: integer(config.b, 4, 1, 99),
    splitA: sideSplitOf(config.splitA),
    splitB: sideSplitOf(config.splitB),
    showGrid: (config.showGrid ?? 'C-only') as GridDisplay,

    tableRows: integer(size[0], 9, 1, 12),
    tableCols: integer(size[1], 9, 1, 12),
    prefill: prefillOf(config.prefill),
    symmetryReveal: config.symmetryReveal === true,
    colorSameValue: config.colorSameValue === true,
    includeZero: config.includeZero === true,
  };
}

function initialCells(settings: ArrayAreaSettings): Record<string, number> {
  const cells: Record<string, number> = {};
  const start = settings.includeZero ? 0 : 1;
  const fill = (r: number, c: number) => {
    if (r < start || r > settings.tableRows || c < start || c > settings.tableCols) return;
    cells[cellKey(r, c)] = tableProduct(r, c);
  };

  if (settings.prefill === 'rows-2-5') {
    for (let r = Math.max(2, start); r <= Math.min(5, settings.tableRows); r += 1) {
      for (let c = start; c <= settings.tableCols; c += 1) fill(r, c);
    }
  } else if (Array.isArray(settings.prefill)) {
    for (const cell of settings.prefill) fill(cell.r, cell.c);
  }
  return cells;
}

function initialSplits(count: number, side: SideSplit): number[] {
  if (side !== 'place-value') return [];
  return placeValueBoundaries(count);
}

export function createInitialState(config: ArrayAreaConfig): ArrayAreaState {
  const mode = inferMode(config);
  const settings = settingsOf(config);

  const rows =
    mode === 'split'
      ? integer(config.rows, 7, 0, settings.maxRows)
      : integer(config.rows, 0, 0, settings.maxRows);
  const cols =
    mode === 'split'
      ? integer(config.cols, 8, 0, settings.maxCols)
      : integer(config.cols, 0, 0, settings.maxCols);

  return {
    mode,
    rows,
    cols,
    rotations: 0,
    recorded: [],
    splitLine: null,
    splits: [],
    recordedSplits: [],
    extendedRows: 0,
    areaSplitsA: initialSplits(settings.a, settings.splitA),
    areaSplitsB: initialSplits(settings.b, settings.splitB),
    cells: initialCells(settings),
    painted: {},
    selected: [],
    flash: null,
    folded: false,
    settings,
  };
}

// ─────────────────────────────────────────────────────────────
// reduce
// ─────────────────────────────────────────────────────────────

export function reduce(state: ArrayAreaState, action: ArrayAreaAction): ArrayAreaState {
  switch (action.type) {
    case 'resize':
      return resizeArray(state, action.rows, action.cols);
    case 'rotate':
      return rotateArray(state);
    case 'record-arrangement':
      return recordArrangement(state);
    case 'set-split-line':
      return setSplitLine(state, action.orientation, action.at);
    case 'place-split':
      return placeSplit(state, action.orientation, action.at);
    case 'remove-split':
      return removeSplit(state, action.index);
    case 'extend':
      return extendArray(state, action.rows);
    case 'record-split':
      return recordSplit(state);
    case 'set-area-split':
      return setAreaSplit(state, action.side, action.at);
    case 'remove-area-split':
      return removeAreaSplit(state, action.side, action.at);
    case 'set-cell':
      return setCell(state, action.r, action.c, action.value);
    case 'select-cell':
      return selectCell(state, action.r, action.c);
    case 'paint':
      return paintCell(state, action.r, action.c, action.color);
    case 'fold':
      return { ...state, folded: !state.folded };
    default:
      return state;
  }
}

function resizeArray(state: ArrayAreaState, rows: number, cols: number): ArrayAreaState {
  const nextRows = integer(rows, state.rows, 0, state.settings.maxRows);
  const nextCols = integer(cols, state.cols, 0, state.settings.maxCols);
  if (nextRows === state.rows && nextCols === state.cols) return state;
  return { ...state, rows: nextRows, cols: nextCols };
}

function rotateArray(state: ArrayAreaState): ArrayAreaState {
  if (!state.settings.rotate) return state;
  const rows = Math.min(state.cols, state.settings.maxRows);
  const cols = Math.min(state.rows, state.settings.maxCols);
  const splitLine: SplitLine | null =
    state.splitLine === null
      ? null
      : {
          orientation: state.splitLine.orientation === 'rows' ? 'cols' : 'rows',
          at: state.splitLine.at,
        };
  return { ...state, rows, cols, rotations: state.rotations + 1, splitLine };
}

function arrangementKey(rows: number, cols: number): string {
  return `${Math.min(rows, cols)}x${Math.max(rows, cols)}`;
}

function recordArrangement(state: ArrayAreaState): ArrayAreaState {
  if (state.rows <= 0 || state.cols <= 0) return state;
  const key = arrangementKey(state.rows, state.cols);
  if (state.recorded.some((item) => arrangementKey(item.rows, item.cols) === key)) return state;
  const found: Arrangement = { rows: state.rows, cols: state.cols };
  return { ...state, recorded: [...state.recorded, found] };
}

function setSplitLine(
  state: ArrayAreaState,
  orientation: SplitOrientation,
  at: number,
): ArrayAreaState {
  if (!state.settings.showSplitLines) return state;
  const count = orientation === 'rows' ? state.rows : state.cols;
  if (count < 2 || !Number.isFinite(at)) return state;
  const clamped = clamp(Math.round(at), 1, count - 1);
  if (state.splitLine?.orientation === orientation && state.splitLine.at === clamped) return state;
  return { ...state, splitLine: { orientation, at: clamped } };
}

function orientationAllowed(state: ArrayAreaState, orientation: SplitOrientation): boolean {
  return state.settings.orientation === 'either' || state.settings.orientation === orientation;
}

function placeSplit(
  state: ArrayAreaState,
  orientation: SplitOrientation,
  at: number,
): ArrayAreaState {
  if (state.mode !== 'split') return state;
  if (!orientationAllowed(state, orientation)) return state;
  const count = orientation === 'rows' ? state.rows : state.cols;
  if (count < 2 || !Number.isFinite(at)) return state;
  let position = clamp(Math.round(at), 1, count - 1);
  position = snapToHint(position, state.settings.snapHints, count);
  if (position < 1 || position > count - 1) return state;
  if (state.splits.some((split) => split.orientation === orientation && split.at === position)) {
    return state;
  }
  if (state.splits.length >= state.settings.maxSplits) return state;
  return { ...state, splits: sortSplits([...state.splits, { orientation, at: position }]) };
}

function removeSplit(state: ArrayAreaState, index: number): ArrayAreaState {
  if (!Number.isInteger(index) || index < 0 || index >= state.splits.length) return state;
  return { ...state, splits: state.splits.filter((_, itemIndex) => itemIndex !== index) };
}

function extendArray(state: ArrayAreaState, rows: number): ArrayAreaState {
  if (state.mode !== 'split' || !state.settings.allowExtend) return state;
  const next = integer(rows, state.extendedRows, 0, MAX_EXTENDED_ROWS);
  if (next === state.extendedRows) return state;
  return { ...state, extendedRows: next };
}

function recordSplit(state: ArrayAreaState): ArrayAreaState {
  const canonical = sortSplits(state.splits);
  if (canonical.length === 0) return state;
  if (state.recordedSplits.some((item) => sameSplits(item, canonical))) return state;
  return { ...state, recordedSplits: [...state.recordedSplits, canonical] };
}

function setAreaSplit(state: ArrayAreaState, side: 'a' | 'b', at: number): ArrayAreaState {
  if (state.mode !== 'area-model') return state;
  if (side === 'a' && state.settings.splitA === 'none') return state;
  if (side === 'b' && state.settings.splitB === 'none') return state;
  const count = side === 'a' ? state.settings.a : state.settings.b;
  if (count < 2 || !Number.isFinite(at)) return state;
  const position = clamp(Math.round(at), 1, count - 1);
  const current = side === 'a' ? state.areaSplitsA : state.areaSplitsB;
  if (current.includes(position)) return state;
  if (current.length >= MAX_AREA_SPLITS) return state;
  const next = [...current, position].sort((x, y) => x - y);
  return side === 'a' ? { ...state, areaSplitsA: next } : { ...state, areaSplitsB: next };
}

function removeAreaSplit(state: ArrayAreaState, side: 'a' | 'b', at: number): ArrayAreaState {
  const current = side === 'a' ? state.areaSplitsA : state.areaSplitsB;
  if (!current.includes(at)) return state;
  const next = current.filter((item) => item !== at);
  return side === 'a' ? { ...state, areaSplitsA: next } : { ...state, areaSplitsB: next };
}

function tableBounds(state: ArrayAreaState): { start: number; rows: number; cols: number } | null {
  if (state.mode !== 'times-table') return null;
  return {
    start: state.settings.includeZero ? 0 : 1,
    rows: state.settings.tableRows,
    cols: state.settings.tableCols,
  };
}

function setCell(
  state: ArrayAreaState,
  r: number,
  c: number,
  value: number | null,
): ArrayAreaState {
  const bounds = tableBounds(state);
  if (!bounds) return state;
  if (
    !Number.isInteger(r) ||
    !Number.isInteger(c) ||
    r < bounds.start ||
    r > bounds.rows ||
    c < bounds.start ||
    c > bounds.cols
  ) {
    return state;
  }
  if (value !== null && (!Number.isInteger(value) || value < 0 || value > 99)) return state;

  const key = cellKey(r, c);
  let cells: Record<string, number>;
  if (value === null) {
    if (!(key in state.cells)) return state;
    cells = Object.fromEntries(
      Object.entries(state.cells).filter(([cellKeyValue]) => cellKeyValue !== key),
    );
  } else {
    if (state.cells[key] === value) return state;
    cells = { ...state.cells, [key]: value };
  }

  let flash: string | null = null;
  if (state.settings.symmetryReveal) {
    const mirror = cellKey(c, r);
    if (c >= bounds.start && c <= bounds.rows && r >= bounds.start && r <= bounds.cols) {
      flash = mirror;
    }
  }
  return { ...state, cells, flash };
}

function selectCell(state: ArrayAreaState, r: number, c: number): ArrayAreaState {
  const bounds = tableBounds(state);
  if (!bounds) return state;
  if (r < bounds.start || r > bounds.rows || c < bounds.start || c > bounds.cols) return state;
  const key = cellKey(r, c);
  const selected = state.selected.includes(key)
    ? state.selected.filter((item) => item !== key)
    : [...state.selected, key];
  return { ...state, selected };
}

function paintCell(
  state: ArrayAreaState,
  r: number,
  c: number,
  color: number | null,
): ArrayAreaState {
  const bounds = tableBounds(state);
  if (!bounds) return state;
  if (r < bounds.start || r > bounds.rows || c < bounds.start || c > bounds.cols) return state;
  if (color !== null && (!Number.isInteger(color) || color < 0 || color > 3)) return state;
  const key = cellKey(r, c);
  let painted: Record<string, number>;
  if (color === null) {
    if (!(key in state.painted)) return state;
    painted = Object.fromEntries(
      Object.entries(state.painted).filter(([cellKeyValue]) => cellKeyValue !== key),
    );
  } else {
    if (state.painted[key] === color) return state;
    painted = { ...state.painted, [key]: color };
  }
  return { ...state, painted };
}

// ─────────────────────────────────────────────────────────────
// View·테스트가 함께 쓰는 계산
// ─────────────────────────────────────────────────────────────

export function piecesOf(state: ArrayAreaState): Piece[] {
  if (state.mode === 'split') {
    return piecesOfSplit(state.rows, state.cols, state.splits, state.extendedRows);
  }
  if (state.mode === 'area-model') {
    return piecesOfArea(state.settings.a, state.settings.b, state.areaSplitsA, state.areaSplitsB);
  }
  return [];
}

export function distinctArrangementsOf(recorded: readonly Arrangement[]): number {
  return new Set(recorded.map((item) => arrangementKey(item.rows, item.cols))).size;
}

export function canPlaceSplit(state: ArrayAreaState, orientation: SplitOrientation): boolean {
  if (state.mode !== 'split') return false;
  if (!orientationAllowed(state, orientation)) return false;
  if (state.splits.length >= state.settings.maxSplits) return false;
  const count = orientation === 'rows' ? state.rows : state.cols;
  if (count < 2) return false;
  return boundariesFor(count, state.splits, orientation).length - 1 < count - 1;
}

/** E2E·View가 쓰는 기본 분할 위치(가운데). */
export function defaultSplitAt(state: ArrayAreaState, orientation: SplitOrientation): number {
  const count = orientation === 'rows' ? state.rows : state.cols;
  const hints = state.settings.snapHints.filter((hint) => hint >= 1 && hint <= count - 1);
  if (hints.length > 0) return Math.round(hints[0] ?? 1);
  return Math.max(1, Math.floor(count / 2));
}

/** 배열이 나타내는 수(행×열). */
export function totalOf(state: ArrayAreaState): number {
  return arrayTotal(state.rows, state.cols);
}
