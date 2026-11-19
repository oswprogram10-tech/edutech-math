/**
 * E15 calc-pattern 표 변형(덧셈표·곱셈표 돋보기 탐정)의 순수 계산.
 *
 * 칸 값·격자 인덱스는 정수라 number를 쓴다(AGENTS 규칙 2의 정수·격자 예외).
 * 정답(가린 칸의 값)은 여기서만 계산하고 View·Observation에는 내보내지 않는다.
 * 판정(predicate)과 오버레이만 이 함수를 불러 쓴다.
 */
import { recordOf } from './settings';
import type {
  CalcTableAction,
  CalcTableSettings,
  CalcTableState,
  PatternConfig,
  TableDir,
  TableKind,
  TableTool,
} from './types';

export const TABLE_MAX_ARROWS = 6;
export const TABLE_MAX_DIGITS = 3;
export const TABLE_DIRS: readonly TableDir[] = ['right', 'down', 'down-right', 'down-left'];

/** 값 계산에 필요한 최소 설정. `CalcTableSettings`와 Observation 모두 이 모양으로 읽는다. */
export interface TableGrid {
  readonly table: TableKind;
  readonly rows: number;
  readonly cols: number;
  readonly start: number;
}

export function cellKey(row: number, col: number): string {
  return `${row}.${col}`;
}

/** `"r.c"` → `[r, c]`. 몸통 안의 칸이 아니면 null. */
export function parseCell(key: unknown, rows: number, cols: number): [number, number] | null {
  if (typeof key !== 'string' || !/^\d{1,2}\.\d{1,2}$/.test(key)) return null;
  const [rowText, colText] = key.split('.');
  const row = Number(rowText);
  const col = Number(colText);
  if (row >= rows || col >= cols) return null;
  return [row, col];
}

/** 행 머리·열 머리 수(둘 다 start, start+1, …). */
export function headValue(grid: TableGrid, index: number): number {
  return grid.start + index;
}

export function valueAt(grid: TableGrid, row: number, col: number): number {
  const a = headValue(grid, row);
  const b = headValue(grid, col);
  return grid.table === 'addition' ? a + b : a * b;
}

/** 한 칸 오른쪽(가로)·한 칸 아래(세로)로 갈 때 값이 늘어나는 양(몸통 칸 (row, col) 기준). */
export function stepDiffs(grid: TableGrid, row: number, col: number): { h: number; v: number } {
  if (grid.table === 'addition') return { h: 1, v: 1 };
  return { h: headValue(grid, row), v: headValue(grid, col) };
}

const DELTA: Readonly<Record<TableDir, readonly [number, number]>> = {
  right: [0, 1],
  down: [1, 0],
  'down-right': [1, 1],
  'down-left': [1, -1],
};

export function dirDelta(dir: TableDir): readonly [number, number] {
  return DELTA[dir];
}

/** `from`에서 `dir`로 `steps`칸 간 칸. 몸통 밖이면 null. */
export function stepFrom(
  grid: TableGrid,
  from: string,
  dir: TableDir,
  steps = 1,
): [number, number] | null {
  const parsed = parseCell(from, grid.rows, grid.cols);
  if (parsed === null) return null;
  const [dr, dc] = DELTA[dir];
  const row = parsed[0] + dr * steps;
  const col = parsed[1] + dc * steps;
  if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) return null;
  return [row, col];
}

/** from에서 dir로 한 칸 간 값의 차이(몸통 밖이면 null). */
export function arrowDiff(grid: TableGrid, from: string, dir: TableDir): number | null {
  const parsed = parseCell(from, grid.rows, grid.cols);
  const next = stepFrom(grid, from, dir);
  if (parsed === null || next === null) return null;
  return valueAt(grid, next[0], next[1]) - valueAt(grid, parsed[0], parsed[1]);
}

/** 학생이 쓴 증가량이 실제 한 칸 차이와 같은가. 학생 자료를 판정한 값이고 정답 수는 아니다. */
export function amountIsCorrect(
  grid: TableGrid,
  arrow: { from: string; dir: TableDir; amount: string },
): boolean {
  if (!/^[0-9]{1,3}$/.test(arrow.amount)) return false;
  const diff = arrowDiff(grid, arrow.from, arrow.dir);
  return diff !== null && Number(arrow.amount) === diff;
}

function intIn(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return null;
  }
  return value;
}

function sortKeys(keys: readonly string[]): string[] {
  const parse = (key: string): [number, number] => {
    const [r, c] = key.split('.');
    return [Number(r), Number(c)];
  };
  return [...new Set(keys)].sort((a, b) => {
    const [ar, ac] = parse(a);
    const [br, bc] = parse(b);
    return ar - br || ac - bc;
  });
}

