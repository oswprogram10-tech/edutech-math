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

/** 부동소수 없이 올림. 분모는 항상 양수다. */
export function ceilRational(value: Rational): bigint {
  if (value.n >= 0n) return (value.n + value.d - 1n) / value.d;
  return -(-value.n / value.d);
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

/**
 * 그 단계에서 눈금 10칸이 보이도록 창 폭을 정한다.
 * 전체 폭이 10칸보다 좁으면 전체를 보여 준다.
 */
export function viewWidth(fullSpan: Rational, tick: Rational): Rational {
  if (tick.isZero() || tick.isNegative()) return fullSpan;
  const tenTicks = tick.mul(TEN);
  return tenTicks.compareTo(fullSpan) < 0 ? tenTicks : fullSpan;
}

/**
 * `width` 폭의 창을 `center` 가운데 두고 `[min, max]` 안으로 밀어 넣는다.
 * `step`을 주면 창의 왼쪽 끝을 눈금에 맞춰, 창 안에 눈금 11개(10칸)가
 * 들어가게 한다. 눈금 격자에 맞출 수 없으면 그냥 가운데 둔다.
 */
export function centeredView(
  min: Rational,
  max: Rational,
  width: Rational,
  center: Rational,
  step?: Rational,
): { readonly min: Rational; readonly max: Rational } {
  const full = max.sub(min);
  if (width.compareTo(full) >= 0 || width.isZero() || width.isNegative()) {
    return { min, max };
  }
  let low = center.sub(width.div(Rational.of(2)));
  let high = low.add(width);
  if (step && !step.isZero() && !step.isNegative()) {
    const tickIndex = roundRational(low.sub(min).div(step));
    low = min.add(step.mul(Rational.of(tickIndex)));
    high = low.add(width);
  }
  if (low.compareTo(min) < 0) {
    low = min;
    high = min.add(width);
  }
  if (high.compareTo(max) > 0) {
    high = max;
    low = max.sub(width);
  }
  return { min: low, max: high };
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
 * 화면 위치를 가장 가까운 **보이는** 눈금으로 스냅한다.
 * 줄이 여러 개면 y에 가장 가까운 줄을 고른다(T011 구현 결정 3).
 * 보기 범위 밖의 눈금은 쓰지 않는다(요구 6).
 */
export function snapFromPosition(
  point: Point,
  originMin: Rational,
  viewMin: Rational,
  viewMax: Rational,
  rows: readonly TickRow[],
): SnapResult {
  const rowIndex = rowForY(point.y, rows);
  const row = rows[rowIndex] ?? rows[0];
  if (!row) {
    return { index: 0, row: 0, value: viewMin, x: LINE_LEFT };
  }
  const value = valueOfX(point.x, viewMin, viewMax);
  const snapped = nearestVisibleTick(row, originMin, viewMin, viewMax, value);
  if (!snapped) {
    return { index: 0, row: rowIndex, value: viewMin, x: LINE_LEFT };
  }
  return {
    index: snapped.index,
    row: rowIndex,
    value: snapped.value,
    x: snapped.x,
  };
}

/** 키보드·버튼으로 보이는 눈금 한 칸(또는 여러 칸) 옮긴 값. */
export function moveValue(
  value: Rational,
  steps: number,
  row: TickRow,
  originMin: Rational,
  viewMin: Rational,
  viewMax: Rational,
): Rational {
  const ticks = visibleTicks(row, originMin, viewMin, viewMax);
  if (ticks.length === 0) {
    return nearestTick(originMin, viewMax, row.step, row.index, value).value;
  }
  let position = 0;
  let bestDistance: Rational | null = null;
  ticks.forEach((tick, index) => {
    const distance = tick.value.sub(value).abs();
    if (bestDistance === null || distance.compareTo(bestDistance) < 0) {
      bestDistance = distance;
      position = index;
    }
  });
  const target = clampNumber(position + Math.trunc(steps), 0, ticks.length - 1);
  return ticks[target]?.value ?? value;
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

/** 보기 범위 안에 들어가는 눈금의 첫 인덱스(전체 min 기준). */
export function firstTickIndexInView(
  originMin: Rational,
  step: Rational,
  viewMin: Rational,
): number {
  if (step.isZero() || step.isNegative()) return 0;
  return Math.max(0, Number(ceilRational(viewMin.sub(originMin).div(step))));
}

/** 보기 범위 안에 들어가는 눈금의 마지막 인덱스(전체 min 기준). */
export function lastTickIndexInView(
  originMin: Rational,
  step: Rational,
  viewMax: Rational,
): number {
  if (step.isZero() || step.isNegative()) return 0;
  return Math.max(0, Number(floorRational(viewMax.sub(originMin).div(step))));
}

/**
 * 보기 범위 안의 눈금만 만든다. 눈금 인덱스는 항상 전체 `min`을 기준으로 센다.
 * 화면 x는 보기 범위에 맞춰 계산한다.
 */
export function ticksInView(
  row: TickRow,
  originMin: Rational,
  viewMin: Rational,
  viewMax: Rational,
): Tick[] {
  const first = firstTickIndexInView(originMin, row.step, viewMin);
  const last = lastTickIndexInView(originMin, row.step, viewMax);
  if (last < first) return [];
  const ticks: Tick[] = [];
  for (let index = first; index <= last; index += 1) {
    const value = tickAt(originMin, row.step, index);
    ticks.push({ index, value, row: row.index, x: xOfValue(value, viewMin, viewMax) });
  }
  return ticks;
}

/**
 * 화면에 그릴 눈금만 고른다. 간격이 너무 좁으면 10개마다 하나만 그린다.
 * 스냅도 **그려진 눈금**만 쓴다(요구 6).
 */
export function visibleTicks(
  row: TickRow,
  originMin: Rational,
  viewMin: Rational,
  viewMax: Rational,
): Tick[] {
  const all = ticksInView(row, originMin, viewMin, viewMax);
  if (all.length <= 1) return all;
  const spacing = Math.abs((all[1]?.x ?? LINE_LEFT) - (all[0]?.x ?? LINE_LEFT));
  if (spacing >= 7) return all;
  const every = Math.max(1, Math.ceil(7 / Math.max(spacing, 0.01)));
  const filtered = all.filter((tick) => tick.index % every === 0);
  return filtered.length > 0 ? filtered : all.slice(0, 1);
}

/** 보이는 눈금 중 값과 가장 가까운 것. 정중앙은 큰 쪽으로 보낸다. */
export function nearestVisibleTick(
  row: TickRow,
  originMin: Rational,
  viewMin: Rational,
  viewMax: Rational,
  value: Rational,
): Tick | null {
  const ticks = visibleTicks(row, originMin, viewMin, viewMax);
  let best: Tick | null = null;
  let bestDistance: Rational | null = null;
  for (const tick of ticks) {
    const distance = tick.value.sub(value).abs();
    if (
      best === null ||
      bestDistance === null ||
      distance.compareTo(bestDistance) < 0 ||
      (distance.equals(bestDistance) && tick.value.compareTo(best.value) > 0)
    ) {
      best = tick;
      bestDistance = distance;
    }
  }
  return best;
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
