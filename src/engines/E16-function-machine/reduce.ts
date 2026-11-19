/**
 * E16 reduce. 순수 함수이고 상태는 JSON으로 직렬화된다.
 * 바뀌는 것이 없으면 같은 상태 객체를 그대로 돌려준다.
 */
import { Rational, formatRelation } from '../../core/math';
import { columnsOf, hiddenOf, safeSolve, tryParse } from './relation-check';
import { settingsFor } from './settings';
import type {
  BlackBoxState,
  CovaryState,
  FunctionAction,
  FunctionConfig,
  FunctionState,
  Target,
  TableState,
} from './types';

export const MAX_RULE_LENGTH = 40;
export const MAX_DRAFT_LENGTH = 3;
export const MAX_CELL_LENGTH = 6;
const HISTORY_LIMIT = 10;
const RULE_CHARS = new Set([...'0123456789○□+−×÷()=/']);

export function createInitialState(config: FunctionConfig): FunctionState {
  const { mode, settings } = settingsFor(config);
  const base = {
    ruleText: '',
    tested: null,
    ruleHistory: [] as string[],
    target: 'input' as Target,
    notice: null,
  };
  if (mode === 'table') {
    return { ...base, mode, settings, cells: {}, active: null };
  }
  if (mode === 'covary') {
    const x = String(settings.xMin);
    return { ...base, mode, settings, x, visited: [x], cells: {}, active: null };
  }
  return { ...base, mode: 'black-box', settings, draft: '', trials: [], lastX: null };
}

/** 키보드 기호를 규칙 입력 기호로 맞춘다. 허용하지 않는 글자는 null. */
export function ruleKey(key: string): string | null {
  const mapped = key === '-' ? '−' : key === '*' ? '×' : key;
  return mapped.length === 1 && RULE_CHARS.has(mapped) ? mapped : null;
}

function isDigit(key: string): boolean {
  return /^[0-9]$/.test(key);
}

function withTarget<S extends FunctionState>(state: S, target: Target): S {
  return state.target === target ? state : { ...state, target };
}

/** 입력 칸(수)을 고친다. black-box는 draft, table·covary는 활성 칸. */
function editInput(
  state: FunctionState,
  edit: (current: string, max: number) => string,
): FunctionState {
  if (state.settings.error !== null) return state;
  if (state.mode === 'black-box') {
    const draft = edit(state.draft, MAX_DRAFT_LENGTH);
    if (draft === state.draft && state.notice === null) return state;
    return { ...state, draft, notice: null };
  }
  if (state.active === null) return state;
  const current = state.cells[state.active] ?? '';
  const next = edit(current, MAX_CELL_LENGTH);
  if (next === current) return state;
  const active = state.active;
  const kept = Object.fromEntries(Object.entries(state.cells).filter(([key]) => key !== active));
  const cells = next === '' ? kept : { ...kept, [active]: next };
  return { ...state, cells };
}

function editRule(state: FunctionState, edit: (current: string) => string): FunctionState {
  if (!state.settings.ruleInput || state.settings.error !== null) return state;
  const ruleText = edit(state.ruleText);
  return ruleText === state.ruleText ? state : { ...state, ruleText };
}

function insertInput(state: BlackBoxState): BlackBoxState {
  const { settings } = state;
  if (settings.error !== null || state.draft === '') return state;
  const n = Number(state.draft);
  const [min, max] = settings.inputRange;
  if (n < min || n > max) {
    return state.notice === 'range' ? state : { ...state, notice: 'range' };
  }
  const x = Rational.of(n).toString();
  if (state.trials.some(([tx]) => tx === x)) {
    return { ...state, draft: '', lastX: x, notice: null };
  }
  if (settings.maxTrials !== null && state.trials.length >= settings.maxTrials) {
    return state.notice === 'limit' ? state : { ...state, notice: 'limit' };
  }
  const hidden = hiddenOf(settings.rule);
  const y = hidden === null ? null : safeSolve(hidden, Rational.of(n));
  if (y === null) return { ...state, notice: 'no-output' };
  return {
    ...state,
    draft: '',
    trials: [...state.trials, [x, y.toString()]],
    lastX: x,
    notice: null,
  };
}

