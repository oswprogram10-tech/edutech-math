/** E14의 공개 이벤트·판정(순수 함수). 이벤트에는 시각(정답)을 싣지 않는다. */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { parseTime } from './settings';
import type { ClockAction, ClockState } from './types';

export const EVENT_NAMES = ['clock-changed'] as const;

export function emit(prev: ClockState, next: ClockState, action: ClockAction): EngineEvent[] {
  void action;
  if (prev === next) return [];
  return [{ name: 'clock-changed', payload: { moved: next.moves >= 1, unrolled: next.unrolled } }];
}

function record(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return null;
  }
  return args;
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  /** args `{ time: "H:MM" }`: 지금 시각이 같은가. */
  timeIs: (observation: Observation, args) => {
    const wanted = parseTime(record(args)?.['time']);
    return wanted !== null && observation['minutes'] === wanted;
  },
  /** args `{ hour }`: 시(1~12)가 같은가. */
  hourIs: (observation, args) => {
    const hour = record(args)?.['hour'];
    return typeof hour === 'number' && observation['hour'] === hour;
  },
  /** args `{ minute }`: 분(0~59)이 같은가. */
  minuteIs: (observation, args) => {
    const minute = record(args)?.['minute'];
    return typeof minute === 'number' && observation['minute'] === minute;
  },
  moved: (observation) => typeof observation['moves'] === 'number' && observation['moves'] >= 1,
  unrolled: (observation) => observation['unrolled'] === true,
};
