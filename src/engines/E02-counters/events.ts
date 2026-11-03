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

export function emit(
  prev: CountersState,
  next: CountersState,
  action: CountersAction,
): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (next.mode === 'part-whole' && action.type === 'record-split') {
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

  if (prev.mode !== 'flash' && next.mode !== 'flash') {
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
};