/** `config`에 `table` 키가 있으면 표 변형이다. */
export function isTableConfig(config: unknown): boolean {
  return recordOf(config)['table'] !== undefined;
}

/**
 * 표 변형 설정 정규화. 범위 밖이거나 모르는 값이면 `error`를 켠다
 * (throw하지 않는다. 화면은 설정 오류 판을 그린다).
 */
export function calcTableSettings(config: PatternConfig | undefined): CalcTableSettings {
  const record = recordOf(config);
  let error: string | null = null;
  const fail = (name: string) => {
    error = error ?? name;
  };

  const kind: TableKind = record['table'] === 'multiplication' ? 'multiplication' : 'addition';
  if (record['table'] !== 'addition' && record['table'] !== 'multiplication') fail('table');

  let rows = 6;
  let cols = 6;
  if (record['size'] !== undefined) {
    const size = record['size'];
    const r = Array.isArray(size) && size.length === 2 ? intIn(size[0], 2, 9) : null;
    const c = Array.isArray(size) && size.length === 2 ? intIn(size[1], 2, 9) : null;
    if (r === null || c === null) fail('size');
    else {
      rows = r;
      cols = c;
    }
  }

  let start = 1;
  if (record['start'] !== undefined) {
    const value = intIn(record['start'], 0, 9);
    if (value === null) fail('start');
    else start = value;
  }

  let magnifierUses = 0;
  if (record['magnifierUses'] !== undefined) {
    const value = intIn(record['magnifierUses'], 0, 5);
    if (value === null) fail('magnifierUses');
    else magnifierUses = value;
  }

  let hidden: string[] = [];
  const hiddenRaw = record['hidden'];
  if (hiddenRaw === undefined || hiddenRaw === 'most') {
    for (let r = 1; r < rows; r += 1) {
      for (let c = 1; c < cols; c += 1) hidden.push(cellKey(r, c));
    }
  } else if (Array.isArray(hiddenRaw)) {
    const keys: string[] = [];
    for (const item of hiddenRaw) {
      const r = Array.isArray(item) && item.length === 2 ? intIn(item[0], 0, rows - 1) : null;
      const c = Array.isArray(item) && item.length === 2 ? intIn(item[1], 0, cols - 1) : null;
      if (r === null || c === null) {
        fail('hidden');
        break;
      }
      keys.push(cellKey(r, c));
    }
    hidden = sortKeys(keys);
  } else {
    fail('hidden');
  }

  if (error !== null && import.meta.env.DEV) {
    console.warn(`[E15] calc-pattern 표 설정을 읽을 수 없습니다(${error}).`);
  }
  return {
    table: kind,
    rows,
    cols,
    start,
    hidden,
    magnifierUses,
    drawArrows: record['drawArrows'] === true,
    error,
  };
}

export function createTableState(config: PatternConfig | undefined): CalcTableState {
  const settings = calcTableSettings(config);
  return {
    mode: 'calc-pattern',
    variant: 'table',
    settings,
    entries: {},
    revealed: [],
    active: null,
    tool: 'write',
    arrows: [],
    draftArrow: null,
  };
}

export function allBodyKeys(settings: Pick<TableGrid, 'rows' | 'cols'>): string[] {
  const keys: string[] = [];
  for (let r = 0; r < settings.rows; r += 1) {
    for (let c = 0; c < settings.cols; c += 1) keys.push(cellKey(r, c));
  }
  return keys;
}

/** 가렸고 아직 열지 않은 칸(수를 쓰거나 돋보기로 열 수 있는 칸). */
export function writableKeys(state: CalcTableState): string[] {
  return state.settings.hidden.filter((key) => !state.revealed.includes(key));
}

export function magnifierLeft(state: Pick<CalcTableState, 'settings' | 'revealed'>): number {
  return Math.max(0, state.settings.magnifierUses - state.revealed.length);
}

/** 지금 도구에서 고를 수 있는 칸. 쓰기·돋보기는 가린 칸, 화살표는 몸통 전체. */
export function candidateKeys(state: CalcTableState, tool: TableTool = state.tool): string[] {
  return tool === 'arrow' ? allBodyKeys(state.settings) : writableKeys(state);
}

/** 눈에 보이는 몸통 칸인가(처음부터 안 가렸거나 돋보기로 열었다). */
export function isVisibleBody(
  settings: { readonly hidden: readonly string[] },
  revealed: readonly string[],
  key: string,
): boolean {
  return !settings.hidden.includes(key) || revealed.includes(key);
}

