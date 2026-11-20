/** E14 설정 검사·정리와 허용 분 규칙. 잘못된 설정은 error 문구와 함께 안전한 기본 상태로 돌려준다. */
import { E14_STRINGS as S } from './strings.ko';
import { MINUTES_PER_HALF_DAY } from './types';
import type { ClockConfig, ClockState, Granularity } from './types';

const GRANULARITIES: readonly Granularity[] = ['hour', 'half-hour', 'five-minute', 'minute'];

export function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** "H:MM"(1~12시)을 12시간 분으로. 형식이 틀리면 null. */
export function parseTime(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const match = /^(1[0-2]|[1-9]):([0-5]\d)$/.exec(text.trim());
  if (!match) return null;
  return (Number(match[1]) % 12) * 60 + Number(match[2]);
}

/** 시 표시: 0이면 12. */
export function hourOf(minutes: number): number {
  return Math.floor(minutes / 60) || 12;
}

export function minuteOf(minutes: number): number {
  return minutes % 60;
}

export function formatTime(minutes: number): string {
  return `${hourOf(minutes)}:${String(minuteOf(minutes)).padStart(2, '0')}`;
}

export function wrapMinutes(value: number): number {
  return ((value % MINUTES_PER_HALF_DAY) + MINUTES_PER_HALF_DAY) % MINUTES_PER_HALF_DAY;
}

function allMinutes(): number[] {
  return Array.from({ length: 60 }, (_, i) => i);
}

function granularityMinutes(granularity: Granularity): number[] {
  if (granularity === 'minute') return allMinutes();
  const step = granularity === 'hour' ? 60 : granularity === 'half-hour' ? 30 : 5;
  return Array.from({ length: 60 / step }, (_, i) => i * step);
}

/** 이 분이 허용 분인가. */
export function isAllowed(state: Pick<ClockState, 'allowed'>, minutes: number): boolean {
  return isInt(minutes, 0, MINUTES_PER_HALF_DAY - 1) && state.allowed.includes(minutes % 60);
}

/** 허용 분 전체(0~719) 오름차순. step이 이 목록 위를 한 칸씩 움직인다. */
export function allowedTotals(state: Pick<ClockState, 'allowed'>): number[] {
  const out: number[] = [];
  for (let m = 0; m < MINUTES_PER_HALF_DAY; m += 1) {
    if (state.allowed.includes(m % 60)) out.push(m);
  }
  return out;
}

/**
 * 끌어 놓은 분(raw)을 규칙에 맞게 붙인다.
 * 5-weak: 5의 배수에서 ±1분 안이면 그 배수로, 아니면 그대로. 그 밖: 가장 가까운 허용 분(같으면 앞쪽).
 */
export function snapMinutes(state: Pick<ClockState, 'allowed' | 'weakSnap'>, raw: number): number {
  const m = wrapMinutes(Math.round(raw));
  if (state.weakSnap) {
    const five = Math.round(m / 5) * 5;
    return Math.abs(m - five) <= 1 ? wrapMinutes(five) : m;
  }
  for (let d = 0; d <= 60; d += 1) {
    const forward = wrapMinutes(m + d);
    if (state.allowed.includes(forward % 60)) return forward;
    const backward = wrapMinutes(m - d);
    if (state.allowed.includes(backward % 60)) return backward;
  }
  return m;
}

function fallback(error: string): ClockState {
  return {
    mode: 'clock',
    error,
    minutes: 0,
    initial: 0,
    allowed: allMinutes(),
    weakSnap: false,
    showGears: false,
    hideMinuteHand: false,
    readOnly: false,
    digitalReadout: 'never',
    unroll: false,
    unrolled: false,
    moves: 0,
  };
}

/** 설정을 검사해 첫 상태를 만든다. 설정이 `mode`만 있으면 샌드박스 기본(3:00·톱니·펼치기)을 쓴다. */
export function normalizeConfig(config: ClockConfig): ClockState {
  if (typeof config !== 'object' || config === null) return fallback(S.configError);
  const sample = Object.keys(config).every((key) => key === 'mode');
  const start = parseTime(config.start ?? (sample ? '3:00' : '12:00'));
  if (start === null) return fallback(S.configError);

  const granularity = config.granularity ?? 'minute';
  if (!GRANULARITIES.includes(granularity)) return fallback(S.configError);

  let allowed: number[];
  let weakSnap = false;
  const snap = config.snapMinuteTo;
  if (snap === undefined) {
    allowed = granularityMinutes(granularity);
  } else if (snap === '5-weak') {
    allowed = allMinutes();
    weakSnap = true;
  } else if (Array.isArray(snap)) {
    if (snap.length === 0 || snap.some((v) => !isInt(v, 0, 59))) return fallback(S.configError);
    allowed = [...new Set(snap)].sort((a, b) => a - b);
  } else {
    return fallback(S.configError);
  }
  if (!allowed.includes(start % 60)) return fallback(S.configError);

  const flags: unknown[] = [
    config.showGears,
    config.hideMinuteHand,
    config.readOnly,
    config.unroll,
  ];
  if (flags.some((flag) => flag !== undefined && typeof flag !== 'boolean')) {
    return fallback(S.configError);
  }
  const readout = config.digitalReadout ?? 'never';
  if (readout !== 'never' && readout !== 'always' && readout !== 'after-submit') {
    return fallback(S.configError);
  }

  return {
    mode: 'clock',
    error: null,
    minutes: start,
    initial: start,
    allowed,
    weakSnap,
    showGears: config.showGears ?? sample,
    hideMinuteHand: config.hideMinuteHand ?? false,
    readOnly: config.readOnly ?? false,
    // 'after-submit'은 제출 결과를 엔진에 알리는 계약이 없어 'never'로 읽는다.
    digitalReadout: readout === 'always' ? 'always' : 'never',
    unroll: config.unroll ?? sample,
    unrolled: false,
    moves: 0,
  };
}
