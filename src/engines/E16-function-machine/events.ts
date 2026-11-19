/**
 * E16의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * 이벤트: `trial-added {x, y}`, `rule-tested {valid, holdsAll}`, `cell-entered {cell}`, `x-changed {x}`.
 * Predicate는 인자가 잘못되면 false를 돌려준다.
 */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { formatRelation } from '../../core/math';
import { judge, rationalOf, tryParse } from './relation-check';
import type { FunctionAction, FunctionState } from './types';

export const EVENT_NAMES = ['trial-added', 'rule-tested', 'cell-entered', 'x-changed'] as const;

export function emit(
  prev: FunctionState,
  next: FunctionState,
  action: FunctionAction,
): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (prev.mode === 'black-box' && next.mode === 'black-box') {
    if (next.trials.length > prev.trials.length) {
      const [x, y] = next.trials[next.trials.length - 1] ?? ['', ''];
      events.push({ name: 'trial-added', payload: { x, y } });
    }
  }
  if (action.type === 'test-rule' && next.tested !== prev.tested && next.tested !== null) {
    events.push({
      name: 'rule-tested',
      payload: { valid: next.tested.ok, holdsAll: judge(next).holdsAll },
    });
  }
  if (
    prev.mode !== 'black-box' &&
    next.mode !== 'black-box' &&
    (action.type === 'type' || action.type === 'backspace' || action.type === 'clear') &&
    action.target === 'input' &&
    next.active !== null &&
    next.cells !== prev.cells
  ) {
    events.push({ name: 'cell-entered', payload: { cell: next.active } });
  }
  if (prev.mode === 'covary' && next.mode === 'covary' && prev.x !== next.x) {
    events.push({ name: 'x-changed', payload: { x: next.x } });
  }
  return events;
}

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function intArg(args: Readonly<Record<string, JsonValue>>, key: string): number | null {
  const value = args[key];
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function pairCount(observation: Observation): number {
  const pairs = observation.pairs;
  return Array.isArray(pairs) ? pairs.length : 0;
}

function numberOf(observation: Observation, key: string): number {
  const value = observation[key];
  return typeof value === 'number' ? value : 0;
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  holdsAll: (observation, args) => {
    const raw = recordOf(args).minPairs;
    const minPairs = raw === undefined ? 2 : intArg(recordOf(args), 'minPairs');
    if (minPairs === null || minPairs < 1) return false;
    const count = pairCount(observation);
    return (
      observation.ruleValid === true &&
      count >= minPairs &&
      numberOf(observation, 'holdsCount') === count
    );
  },
  matchesHidden: (observation) => observation.matchesHidden === true,
  ruleSolvedForBox: (observation) => {
    const info = recordOf(observation.ruleInfo);
    return observation.ruleValid === true && info.solvedForBox === true;
  },
  ruleFormDiffers: (observation, args) => {
    const from = recordOf(args).from;
    if (typeof from !== 'string' || observation.matchesHidden !== true) return false;
    const parsed = tryParse(from);
    if (!parsed.ok) return false;
    return observation.ruleFormatted !== formatRelation(parsed.rel);
  },
  trialsAtMost: (observation, args) => {
    const n = intArg(recordOf(args), 'n');
    const count = observation.trialCount;
    return n !== null && typeof count === 'number' && count <= n;
  },
  cellsCorrect: (observation) => observation.cellsCorrect === true,
  cellIs: (observation, args) => {
    const record = recordOf(args);
    const col = record.col;
    const which = record.which;
    const value = record.value;
    if ((typeof col !== 'number' && typeof col !== 'string') || typeof value !== 'string') {
      return false;
    }
    if (which !== 'x' && which !== 'y') return false;
    const expected = rationalOf(value);
    if (expected === null || !Array.isArray(observation.columns)) return false;
    const column = observation.columns.find(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        String(item.col) === String(col),
    );
    if (
      column === undefined ||
      column === null ||
      typeof column !== 'object' ||
      Array.isArray(column)
    ) {
      return false;
    }
    const entered = column[which];
    if (typeof entered !== 'string') return false;
    const actual = rationalOf(entered);
    return actual !== null && actual.equals(expected);
  },
  hasMisconception: (observation, args) => {
    const code = recordOf(args).code;
    const list = observation.misconceptions;
    return typeof code === 'string' && Array.isArray(list) && list.includes(code);
  },
};
