/** E14 calendar 설정 검사와 칸 위치 계산. 잘못된 설정은 error 문구와 함께 안전한 기본 상태로 돌려준다. */
import { E14_MODE_STRINGS as S } from '../strings-modes.ko';
import { daysInMonth, parseMonth, weekdayOf } from './date';
import type { CalendarConfig, CalendarState } from './types';

type Grid = Pick<CalendarState, 'first' | 'days'>;

export function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function colOf(state: Pick<CalendarState, 'first'>, day: number): number {
  return (state.first + day - 1) % 7;
}

export function rowOf(state: Pick<CalendarState, 'first'>, day: number): number {
  return Math.floor((state.first + day - 1) / 7);
}

export function rowCount(state: Grid): number {
  return Math.ceil((state.first + state.days) / 7);
}

/** (열, 줄)에 있는 날짜. 달 밖이면 null. */
export function dayAt(state: Grid, col: number, row: number): number | null {
  if (!isInt(col, 0, 6) || !isInt(row, 0, 5)) return null;
  const day = row * 7 + col - state.first + 1;
  return day >= 1 && day <= state.days ? day : null;
}

function fallback(error: string): CalendarState {
  return {
    mode: 'calendar',
    error,
    year: 2026,
    month: 11,
    days: 30,
    first: 0,
    hidden: [],
    weekdayHeader: true,
    canSelect: false,
    canFill: false,
    canArrow: false,
    selected: [],
    filled: {},
    segments: [],
    moves: 0,
  };
}

/** 설정을 검사해 첫 상태를 만든다. 설정이 `mode`뿐이면 샌드박스 기본(2026-11, 가림 4개, 조작 모두 켬)을 쓴다. */
export function normalizeCalendar(config: CalendarConfig): CalendarState {
  if (typeof config !== 'object' || config === null) return fallback(S.configError);
  const sample = Object.keys(config).every((key) => key === 'mode');
  const parsed = parseMonth(config.month ?? (sample ? '2026-11' : undefined));
  if (parsed === null) return fallback(S.configError);
  const days = daysInMonth(parsed.year, parsed.month);

  const rawHidden: unknown = config.hidden ?? (sample ? [8, 12, 19, 26] : []);
  if (!Array.isArray(rawHidden)) return fallback(S.configError);
  if (rawHidden.some((day) => !isInt(day, 1, days))) return fallback(S.configError);
  const hidden = [...new Set(rawHidden as number[])].sort((a, b) => a - b);

  const flags: unknown[] = [config.showWeekdayHeader, config.select, config.fill, config.arrows];
  if (flags.some((flag) => flag !== undefined && typeof flag !== 'boolean')) {
    return fallback(S.configError);
  }

  return {
    mode: 'calendar',
    error: null,
    year: parsed.year,
    month: parsed.month,
    days,
    first: weekdayOf(parsed.year, parsed.month, 1),
    hidden,
    weekdayHeader: config.showWeekdayHeader ?? true,
    canSelect: config.select ?? sample,
    canFill: config.fill ?? sample,
    canArrow: config.arrows ?? sample,
    selected: [],
    filled: {},
    segments: [],
    moves: 0,
  };
}
