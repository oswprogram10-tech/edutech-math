/**
 * E02의 이벤트·predicates.
 *
 * `value-changed`는 E05·E07과 같은 모양(`{ value }`)이다.
 * flash는 학생이 만든 수가 아니므로 value-changed를 내지 않는다.
 */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { frameFillOf, totalOf } from './reduce';
import type { CountersAction, CountersState } from './types';

function argsRecord(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {};
  return args;
}

function numberArg(args: Readonly<Record<string, JsonValue>>, key: string): number | null {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function arrayArg(args: Readonly<Record<string, JsonValue>>, key: string): number[] | null {
  const value = args[key];
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === 'number' && Number.isFinite(item))) return null;
  return value as number[];
}

function fullFrames(state: CountersState): boolean[] {
  if (state.mode !== 'ten-frame') return [];
  return frameFillOf(state).map((count) => count >= 10);
}

/** `value-changed`는 '학생이 만든 수'가 있는 모드에서만 낸다(방울·다리 변형 제외). */
function emitsValue(state: CountersState): boolean {
  if (state.mode === 'flash') return false;
  if (state.mode === 'part-whole') return !('variant' in state);
  return true;
}

function isBubble(
  state: CountersState,
): state is Extract<CountersState, { variant: 'bubble-pairs' }> {
  return state.mode === 'part-whole' && 'variant' in state && state.variant === 'bubble-pairs';
}

export function emit(
  prev: CountersState,
  next: CountersState,
  action: CountersAction,
): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (next.mode === 'part-whole' && !('variant' in next) && action.type === 'record-split') {
    const last = next.recorded[next.recorded.length - 1];
    if (last) events.push({ name: 'split-recorded', payload: { a: last[0], b: last[1] } });
  }

  if (next.mode === 'ten-frame') {
    const before = fullFrames(prev);
    const after = fullFrames(next);
    after.forEach((full, frame) => {
      if (full && !before[frame]) events.push({ name: 'frame-filled', payload: { frame } });
    });
  }

  if (isBubble(prev) && isBubble(next) && next.pops.length > prev.pops.length) {
    const last = next.pops[next.pops.length - 1];
    if (last) events.push({ name: 'bubble-popped', payload: { values: [...last] } });
  }

  if (prev.mode === 'measure-out' && next.mode === 'measure-out' && next.bagCount > prev.bagCount) {
    events.push({
      name: 'bagged',
      payload: { size: next.groupSize ?? 0, bags: next.bagCount },
    });
  }

  if (emitsValue(prev) && emitsValue(next)) {
    const before = totalOf(prev);
    const after = totalOf(next);
    if (before !== after) events.push({ name: 'value-changed', payload: { value: after } });
  }

  return events;
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  totalIs: (observation: Observation, args) => {
    const value = numberArg(argsRecord(args), 'value');
    return value !== null && observation['total'] === value;
  },

  frameFillIs: (observation: Observation, args) => {
    const record = argsRecord(args);
    const frame = numberArg(record, 'frame');
    const value = numberArg(record, 'value');
    const frameFill = observation['frameFill'];
    if (frame === null || value === null || !Array.isArray(frameFill)) return false;
    return frameFill[frame] === value;
  },

  platesAre: (observation: Observation, args) => {
    const record = argsRecord(args);
    const values = arrayArg(record, 'values');
    const current = observation['plates'];
    if (values === null || !Array.isArray(current)) return false;
    const ordered = record['ordered'] === true;
    const left = current.filter((item): item is number => typeof item === 'number');
    if (!ordered) {
      return (
        [...left].sort((a, b) => a - b).join(',') === [...values].sort((a, b) => a - b).join(',')
      );
    }
    return left.join(',') === values.join(',');
  },

  distinctSplitsAtLeast: (observation: Observation, args) => {
    const record = argsRecord(args);
    const count = numberArg(record, 'count');
    if (count === null) return false;
    const total = numberArg(record, 'total');
    if (total !== null && observation['total'] !== total) return false;
    const distinct = observation['distinctSplits'];
    return typeof distinct === 'number' && distinct >= count;
  },

  allPlatesAtLeast: (observation: Observation, args) => {
    const min = numberArg(argsRecord(args), 'min');
    const plates = observation['plates'];
    if (min === null || !Array.isArray(plates)) return false;
    return plates.every((value) => typeof value === 'number' && value >= min);
  },

  unpairedIs: (observation: Observation, args) => {
    const value = numberArg(argsRecord(args), 'value');
    return value !== null && observation['unpaired'] === value;
  },

  historyIncludesInOrder: (observation: Observation, args) => {
    const values = arrayArg(argsRecord(args), 'values');
    const history = observation['history'];
    if (values === null || !Array.isArray(history)) return false;
    let index = 0;
    for (const item of history) {
      if (typeof item === 'number' && item === values[index]) index += 1;
      if (index >= values.length) return true;
    }
    return values.length === 0;
  },

  reachedAll: (observation: Observation, args) => {
    const values = arrayArg(argsRecord(args), 'values');
    const reached = observation['reached'];
    if (values === null || !Array.isArray(reached)) return false;
    return values.every((value) => reached.includes(value));
  },

  predictionIs: (observation: Observation, args) => {
    const value = numberArg(argsRecord(args), 'value');
    return value !== null && observation['prediction'] === value;
  },

  pairedDone: (observation: Observation) => observation['paired'] === true,

  pileIs: (observation: Observation, args) => {
    const value = numberArg(argsRecord(args), 'value');
    return value !== null && observation['pile'] === value;
  },

  allPlatesEqual: (observation: Observation) => observation['equal'] === true,

  bagsIs: (observation: Observation, args) => {
    const value = numberArg(argsRecord(args), 'value');
    return value !== null && observation['bags'] === value;
  },

  looseIs: (observation: Observation, args) => {
    const value = numberArg(argsRecord(args), 'value');
    return value !== null && observation['loose'] === value;
  },

  groupSizeIs: (observation: Observation, args) => {
    const value = numberArg(argsRecord(args), 'value');
    return value !== null && observation['groupSize'] === value;
  },

  popsAtLeast: (observation: Observation, args) => {
    const count = numberArg(argsRecord(args), 'count');
    const pops = observation['popCount'];
    return count !== null && typeof pops === 'number' && pops >= count;
  },

  poppedWith: (observation: Observation, args) => {
    const size = numberArg(argsRecord(args), 'size');
    const pops = observation['pops'];
    if (size === null || !Array.isArray(pops)) return false;
    return pops.some(
      (values) =>
        Array.isArray(values) &&
        values.every((value) => typeof value === 'number') &&
        values.reduce<number>((sum, value) => sum + (typeof value === 'number' ? value : 0), 0) ===
          size,
    );
  },

  streakAtLeast: (observation: Observation, args) => {
    const count = numberArg(argsRecord(args), 'count');
    const streak = observation['streak'];
    return count !== null && typeof streak === 'number' && streak >= count;
  },

  bridgeFits: (observation: Observation) => observation['fits'] === true,

  placedInclude: (observation: Observation, args) => {
    const length = numberArg(argsRecord(args), 'length');
    const placed = observation['placed'];
    if (length === null || !Array.isArray(placed)) return false;
    return placed.includes(length);
  },

  distinctBridgesAtLeast: (observation: Observation, args) => {
    const count = numberArg(argsRecord(args), 'count');
    const distinct = observation['distinctBridges'];
    return count !== null && typeof distinct === 'number' && distinct >= count;
  },
};