function testRule(state: FunctionState): FunctionState {
  if (state.settings.error !== null) return state;
  const text = state.ruleText;
  if (text.trim() === '') return state;
  if (state.tested !== null && state.tested.text === text) return state;
  const parsed = tryParse(text);
  if (!parsed.ok) {
    return { ...state, tested: { text, ok: false, errorAt: parsed.errorAt } };
  }
  const formatted = formatRelation(parsed.rel);
  const last = state.ruleHistory[state.ruleHistory.length - 1];
  const ruleHistory =
    last === formatted
      ? state.ruleHistory
      : [...state.ruleHistory, formatted].slice(-HISTORY_LIMIT);
  return { ...state, tested: { text, ok: true, errorAt: null }, ruleHistory };
}

function activate(state: TableState | CovaryState, cell: string): FunctionState {
  const blank = columnsOf(state).some((column) => column.x.key === cell || column.y.key === cell);
  if (!blank) return state;
  if (state.active === cell && state.target === 'input') return state;
  return { ...state, active: cell, target: 'input' };
}

function setX(state: CovaryState, raw: string): CovaryState {
  if (!/^\d+$/.test(raw)) return state;
  const n = Math.min(state.settings.xMax, Math.max(state.settings.xMin, Number(raw)));
  const x = String(n);
  const visited = state.visited.includes(x)
    ? state.visited
    : [...state.visited, x].sort((a, b) => Number(a) - Number(b));
  const arrival = state.settings.blankRows.includes(n) ? `${x}.y` : state.active;
  if (x === state.x && visited === state.visited && arrival === state.active) return state;
  return { ...state, x, visited, active: arrival };
}

export function reduce(state: FunctionState, action: FunctionAction): FunctionState {
  switch (action.type) {
    case 'type': {
      if (action.target === 'input') {
        if (typeof action.key !== 'string') return state;
        // 표 칸에서만 분수(`1/2`)를 쓸 수 있다. 앞에 자연수가 있고 `/`가 아직 없을 때 한 번.
        if (action.key === '/' && state.mode !== 'black-box') {
          return withTarget(
            editInput(state, (current, max) =>
              /^\d+$/.test(current) && current.length < max ? `${current}/` : current,
            ),
            'input',
          );
        }
        if (!isDigit(action.key)) return state;
        return withTarget(
          editInput(state, (current, max) =>
            current.length >= max ? current : current === '0' ? action.key : current + action.key,
          ),
          'input',
        );
      }
      const key = typeof action.key === 'string' ? ruleKey(action.key) : null;
      if (key === null || !state.settings.ruleInput) return state;
      return withTarget(
        editRule(state, (current) => (current.length >= MAX_RULE_LENGTH ? current : current + key)),
        'rule',
      );
    }
    case 'backspace': {
      if (action.target === 'input') {
        return withTarget(
          editInput(state, (current) => current.slice(0, -1)),
          'input',
        );
      }
      return withTarget(
        editRule(state, (current) => current.slice(0, -1)),
        'rule',
      );
    }
    case 'clear': {
      if (action.target === 'input')
        return withTarget(
          editInput(state, () => ''),
          'input',
        );
      return withTarget(
        editRule(state, () => ''),
        'rule',
      );
    }
    case 'insert-input':
      return state.mode === 'black-box' ? insertInput(state) : state;
    case 'test-rule':
      return testRule(state);
    case 'focus': {
      if (action.target === 'rule' && !state.settings.ruleInput) return state;
      return withTarget(state, action.target);
    }
    case 'activate':
      return state.mode === 'black-box' || typeof action.cell !== 'string'
        ? state
        : activate(state, action.cell);
    case 'set-x':
      return state.mode === 'covary' ? setX(state, String(action.x)) : state;
    default:
      return state;
  }
}
