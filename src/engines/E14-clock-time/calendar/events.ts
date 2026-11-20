/** E14 calendar의 공개 이벤트·판정(순수 함수). 이벤트에는 날짜 값을 싣지 않는다. */
import type {
  EngineEvent,
  EnginePredicate,
  JsonValue,
  Observation,
} from '../../../core/engine-sdk';
import type { CalendarState } from './types';

export const CALENDAR_EVENT_NAMES = ['calendar-changed'] as const;

export function emitCalendar(prev: CalendarState, next: CalendarState): EngineEvent[] {
  if (prev === next) return [];
  return [{ name: 'calendar-changed', payload: { arrows: next.segments.length } }];
}

function record(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return null;
  }
  return args;
}

function numbers(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((v) => typeof v === 'number') ? (value as number[]) : null;
}

export const calendarPredicates: Readonly<Record<string, EnginePredicate>> = {
  /** args `{ days: number[] }`: 고른 날이 그 집합과 같은가(순서·중복 무시). */
  selectedEquals: (observation: Observation, args) => {
    const wanted = numbers(record(args)?.['days']);
    const selected = numbers(observation['selected']);
    if (wanted === null || selected === null) return false;
    const a = new Set(wanted);
    const b = new Set(selected);
    return a.size === b.size && [...a].every((day) => b.has(day));
  },
  hiddenAllCorrect: (observation) => observation['hiddenCorrect'] === true,
  /** args `{ day, value }`: 그 칸에 학생이 그 수를 넣었는가. */
  filledIs: (observation, args) => {
    const rec = record(args);
    const day = rec?.['day'];
    const value = rec?.['value'];
    const filled = observation['filled'];
    if (typeof day !== 'number' || typeof value !== 'number') return false;
    if (filled === null || typeof filled !== 'object' || Array.isArray(filled)) return false;
    return (filled as Record<string, unknown>)[String(day)] === value;
  },
  /** args `{ n }`: 화살표를 n개 이상 그렸는가. */
  arrowsAtLeast: (observation, args) => {
    const n = record(args)?.['n'];
    return (
      typeof n === 'number' &&
      typeof observation['arrows'] === 'number' &&
      observation['arrows'] >= n
    );
  },
};
