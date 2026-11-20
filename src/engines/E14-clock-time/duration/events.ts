/** E14 duration의 공개 이벤트·판정(순수 함수). 이벤트에는 시각·걸린 시간을 싣지 않는다. */
import type {
  EngineEvent,
  EnginePredicate,
  JsonValue,
  Observation,
} from '../../../core/engine-sdk';
import { parseDayTime } from './settings';
import type { DurationState } from './types';

export const DURATION_EVENT_NAMES = ['duration-changed'] as const;

export function emitDuration(prev: DurationState, next: DurationState): EngineEvent[] {
  if (prev === next) return [];
  return [
    {
      name: 'duration-changed',
      payload: { startPlaced: next.start !== null, endPlaced: next.end !== null },
    },
  ];
}

function record(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return null;
  }
  return args;
}

function sameTime(observed: unknown, wanted: unknown): boolean {
  const a = parseDayTime(observed);
  const b = parseDayTime(wanted);
  return a !== null && b !== null && a === b;
}

export const durationPredicates: Readonly<Record<string, EnginePredicate>> = {
  /** args `{ time: "H:MM" }`: 시작 표시가 그 시각에 있는가. */
  startIs: (observation: Observation, args) =>
    sameTime(observation['start'], record(args)?.['time']),
  /** args `{ time: "H:MM" }`: 끝 표시가 그 시각에 있는가. */
  endIs: (observation: Observation, args) => sameTime(observation['end'], record(args)?.['time']),
  /** args `{ minutes }`: 걸린 시간이 그 분인가. */
  elapsedIs: (observation: Observation, args) => {
    const minutes = record(args)?.['minutes'];
    return typeof minutes === 'number' && observation['elapsed'] === minutes;
  },
  bothPlaced: (observation: Observation) =>
    typeof observation['start'] === 'string' && typeof observation['end'] === 'string',
};
