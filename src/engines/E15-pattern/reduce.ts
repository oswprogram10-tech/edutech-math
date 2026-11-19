/**
 * E15 reduce. 순수 함수이고 상태는 JSON으로 직렬화된다.
 * 바뀌는 것이 없으면 같은 상태 객체를 그대로 돌려준다.
 */
import { EXPR_KEYS, EXPR_MAX_LENGTH } from './calc';
import { drawnCells, inRange } from './chart';
import { MAX_DIGITS, blankKeys, moveBlank } from './growth';
import { calcSettings, chartSettings, growthSettings, sequenceSettings } from './settings';
import { chartRangeOf } from './types';
import type {
  CalcAction,
  CalcState,
  ChartAction,
  ChartState,
  GrowthAction,
  GrowthState,
  PatternAction,
  PatternConfig,
  PatternState,
  SequenceAction,
  SequenceState,
} from './types';

export function createInitialState(config: PatternConfig): PatternState {
  const mode = (config as { mode?: unknown } | undefined)?.mode;
  if (mode === 'growth') {
    return { mode: 'growth', settings: growthSettings(config), cells: {}, active: null };
  }
  if (mode === 'calc-pattern') {
    const settings = calcSettings(config);
    return {
      mode: 'calc-pattern',
      settings,
      heights: Array.from({ length: 2 * settings.workStep + 1 }, () => 0),
      cursor: { col: 0, h: 1 },
      exprText: '',
      focus: settings.build ? 'build' : 'expr',
      link: null,
    };
  }
  if (mode === 'hundred-chart') {
    const { settings, hidden } = chartSettings(config);
    return {
      mode: 'hundred-chart',
      settings,
      hidden,
      entries: {},
      selected: null,
      painted: [...settings.prepainted],
      active: null,
    };
  }
  const settings = sequenceSettings(config);
  return {
    mode: 'sequence',
    settings,
    slots: Array.from({ length: settings.blanks }, () => null),
    cursor: 0,
    sent: false,
  };
}

function isIndex(value: unknown, length: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < length;
}

function reduceSequence(state: SequenceState, action: SequenceAction): SequenceState {
  const length = state.slots.length;
  // send 말고 다른 Action이 상태를 바꾸면 보낸 결과를 거둔다.
  const settled = (next: SequenceState): SequenceState =>
    next.sent ? { ...next, sent: false } : next;

  switch (action.type) {
    case 'place': {
      if (!isIndex(action.slot, length)) return state;
      if (!state.settings.palette.includes(action.token)) return state;
      const slots = state.slots.slice();
      slots[action.slot] = action.token;
      const cursor = action.slot + 1 < length ? action.slot + 1 : action.slot;
      return settled({ ...state, slots, cursor });
    }
    case 'clear-slot': {
      if (!isIndex(action.slot, length)) return state;
      if (state.slots[action.slot] === null) return state;
      const slots = state.slots.slice();
      slots[action.slot] = null;
      return settled({ ...state, slots });
    }
    case 'move-cursor': {
      if (typeof action.slot !== 'number' || !Number.isFinite(action.slot)) return state;
      const cursor = Math.min(length - 1, Math.max(0, Math.trunc(action.slot)));
      if (cursor === state.cursor && !state.sent) return state;
      return settled({ ...state, cursor });
    }
    case 'clear-all': {
      if (state.slots.every((slot) => slot === null) && !state.sent) return state;
      return settled({ ...state, slots: state.slots.map(() => null), cursor: 0 });
    }
    case 'send': {
      if (state.settings.variant !== 'translate' || state.sent) return state;
      return { ...state, sent: true };
    }
    default:
      return state;
  }
}

function withoutKey(
  entries: Readonly<Record<string, string>>,
  key: string,
): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).filter(([name]) => name !== key));
}

function sortedUnique(list: readonly number[]): number[] {
  return [...new Set(list)].sort((a, b) => a - b);
}

function reduceChart(state: ChartState, action: ChartAction): ChartState {
  const range = chartRangeOf(state.settings);
  const drawn = (cell: number): boolean =>
    inRange(range, cell) &&
    drawnCells(range, state.settings.view, state.settings.center, state.settings.focus).includes(
      cell,
    );

  switch (action.type) {
    case 'activate': {
      if (!state.hidden.includes(action.cell)) return state;
      return state.active === action.cell ? state : { ...state, active: action.cell };
    }
    case 'deactivate':
      return state.active === null ? state : { ...state, active: null };
    case 'type-digit': {
      if (state.active === null || !/^[0-9]$/.test(action.digit)) return state;
      const key = String(state.active);
      const current = state.entries[key] ?? '';
      if (current.length >= 3) return state;
      return { ...state, entries: { ...state.entries, [key]: current + action.digit } };
    }
    case 'backspace': {
      if (state.active === null) return state;
      const key = String(state.active);
      const current = state.entries[key];
      if (current === undefined) return state;
      const entries =
        current.length <= 1
          ? withoutKey(state.entries, key)
          : { ...state.entries, [key]: current.slice(0, -1) };
      return { ...state, entries };
    }
    case 'clear-entry': {
      if (state.active === null) return state;
      const key = String(state.active);
      if (state.entries[key] === undefined) return state;
      return { ...state, entries: withoutKey(state.entries, key) };
    }
    case 'select-cell': {
      if (!state.settings.select || !drawn(action.cell) || state.hidden.includes(action.cell)) {
        return state;
      }
      return { ...state, selected: state.selected === action.cell ? null : action.cell };
    }
    case 'toggle-paint': {
      if (
        !state.settings.paint ||
        !drawn(action.cell) ||
        state.hidden.includes(action.cell) ||
        state.settings.prepainted.includes(action.cell)
      ) {
        return state;
      }
      const painted = state.painted.includes(action.cell)
        ? state.painted.filter((cell) => cell !== action.cell)
        : sortedUnique([...state.painted, action.cell]);
      return { ...state, painted };
    }
    default:
      return state;
  }
}

function clampInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function reduceCalc(state: CalcState, action: CalcAction): CalcState {
  const { settings } = state;
  if (settings.error !== null) return state;
  const cols = state.heights.length;
  const rows = settings.workStep + 1;

  const tap = (col: unknown, h: unknown): CalcState => {
    if (!settings.build) return state;
    if (typeof col !== 'number' || !Number.isInteger(col) || col < 0 || col >= cols) return state;
    if (typeof h !== 'number' || !Number.isInteger(h) || h < 1 || h > rows) return state;
    const heights = state.heights.slice();
    heights[col] = heights[col] === h ? h - 1 : h;
    return { ...state, heights, cursor: { col, h } };
  };

  switch (action.type) {
    case 'tap-cell':
      return tap(action.col, action.h);
    case 'toggle-at-cursor':
      return tap(state.cursor.col, state.cursor.h);
    case 'clear-build': {
      if (state.heights.every((height) => height === 0)) return state;
      return { ...state, heights: state.heights.map(() => 0) };
    }
    case 'move-cursor': {
      if (!settings.build) return state;
      const dx = clampInt(action.dx, -cols, cols);
      const dy = clampInt(action.dy, -rows, rows);
      if (dx === null || dy === null) return state;
      const col = Math.min(cols - 1, Math.max(0, state.cursor.col + dx));
      // dy가 양수이면 위쪽(높은 칸)이다.
      const h = Math.min(rows, Math.max(1, state.cursor.h + dy));
      if (col === state.cursor.col && h === state.cursor.h) return state;
      return { ...state, cursor: { col, h } };
    }
    case 'type': {
      if (!settings.expression || !EXPR_KEYS.includes(action.key)) return state;
      if (state.exprText.length >= EXPR_MAX_LENGTH) return state;
      return { ...state, exprText: state.exprText + action.key };
    }
    case 'backspace': {
      if (!settings.expression || state.exprText === '') return state;
      return { ...state, exprText: state.exprText.slice(0, -1) };
    }
    case 'clear-expr': {
      if (state.exprText === '') return state;
      return { ...state, exprText: '' };
    }
    case 'set-focus': {
      if (action.focus !== 'build' && action.focus !== 'expr') return state;
      if (action.focus === 'build' && !settings.build) return state;
      if (action.focus === 'expr' && !settings.expression) return state;
      return state.focus === action.focus ? state : { ...state, focus: action.focus };
    }
    case 'link': {
      if (action.step === null) return state.link === null ? state : { ...state, link: null };
      if (!settings.linkHighlight) return state;
      const step = action.step;
      const col = action.col;
      if (!Number.isInteger(step) || step < 1 || step > settings.stepsShown) return state;
      if (typeof col !== 'number' || !Number.isInteger(col) || col < 0 || col > 2 * step - 2) {
        return state;
      }
      if (state.link !== null && state.link.step === step && state.link.col === col) return state;
      return { ...state, link: { step, col } };
    }
    default:
      return state;
  }
}

function reduceGrowth(state: GrowthState, action: GrowthAction): GrowthState {
  const blanks = blankKeys(state.settings);
  switch (action.type) {
    case 'activate': {
      if (typeof action.cell !== 'string' || !blanks.includes(action.cell)) return state;
      return state.active === action.cell ? state : { ...state, active: action.cell };
    }
    case 'type': {
      if (state.active === null || typeof action.key !== 'string') return state;
      if (!/^[0-9]$/.test(action.key)) return state;
      const current = state.cells[state.active] ?? '';
      if (current.length >= MAX_DIGITS) return state;
      // "0" 뒤에 숫자를 쓰면 앞의 0을 바꾼다("02" 같은 글자를 만들지 않는다).
      const next = current === '0' ? action.key : current + action.key;
      return { ...state, cells: { ...state.cells, [state.active]: next } };
    }
    case 'backspace': {
      if (state.active === null) return state;
      const current = state.cells[state.active];
      if (current === undefined) return state;
      const cells =
        current.length <= 1
          ? withoutKey(state.cells, state.active)
          : { ...state.cells, [state.active]: current.slice(0, -1) };
      return { ...state, cells };
    }
    case 'clear': {
      if (state.active === null || state.cells[state.active] === undefined) return state;
      return { ...state, cells: withoutKey(state.cells, state.active) };
    }
    case 'move': {
      const dir = action.dir;
      if (dir !== 'left' && dir !== 'right' && dir !== 'up' && dir !== 'down') return state;
      const next = moveBlank(blanks, state.active, dir);
      return next === state.active ? state : { ...state, active: next };
    }
    default:
      return state;
  }
}

const SEQUENCE_TYPES: readonly string[] = [
  'place',
  'clear-slot',
  'move-cursor',
  'clear-all',
  'send',
  'play',
];

export function reduce(state: PatternState, action: PatternAction): PatternState {
  if (state.mode === 'growth') return reduceGrowth(state, action as GrowthAction);
  if (state.mode === 'calc-pattern') return reduceCalc(state, action as CalcAction);
  const isSequenceAction = SEQUENCE_TYPES.includes(action.type);
  if (state.mode === 'sequence') {
    return isSequenceAction ? reduceSequence(state, action as SequenceAction) : state;
  }
  return isSequenceAction ? state : reduceChart(state, action as ChartAction);
}