function toolAvailable(settings: CalcTableSettings, tool: TableTool): boolean {
  if (tool === 'write') return true;
  if (tool === 'magnifier') return settings.magnifierUses > 0;
  return settings.drawArrows;
}

/** 방향으로 한 칸 옮긴 가장 가까운 후보 칸. 지금 칸이 후보가 아니어도 그 자리에서 센다. */
export function moveCell(
  grid: TableGrid,
  candidates: readonly string[],
  current: string | null,
  dir: 'left' | 'right' | 'up' | 'down',
): string | null {
  if (candidates.length === 0) return current;
  const here = current === null ? null : parseCell(current, grid.rows, grid.cols);
  if (here === null) return candidates[0] ?? null;
  let best: string | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const key of candidates) {
    const parsed = parseCell(key, grid.rows, grid.cols);
    if (parsed === null) continue;
    const dr = parsed[0] - here[0];
    const dc = parsed[1] - here[1];
    let dist: number | null = null;
    if (dir === 'left' && dr === 0 && dc < 0) dist = -dc;
    else if (dir === 'right' && dr === 0 && dc > 0) dist = dc;
    else if (dir === 'up' && dc === 0 && dr < 0) dist = -dr;
    else if (dir === 'down' && dc === 0 && dr > 0) dist = dr;
    if (dist !== null && dist < bestDist) {
      best = key;
      bestDist = dist;
    }
  }
  return best ?? current;
}

function withoutKey(
  entries: Readonly<Record<string, string>>,
  key: string,
): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).filter(([name]) => name !== key));
}

function appendDigit(current: string, key: string): string | null {
  if (!/^[0-9]$/.test(key)) return null;
  if (current.length >= TABLE_MAX_DIGITS) return null;
  // "0" 뒤에 숫자를 쓰면 앞의 0을 바꾼다("02" 같은 글자를 만들지 않는다).
  return current === '0' ? key : current + key;
}

export function reduceTable(state: CalcTableState, action: CalcTableAction): CalcTableState {
  const { settings } = state;
  if (settings.error !== null) return state;
  const grid = settings;

  switch (action.type) {
    case 'set-tool': {
      if (action.tool !== 'write' && action.tool !== 'magnifier' && action.tool !== 'arrow') {
        return state;
      }
      if (!toolAvailable(settings, action.tool) || action.tool === state.tool) return state;
      const next: CalcTableState = { ...state, tool: action.tool, draftArrow: null };
      if (state.active !== null && !candidateKeys(next).includes(state.active)) {
        return { ...next, active: null };
      }
      return next;
    }
    case 'activate': {
      if (typeof action.cell !== 'string' || !candidateKeys(state).includes(action.cell)) {
        return state;
      }
      return state.active === action.cell ? state : { ...state, active: action.cell };
    }
    case 'type': {
      if (state.tool !== 'write' || state.active === null) return state;
      if (!writableKeys(state).includes(state.active) || typeof action.key !== 'string') {
        return state;
      }
      const next = appendDigit(state.entries[state.active] ?? '', action.key);
      if (next === null) return state;
      return { ...state, entries: { ...state.entries, [state.active]: next } };
    }
    case 'backspace': {
      if (state.tool !== 'write' || state.active === null) return state;
      const current = state.entries[state.active];
      if (current === undefined) return state;
      const entries =
        current.length <= 1
          ? withoutKey(state.entries, state.active)
          : { ...state.entries, [state.active]: current.slice(0, -1) };
      return { ...state, entries };
    }
    case 'clear': {
      if (state.tool !== 'write' || state.active === null) return state;
      if (state.entries[state.active] === undefined) return state;
      return { ...state, entries: withoutKey(state.entries, state.active) };
    }
    case 'move': {
      const dir = action.dir;
      if (dir !== 'left' && dir !== 'right' && dir !== 'up' && dir !== 'down') return state;
      const next = moveCell(grid, candidateKeys(state), state.active, dir);
      return next === state.active ? state : { ...state, active: next };
    }
    case 'peek': {
      if (typeof action.cell !== 'string' || !writableKeys(state).includes(action.cell)) {
        return state;
      }
      if (magnifierLeft(state) <= 0) return state;
      // 연 칸은 입력 칸이 아니므로 써 둔 수를 거둔다.
      return {
        ...state,
        revealed: [...state.revealed, action.cell],
        entries: withoutKey(state.entries, action.cell),
      };
    }
    case 'arrow-start': {
      if (state.tool !== 'arrow' || parseCell(action.cell, grid.rows, grid.cols) === null) {
        return state;
      }
      return {
        ...state,
        active: action.cell,
        draftArrow: { from: action.cell, dir: null, amount: '' },
      };
    }
    case 'arrow-dir': {
      const draft = state.draftArrow;
      if (state.tool !== 'arrow' || draft === null || !TABLE_DIRS.includes(action.dir)) {
        return state;
      }
      if (stepFrom(grid, draft.from, action.dir) === null) return state;
      if (draft.dir === action.dir) return state;
      return { ...state, draftArrow: { ...draft, dir: action.dir } };
    }
    case 'arrow-type': {
      const draft = state.draftArrow;
      if (state.tool !== 'arrow' || draft === null || typeof action.key !== 'string') return state;
      const next = appendDigit(draft.amount, action.key);
      if (next === null) return state;
      return { ...state, draftArrow: { ...draft, amount: next } };
    }
    case 'arrow-backspace': {
      const draft = state.draftArrow;
      if (state.tool !== 'arrow' || draft === null || draft.amount === '') return state;
      return { ...state, draftArrow: { ...draft, amount: draft.amount.slice(0, -1) } };
    }
    case 'arrow-commit': {
      const draft = state.draftArrow;
      if (state.tool !== 'arrow' || draft === null || draft.dir === null || draft.amount === '') {
        return state;
      }
      const made = { from: draft.from, dir: draft.dir, amount: draft.amount };
      const same = state.arrows.findIndex((a) => a.from === made.from && a.dir === made.dir);
      let arrows: CalcTableState['arrows'];
      if (same >= 0) arrows = state.arrows.map((a, index) => (index === same ? made : a));
      else if (state.arrows.length >= TABLE_MAX_ARROWS) return state;
      else arrows = [...state.arrows, made];
      return { ...state, arrows, draftArrow: null };
    }
    case 'arrow-remove': {
      const index = action.index;
      if (!Number.isInteger(index) || index < 0 || index >= state.arrows.length) return state;
      return { ...state, arrows: state.arrows.filter((_, i) => i !== index) };
    }
    default:
      return state;
  }
}

