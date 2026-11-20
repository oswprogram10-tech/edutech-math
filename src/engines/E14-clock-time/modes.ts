/**
 * E14의 모드 묶음. 설정·상태·Action 합집합과 모드별 reduce·observe·emit 분배를 한곳에 둔다.
 * 모드별 규칙은 각 모드 폴더(`duration/`, `calendar/`, clock 파일)에 있고 여기서는 `mode`로 나누기만 한다.
 */
import type { EngineEvent, EnginePredicate, Observation } from '../../core/engine-sdk';
import { createCalendarState, reduceCalendar } from './calendar/reduce';
import { CALENDAR_EVENT_NAMES, calendarPredicates, emitCalendar } from './calendar/events';
import { observeCalendar } from './calendar/observe';
import type { CalendarAction, CalendarConfig, CalendarState } from './calendar/types';
import { createDurationState, reduceDuration } from './duration/reduce';
import { DURATION_EVENT_NAMES, durationPredicates, emitDuration } from './duration/events';
import { observeDuration } from './duration/observe';
import type { DurationAction, DurationConfig, DurationState } from './duration/types';
import { EVENT_NAMES, emit as emitClock, predicates as clockPredicates } from './events';
import { observe as observeClock } from './observe';
import { createInitialState as createClockState, reduce as reduceClock } from './reduce';
import type { ClockAction, ClockConfig, ClockState } from './types';

export type E14Config = ClockConfig | DurationConfig | CalendarConfig;
export type E14State = ClockState | DurationState | CalendarState;
export type E14Action = ClockAction | DurationAction | CalendarAction;

export const E14_MODES = ['clock', 'duration', 'calendar'];

export const E14_EVENT_NAMES = [
  ...EVENT_NAMES,
  ...DURATION_EVENT_NAMES,
  ...CALENDAR_EVENT_NAMES,
] as const;

export const E14_PREDICATES: Readonly<Record<string, EnginePredicate>> = {
  ...clockPredicates,
  ...durationPredicates,
  ...calendarPredicates,
};

function modeOf(config: E14Config): unknown {
  return typeof config === 'object' && config !== null ? config.mode : undefined;
}

export function createInitialState(config: E14Config): E14State {
  const mode = modeOf(config);
  if (mode === 'duration') return createDurationState(config as DurationConfig);
  if (mode === 'calendar') return createCalendarState(config as CalendarConfig);
  return createClockState(config as ClockConfig);
}

export function reduce(state: E14State, action: E14Action): E14State {
  if (state.mode === 'duration') return reduceDuration(state, action as DurationAction);
  if (state.mode === 'calendar') return reduceCalendar(state, action as CalendarAction);
  return reduceClock(state, action as ClockAction);
}

export function observe(state: E14State): Observation {
  if (state.mode === 'duration') return observeDuration(state);
  if (state.mode === 'calendar') return observeCalendar(state);
  return observeClock(state);
}

export function emit(prev: E14State, next: E14State, action: E14Action): EngineEvent[] {
  if (prev.mode === 'duration' && next.mode === 'duration') return emitDuration(prev, next);
  if (prev.mode === 'calendar' && next.mode === 'calendar') return emitCalendar(prev, next);
  if (prev.mode === 'clock' && next.mode === 'clock') {
    return emitClock(prev, next, action as ClockAction);
  }
  return [];
}
