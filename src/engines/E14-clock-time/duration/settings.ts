/** E14 duration 설정 검사와 시각 변환. 잘못된 설정은 error 문구와 함께 안전한 기본 상태로 돌려준다. */
import { E14_MODE_STRINGS as S } from '../strings-modes.ko';
import type { DurationConfig, DurationState } from './types';

export function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** "H:MM"(0~23시)을 하루 분으로. 형식이 틀리면 null. */
export function parseDayTime(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const match = /^(2[0-3]|1\d|\d):([0-5]\d)$/.exec(text.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 하루 분을 "H:MM"으로. */
export function formatDayTime(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** 이름표용 시(1~12). */
export function hourLabel(minutes: number): number {
  return Math.floor(minutes / 60) % 12 || 12;
}

/** 이 자리가 띠 위에서 표시를 놓을 수 있는 자리인가(범위 안, step에 맞음). */
export function onGrid(
  state: Pick<DurationState, 'from' | 'to' | 'step'>,
  minutes: number,
): boolean {
  return isInt(minutes, state.from, state.to) && (minutes - state.from) % state.step === 0;
}

function fallback(error: string): DurationState {
  return {
    mode: 'duration',
    error,
    from: 120,
    to: 240,
    step: 5,
    startFixed: false,
    start: null,
    end: null,
    initialStart: null,
    moves: 0,
  };
}

/** 설정을 검사해 첫 상태를 만든다. 설정이 `mode`뿐이면 샌드박스 기본(2:00~4:00)을 쓴다. */
export function normalizeDuration(config: DurationConfig): DurationState {
  if (typeof config !== 'object' || config === null) return fallback(S.configError);
  const sample = Object.keys(config).every((key) => key === 'mode');
  const from = parseDayTime(config.from ?? (sample ? '2:00' : undefined));
  const to = parseDayTime(config.to ?? (sample ? '4:00' : undefined));
  if (from === null || to === null) return fallback(S.configError);
  if (from % 60 !== 0 || to % 60 !== 0) return fallback(S.configError);
  const hours = (to - from) / 60;
  if (hours < 1 || hours > 4) return fallback(S.configError);

  const step = config.step ?? 5;
  if (step !== 1 && step !== 5) return fallback(S.configError);
  if (config.startFixed !== undefined && typeof config.startFixed !== 'boolean') {
    return fallback(S.configError);
  }
  const startFixed = config.startFixed ?? false;

  let start: number | null = null;
  if (config.start !== undefined) {
    start = parseDayTime(config.start);
    if (start === null || !onGrid({ from, to, step }, start)) return fallback(S.configError);
  }
  if (startFixed && start === null) return fallback(S.configError);

  return {
    mode: 'duration',
    error: null,
    from,
    to,
    step,
    startFixed,
    start,
    end: null,
    initialStart: start,
    moves: 0,
  };
}
