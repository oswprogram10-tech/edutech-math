/**
 * E03의 눈금 계산. 화면 좌표 ↔ 수 값 변환만 담당하는 순수 함수 모음.
 *
 * 수 값은 전부 `Rational`로 계산한다. 눈금 인덱스 `k`는 정수이고
 * 값 = `min + k × tick`이다(T011 구현 결정 2). 화면 비율을 구할 때만 number를 쓴다.
 */
import { Rational } from '../../core/math/rational';
import type { Point } from '../../core/engine-sdk';
import { LINE_LEFT, LINE_RIGHT } from './types';
import type { NumberLineMode } from './types';

const ONE = Rational.of(1);
const TWO = Rational.of(2);
const TEN = Rational.of(10);

export interface TickRow {
  readonly index: number;
  readonly step: Rational;
  /** fraction에서 몇 등분인지. integer·decimal은 0. */
  readonly subdivisions: number;
  /** 화면(논리) y 좌표 */
  readonly y: number;
}

export interface Tick {
  readonly index: number;
  readonly value: Rational;
  readonly row: number;
  readonly x: number;
}

export interface SnapResult {
  readonly index: number;
  readonly row: number;
  readonly value: Rational;
  readonly x: number;
}

/** 부동소수 없이 내림. 분모는 항상 양수다. */
export function floorRational(value: Rational): bigint {
  if (value.n >= 0n) return value.n / value.d;
  return -((-value.n + value.d - 1n) / value.d);
}

/** 눈금 사이 정중앙은 위쪽(큰 쪽) 눈금으로 보낸다. */
export function roundRational(value: Rational): bigint {
  return floorRational(value.add(Rational.of(1, 2)));
}

