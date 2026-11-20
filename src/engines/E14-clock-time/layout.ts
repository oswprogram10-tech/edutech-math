/**
 * E14 판 좌표(논리 1000×600). 본 판과 힌트 ② 오버레이가 같은 식을 써서 1px 안에 겹친다.
 * 화면 좌표·각도만 number다(수학 값 `minutes`는 정수).
 */
import { E14_STRINGS as S } from './strings.ko';
import { MINUTES_PER_HALF_DAY } from './types';

export const CLOCK = {
  cx: 275,
  cy: 255,
  r: 215,
  numeralR: 170,
  /** 오버레이 이름표 반지름(숫자 바깥). */
  labelR: 243,
  longLength: 186,
  shortLength: 118,
} as const;

/** 펼친 띠(0~60분). 위 숫자 1~12, 아래 0~60. */
export const STRIP = {
  left: 60,
  right: 940,
  numY: 518,
  barTop: 528,
  barBottom: 560,
  lowY: 592,
  labelY: 496,
} as const;

/** 시계 오른쪽 빈 자리: 톱니 이름표·디지털 표시. */
export const SIDE = { x: 545, captionY: 340, digitalY: 140 } as const;

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** 12시 방향이 0°, 시계 방향이 +. */
export function polar(angleDeg: number, radius: number): Pt {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CLOCK.cx + radius * Math.sin(rad), y: CLOCK.cy - radius * Math.cos(rad) };
}

function wrap(value: number, mod: number): number {
  return ((value % mod) + mod) % mod;
}

/** 짧은바늘 minutes × 0.5°, 긴바늘 (minutes % 60) × 6°. 끄는 동안에는 소수 분도 받는다. */
export function handAngles(minutes: number): { readonly hour: number; readonly minute: number } {
  const m = wrap(minutes, MINUTES_PER_HALF_DAY);
  return { hour: m * 0.5, minute: (m % 60) * 6 };
}

/** 큰 톱니는 긴바늘과, 작은 톱니는 짧은바늘과 같이 돈다(그림만). */
export function gearAngles(minutes: number): { readonly big: number; readonly small: number } {
  const m = wrap(minutes, MINUTES_PER_HALF_DAY);
  return { big: (m * 6) % 360, small: m * 0.5 };
}

/** 시계 중심에서 본 점의 각도(0~360, 12시 방향이 0°, 시계 방향). 중심 가까이면 null. */
export function pointerAngle(point: Pt): number | null {
  const dx = point.x - CLOCK.cx;
  const dy = point.y - CLOCK.cy;
  if (Math.hypot(dx, dy) < 8) return null;
  return wrap((Math.atan2(dx, -dy) * 180) / Math.PI, 360);
}

/** 각도 변화의 가장 짧은 방향(−180~180). 누적해서 12를 지나 감아 돌게 한다. */
export function angleDelta(from: number, to: number): number {
  return wrap(to - from + 180, 360) - 180;
}

export type DragHand = 'long' | 'short';

/** 드래그 시작 분 + 누적 각도 → 미리보기 분. 긴바늘 6°=1분, 짧은바늘 1°=2분. */
export function dragMinutes(startMinutes: number, accumulatedDeg: number, hand: DragHand): number {
  return wrap(
    startMinutes + (hand === 'long' ? accumulatedDeg / 6 : accumulatedDeg * 2),
    MINUTES_PER_HALF_DAY,
  );
}

/** 시계 숫자 n(1~12) 자리. */
export function numeralPoint(n: number, radius: number = CLOCK.numeralR): Pt {
  return polar((n % 12) * 30, radius);
}

/** 펼친 띠 위 x(0~60분). */
export function stripX(minuteOfHour: number): number {
  return STRIP.left + (minuteOfHour / 60) * (STRIP.right - STRIP.left);
}

/** 톱니 윤곽: n개 이빨, 안쪽 반지름 rIn·바깥 반지름 rOut. */
export function gearPath(teeth: number, rIn: number, rOut: number): string {
  const step = 360 / teeth;
  const half = step * 0.22;
  const pts: Pt[] = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = i * step;
    pts.push(polar(a - half * 1.6, rIn), polar(a - half, rOut), polar(a + half, rOut));
    pts.push(polar(a + half * 1.6, rIn));
  }
  return `${pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')} Z`;
}

// ── 바늘 방향 문장(aria). 시각은 계산해 말하지 않는다 ─────────────

function describe(hand: string, position: number): string {
  const rounded = Math.round(position * 1e6) / 1e6;
  if (Number.isInteger(rounded)) return S.pointsAt(hand, rounded % 12 === 0 ? 12 : rounded % 12);
  const lo = Math.floor(rounded) % 12 === 0 ? 12 : Math.floor(rounded) % 12;
  return S.between(hand, lo, (lo % 12) + 1);
}

/** 긴바늘: 분 ÷ 5 위치. 예: 30분이면 "긴바늘이 6을 가리켜요". */
export function longHandSentence(minutes: number): string {
  return describe(S.longHand, (minutes % 60) / 5);
}

/** 짧은바늘: 분 ÷ 60 위치. 예: 8시 30분이면 "짧은바늘이 8과 9 사이에 있어요". */
export function shortHandSentence(minutes: number): string {
  return describe(S.shortHand, minutes / 60);
}

export function handsSentence(minutes: number, hideMinuteHand: boolean): string {
  return hideMinuteHand
    ? shortHandSentence(minutes)
    : `${longHandSentence(minutes)}. ${shortHandSentence(minutes)}`;
}