/** 칸에 쓴 수(숫자 글자만). 없거나 숫자가 아니면 null. */
export function entryNumber(text: string | undefined): number | null {
  if (text === undefined || !/^[0-9]{1,3}$/.test(text)) return null;
  return Number(text);
}

/**
 * 가린 칸 중 쓴 값이 틀리고 가로/세로 한 칸 차이를 헷갈린 칸(MC-CHART-ROW-COL).
 * 왼쪽 이웃 + 세로 한 칸 차이이거나 위 이웃 + 가로 한 칸 차이와 같고, 두 차이가 서로 다를 때만 건다.
 * 이웃 값은 보이거나(안 가렸거나 열었거나) 학생이 쓴 값이다.
 */
export function rowColCells(
  grid: TableGrid & { readonly hidden: readonly string[] },
  entries: Readonly<Record<string, string>>,
  revealed: readonly string[],
): string[] {
  const known = (row: number, col: number): number | null => {
    if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) return null;
    const key = cellKey(row, col);
    if (isVisibleBody(grid, revealed, key)) return valueAt(grid, row, col);
    return entryNumber(entries[key]);
  };
  const found: string[] = [];
  for (const key of grid.hidden) {
    if (revealed.includes(key)) continue;
    const parsed = parseCell(key, grid.rows, grid.cols);
    const written = entryNumber(entries[key]);
    if (parsed === null || written === null) continue;
    const [row, col] = parsed;
    if (written === valueAt(grid, row, col)) continue;
    const { h, v } = stepDiffs(grid, row, col);
    if (h === v) continue;
    const left = known(row, col - 1);
    const up = known(row - 1, col);
    if ((left !== null && written === left + v) || (up !== null && written === up + h)) {
      found.push(key);
    }
  }
  return found;
}

/** 지정한 칸(없으면 가린 칸 중 열지 않은 칸 전부)에 쓴 수가 모두 맞다. 판정할 칸이 없으면 false. */
export function entriesAllCorrect(
  grid: TableGrid & { readonly hidden: readonly string[] },
  entries: Readonly<Record<string, string>>,
  revealed: readonly string[],
  cells?: readonly string[],
): boolean {
  const targets = cells ?? grid.hidden.filter((key) => !revealed.includes(key));
  if (targets.length === 0) return false;
  return targets.every((key) => {
    const parsed = parseCell(key, grid.rows, grid.cols);
    if (parsed === null) return false;
    if (isVisibleBody(grid, revealed, key)) return true;
    return entryNumber(entries[key]) === valueAt(grid, parsed[0], parsed[1]);
  });
}