export function clampNumber(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function tenTo(level: number): Rational {
  const safe = Math.max(0, Math.trunc(level));
  let result = ONE;
  for (let index = 0; index < safe; index += 1) result = result.mul(TEN);
  return result;
}

/** `unit / tick`이 10의 거듭제곱이면 그 지수를 돌려준다. */
export function levelForTick(unit: Rational, tick: Rational): number | null {
  if (tick.isZero() || tick.isNegative()) return null;
  const ratio = unit.div(tick);
  if (!ratio.isInteger() || ratio.n <= 0n) return null;
  let rest = ratio.n;
  let level = 0;
  while (rest > 1n) {
    if (rest % 10n !== 0n) return null;
    rest /= 10n;
    level += 1;
  }
  return level;
}

/** decimal에서 `zoom.from`/`zoom.to`가 허용하는 단계 범위. */
export function zoomRange(
  unit: Rational,
  from: string | undefined,
  to: string | undefined,
): { readonly min: number; readonly max: number } {
  const parse = (text: string | undefined): Rational | null => {
    if (text === undefined) return null;
    try {
      return Rational.parse(text);
    } catch {
      return null;
    }
  };
  const fromValue = parse(from);
  const toValue = parse(to);
  const min = fromValue ? levelForTick(unit, fromValue) : 0;
  const max = toValue ? levelForTick(unit, toValue) : 3;
  const low = clampNumber(min ?? 0, 0, 6);
  const high = clampNumber(max ?? 3, 0, 6);
  return low <= high ? { min: low, max: high } : { min: high, max: low };
}

export function tickStep(
  mode: NumberLineMode,
  unit: Rational,
  subdivisions: number,
  level: number,
): Rational {
  if (mode === 'integer') return unit;
  if (mode === 'decimal') return unit.div(tenTo(level));
  const parts = subdivisions > 0 ? subdivisions : 4;
  return unit.div(Rational.of(parts));
}

/** 눈금 줄의 y 좌표. 줄이 여러 개면 위아래로 고르게 편다. */
export function rowYs(count: number): number[] {
  if (count <= 1) return [300];
  const top = 240;
  const bottom = 360;
  const gap = (bottom - top) / (count - 1);
  return Array.from({ length: count }, (_, index) => top + index * gap);
}

export interface RowSpec {
  readonly mode: NumberLineMode;
  readonly unit: string;
  readonly subdivisions: readonly number[];
  readonly zoomLevel: number;
}

export function buildRows(spec: RowSpec): TickRow[] {
  const unit = parseValue(spec.unit) ?? ONE;
  if (spec.mode === 'fraction') {
    const parts = spec.subdivisions.length > 0 ? spec.subdivisions : [4];
    const ys = rowYs(parts.length);
    return parts.map((part, index) => ({
      index,
      step: tickStep('fraction', unit, part, 0),
      subdivisions: part,
      y: ys[index] ?? 300,
    }));
  }
  return [
    {
      index: 0,
      step: tickStep(spec.mode, unit, 1, spec.zoomLevel),
      subdivisions: 0,
      y: 300,
    },
  ];
}

export function parseValue(text: string | undefined): Rational | null {
  if (text === undefined) return null;
  try {
    return Rational.parse(text);
  } catch {
    return null;
  }
}

/** 눈금 개수(마지막 인덱스). min·max 밖으로 나가지 않는다. */
export function lastIndex(min: Rational, max: Rational, step: Rational): number {
  if (step.isZero() || step.isNegative()) return 0;
  const span = max.sub(min);
  if (span.isNegative()) return 0;
  return Number(floorRational(span.div(step)));
}

export function tickAt(min: Rational, step: Rational, index: number): Rational {
  return min.add(step.mul(Rational.of(index)));
}

export function nearestTick(
  min: Rational,
  max: Rational,
  step: Rational,
  row: number,
  value: Rational,
): Tick {
  const raw = value.sub(min).div(step);
  const last = lastIndex(min, max, step);
  const index = clampNumber(Number(roundRational(raw)), 0, last);
  const snapped = tickAt(min, step, index);
  return { index, value: snapped, row, x: 0 };
}

export function rowForY(y: number, rows: readonly TickRow[]): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  rows.forEach((row, index) => {
    const distance = Math.abs(row.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/** `min`~`max` 사이의 값을 수직선 비율(0~1)로. 화면 좌표에만 쓴다. */
export function proportionOf(value: Rational, min: Rational, max: Rational): number {
  const span = max.sub(min);
  if (span.isZero()) return 0;
  const ratio = value.sub(min).div(span);
  const approx = Number(ratio.n) / Number(ratio.d);
  return clampNumber(approx, 0, 1);
}

export function xOfValue(value: Rational, min: Rational, max: Rational): number {
  return LINE_LEFT + proportionOf(value, min, max) * (LINE_RIGHT - LINE_LEFT);
}

export function valueOfX(x: number, min: Rational, max: Rational): Rational {
  const clamped = clampNumber(x, LINE_LEFT, LINE_RIGHT);
  const ratio = (clamped - LINE_LEFT) / (LINE_RIGHT - LINE_LEFT);
  // 화면 비율은 number지만, 곱한 결과를 분수로 바꿔 정확한 Rational로 만든다.
  const span = max.sub(min);
  const numerator = BigInt(Math.round(ratio * 1_000_000));
  const scaled = span.mul(Rational.of(numerator, 1_000_000));
  return min.add(scaled);
}

/**
 * 화면 위치를 가장 가까운 눈금으로 스냅한다.
 * 줄이 여러 개면 y에 가장 가까운 줄을 고른다(T011 구현 결정 3).
 */
export function snapFromPosition(
  point: Point,
  min: Rational,
  max: Rational,
  rows: readonly TickRow[],
): SnapResult {
  const rowIndex = rowForY(point.y, rows);
  const row = rows[rowIndex] ?? rows[0];
  if (!row) {
    return { index: 0, row: 0, value: min, x: LINE_LEFT };
  }
  const value = valueOfX(point.x, min, max);
  const snapped = nearestTick(min, max, row.step, rowIndex, value);
  return {
    index: snapped.index,
    row: rowIndex,
    value: snapped.value,
    x: xOfValue(snapped.value, min, max),
  };
}

/** 키보드·버튼으로 한 눈금(또는 여러 눈금) 옮긴 값. */
export function moveValue(
  value: Rational,
  steps: number,
  row: TickRow,
  min: Rational,
  max: Rational,
): Rational {
  return nearestTick(min, max, row.step, row.index, value.add(row.step.mul(Rational.of(steps))))
    .value;
}

/** 점프 크기. `to - from`. */
export function jumpSize(from: Rational, to: Rational): Rational {
  return to.sub(from);
}

/** `scale` 변화량을 몇 단계 줌으로 볼지. 핀치 단위 테스트용 순수 함수. */
export function zoomDeltaForPinch(fromScale: number, toScale: number, step = 0.25): number {
  if (!Number.isFinite(fromScale) || !Number.isFinite(toScale) || step <= 0) return 0;
  return Math.round((toScale - fromScale) / step);
}

/** 핀치 후 눈금 단계. 허용 범위를 벗어나지 않는다. */
export function pinchLevel(
  level: number,
  fromScale: number,
  toScale: number,
  min: number,
  max: number,
  step = 0.25,
): number {
  return clampNumber(level + zoomDeltaForPinch(fromScale, toScale, step), min, max);
}

/** 소수 문자열로 보여 줄 수 있으면 소수로, 아니면 분수로. */
export function formatValue(value: Rational, mode: NumberLineMode): string {
  if (mode === 'decimal') {
    try {
      return value.toDecimalString();
    } catch {
      return value.toString();
    }
  }
  if (mode === 'fraction' && !value.isInteger() && !value.isNegative()) {
    const mixed = value.toMixed();
    if (mixed.whole > 0n && mixed.num > 0n) {
      return `${mixed.whole.toString()} ${mixed.num.toString()}/${mixed.den.toString()}`;
    }
  }
  return value.toString();
}

export function ticksInRow(row: TickRow, min: Rational, max: Rational): Tick[] {
  const last = lastIndex(min, max, row.step);
  const ticks: Tick[] = [];
  for (let index = 0; index <= last; index += 1) {
    const value = tickAt(min, row.step, index);
    ticks.push({ index, value, row: row.index, x: xOfValue(value, min, max) });
  }
  return ticks;
}

/**
 * 화면에 그릴 눈금만 고른다. 간격이 너무 좁으면 10개마다 하나만 그린다.
 * 스냅 자체는 모든 눈금을 쓴다.
 */
export function visibleTicks(row: TickRow, min: Rational, max: Rational): Tick[] {
  const all = ticksInRow(row, min, max);
  if (all.length <= 1) return all;
  const spacing = Math.abs((all[1]?.x ?? LINE_LEFT) - (all[0]?.x ?? LINE_LEFT));
  if (spacing >= 7) return all;
  const every = Math.max(1, Math.ceil(7 / Math.max(spacing, 0.01)));
  return all.filter((tick) => tick.index % every === 0);
}

/** 두 값이 같은 수인지. 문자열 표기가 달라도(`3/4`, `0.75`) 같은 값이면 참. */
export function sameValue(a: string, b: string): boolean {
  const left = parseValue(a);
  const right = parseValue(b);
  return left !== null && right !== null && left.equals(right);
}

export function compareValues(a: string, b: string): number {
  const left = parseValue(a);
  const right = parseValue(b);
  if (!left || !right) return 0;
  return left.compareTo(right);
}

export function isZero(value: string): boolean {
  const parsed = parseValue(value);
  return parsed !== null && parsed.isZero();
}

export function two(): Rational {
  return TWO;
}
