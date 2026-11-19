/**
 * E15 reduce. 순수 함수이고 상태는 JSON으로 직렬화된다.
 * 바뀌는 것이 없으면 같은 상태 객체를 그대로 돌려준다.
 */
import { drawnCells, inRange } from './chart';
import { chartSettings, sequenceSettings } from './settings';
import { chartRangeOf } from './types';
import type {
  ChartAction,
  ChartState,
  PatternAction,
  PatternConfig,
  PatternState,
  SequenceAction,
  SequenceState,
} from './types';

export function createInitialState(config: PatternConfig): PatternState {
  const mode = (config as { mode?: unknown } | undefined)?.mode;
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

const SEQUENCE_TYPES: readonly string[] = [
  'place',
  'clear-slot',
  'move-cursor',
  'clear-all',
  'send',
  'play',
];

export function reduce(state: PatternState, action: PatternAction): PatternState {
  const isSequenceAction = SEQUENCE_TYPES.includes(action.type);
  if (state.mode === 'sequence') {
    return isSequenceAction ? reduceSequence(state, action as SequenceAction) : state;
  }
  return isSequenceAction ? state : reduceChart(state, action as ChartAction);
}
