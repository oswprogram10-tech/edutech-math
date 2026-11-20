/**
 * E19 판 좌표(논리 1000×600). 본 판과 힌트 ② 오버레이가 같은 식을 써서 1px 안에 겹친다.
 * 화면 좌표만 number다. 수학 값(평균·받침점)은 Rational에서 한 번만 number로 바꾼다.
 */
import { Rational } from '../../core/math';
import type { LevelingState, OutlierState, SeesawState } from './types';

export function toNumber(value: Rational): number {
  return Number(value.n) / Number(value.d);
}

// ── leveling ──────────────────────────────────────────────

export const LEVEL = {
  left: 40,
  /** 기둥 구역의 오른쪽 끝. 그 오른쪽(750~)은 sum-tower 오버레이 자리다. */
  right: 740,
  baseY: 500,
  topLimit: 130,
  towerX: 770,
  towerW: 56,
} as const;

export interface LevelColumn {
  readonly index: number;
  /** 기둥 가운데 x */
  readonly cx: number;
  readonly left: number;
}

export interface LevelGeometry {
  readonly colW: number;
  readonly blockW: number;
  readonly blockH: number;
  readonly columns: readonly LevelColumn[];
}

export function levelGeometry(state: Pick<LevelingState, 'heights' | 'maxHeight'>): LevelGeometry {
  const n = state.heights.length;
  const colW = Math.min(110, (LEVEL.right - LEVEL.left) / n);
  const blockW = Math.min(72, colW - 12);
  const blockH = Math.max(
    10,
    Math.min(32, Math.floor((LEVEL.baseY - LEVEL.topLimit) / state.maxHeight)),
  );
  // 기둥 구역 가운데로 모은다.
  const start = LEVEL.left + (LEVEL.right - LEVEL.left - colW * n) / 2;
  const columns = state.heights.map((_, index) => ({
    index,
    cx: start + colW * index + colW / 2,
    left: start + colW * index,
  }));
  return { colW, blockW, blockH, columns };
}

/** x 위치가 몇 번째 기둥 칸인지. 기둥 구역 밖이면 null. */
export function columnAt(geometry: LevelGeometry, x: number): number | null {
  const first = geometry.columns[0];
  if (!first) return null;
  const index = Math.floor((x - first.left) / geometry.colW);
  return index >= 0 && index < geometry.columns.length ? index : null;
}

// ── 수직선(seesaw·outlier 공용) ───────────────────────────

export const AXIS = { left: 80, right: 920, y: 330 } as const;

export function axisX(min: number, max: number, value: number | Rational): number {
  const v = typeof value === 'number' ? value : toNumber(value);
  return AXIS.left + ((v - min) / (max - min)) * (AXIS.right - AXIS.left);
}

/** 눈금 글자 간격: 글자가 겹치지 않게 최대 약 14개. */
export function tickEvery(min: number, max: number): number {
  const span = max - min;
  for (const step of [1, 2, 5, 10, 20, 50]) if (span / step <= 14) return step;
  return 100;
}

export function tickValues(min: number, max: number): number[] {
  const every = tickEvery(min, max);
  const first = Math.ceil(min / every) * every;
  const out: number[] = [];
  for (let v = first; v <= max; v += every) out.push(v);
  return out;
}

/** 같은 값끼리 위로 쌓을 때 이 자리의 층(0부터). */
export function stackIndex(values: readonly number[], index: number): number {
  let level = 0;
  for (let i = 0; i < index; i += 1) if (values[i] === values[index]) level += 1;
  return level;
}

// ── seesaw ───────────────────────────────────────────────

export const SEESAW = {
  plankY: 330,
  plankHalf: 14,
  weightW: 30,
  weightH: 26,
  weightGap: 3,
  triangleH: 70,
} as const;

/** 돌림힘 부호와 크기로 정한 판자 각도(도). 오른쪽으로 기울면 양수. */
export function plankAngle(
  sign: -1 | 0 | 1,
  torque: Rational,
  count: number,
  min: number,
  max: number,
): number {
  if (sign === 0) return 0;
  const ratio = Math.min(1, toNumber(torque.abs()) / (count * (max - min)));
  return sign * (4 + 8 * ratio);
}

// ── outlier ──────────────────────────────────────────────

export const OUTLIER = {
  dotR: 16,
  dotStep: 34,
  firstDotY: 330 - 26,
  lineTop: 120,
  lineBottom: 346,
} as const;

export function dotY(level: number): number {
  return OUTLIER.firstDotY - level * OUTLIER.dotStep;
}

// ── 값 쓰기 ──────────────────────────────────────────────

/** 대분수와, 유한소수이면 소수를 함께: "10과 3/5 (10.6)". 정수는 그대로. */
export function formatValue(value: Rational): string {
  if (value.isInteger()) return value.toString();
  const mixed = value.toMixed();
  const sign = value.isNegative() ? '-' : '';
  const fraction = `${mixed.num}/${mixed.den}`;
  const text = mixed.whole === 0n ? `${sign}${fraction}` : `${mixed.whole}과 ${fraction}`;
  return value.isTerminatingDecimal() ? `${text} (${value.toDecimalString()})` : text;
}

/** 받침점 글: 유한소수는 소수로, 아니면 분수로. */
export function formatPoint(value: Rational): string {
  if (value.isInteger()) return value.toString();
  return value.isTerminatingDecimal() ? value.toDecimalString() : value.toString();
}

// ── 끌기 좌표 변환 ─────────────────────────────────────────

/** 화면 x에 가장 가까운 격자 받침점. */
export function nearestFulcrum(
  state: Pick<SeesawState, 'min' | 'max' | 'step'>,
  x: number,
): Rational {
  const step = Rational.parse(state.step);
  const stepNumber = Number(step.n) / Number(step.d);
  const raw = ((x - AXIS.left) / (AXIS.right - AXIS.left)) * (state.max - state.min);
  const kMax = Math.round((state.max - state.min) / stepNumber);
  const k = Math.max(0, Math.min(kMax, Math.round(raw / stepNumber)));
  return Rational.of(state.min).add(step.mul(Rational.of(k)));
}

export function valueFromX(state: Pick<OutlierState, 'min' | 'max'>, x: number): number {
  const raw = state.min + ((x - AXIS.left) / (AXIS.right - AXIS.left)) * (state.max - state.min);
  return Math.max(state.min, Math.min(state.max, Math.round(raw)));
}

/** 글 가장자리가 판 밖으로 나가지 않게 정렬을 고른다. */
export function anchorAt(x: number): 'start' | 'middle' | 'end' {
  if (x < 190) return 'start';
  if (x > 810) return 'end';
  return 'middle';
}
