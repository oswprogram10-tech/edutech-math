/**
 * E03 range(수의 범위) 순수 reduce.
 *
 * 경계점은 값이 작은 순으로 늘 정렬해 저장한다(둘일 때 작은 쪽이 lower).
 * 목표 범위는 설정에 없다. 게이트 통과·막힘은 지금 학생이 만든 범위로만 계산한다.
 */
import { Rational } from '../../core/math/rational';
import { configRational, configRationals, makeBaseState } from './state-helpers';
import { floorRational, parseValue } from './ticks';
import type {
  NumberLineAction,
  NumberLineConfig,
  NumberLineState,
  RangeBoundState,
  RangeDirection,
  RangeState,
  RangeStory,
} from './types';

export type RangeAction = Extract<
  NumberLineAction,
  {
    readonly type:
      | 'place-bound'
      | 'move-bound'
      | 'toggle-closed'
      | 'set-direction'
      | 'remove-bound'
      | 'open-gate'
      | 'reset';
  }
>;

const ZERO = Rational.of(0);
const ONE = Rational.of(1);
const MAX_RIDERS = 10;

export interface RangeEnds {
  readonly lower: RangeBoundState | null;
  readonly upper: RangeBoundState | null;
}

/** 경계 하나 + 오른쪽 → lower, 왼쪽 → upper. 둘이면 작은 쪽이 lower. */
export function rangeEnds(range: RangeState): RangeEnds {
  const [first, second] = range.bounds;
  if (first && second) return { lower: first, upper: second };
  if (first && range.direction === 'right') return { lower: first, upper: null };
  if (first && range.direction === 'left') return { lower: null, upper: first };
  return { lower: null, upper: null };
}

export function rangeComplete(range: RangeState): boolean {
  const ends = rangeEnds(range);
  return ends.lower !== null || ends.upper !== null;
}

/** 키가 지금 범위 안인가. 경계가 속 찬 동그라미면 경계값도 안이다. */
export function rangeContains(range: RangeState, value: Rational): boolean {
  const ends = rangeEnds(range);
  if (ends.lower === null && ends.upper === null) return false;
  if (ends.lower) {
    const bound = parseValue(ends.lower.value);
    if (!bound) return false;
    const order = value.compareTo(bound);
    if (order < 0 || (order === 0 && !ends.lower.closed)) return false;
  }
  if (ends.upper) {
    const bound = parseValue(ends.upper.value);
    if (!bound) return false;
    const order = value.compareTo(bound);
    if (order > 0 || (order === 0 && !ends.upper.closed)) return false;
  }
  return true;
}

export interface RiderResults {
  readonly passed: number[];
  readonly blocked: number[];
}

export function riderResults(range: RangeState): RiderResults {
  const passed: number[] = [];
  const blocked: number[] = [];
  for (const rider of range.riders) {
    (rangeContains(range, Rational.of(rider)) ? passed : blocked).push(rider);
  }
  return { passed, blocked };
}

function storyOf(config: NumberLineConfig): RangeStory {
  const story = config.story;
  return story === 'train' || story === 'none' ? story : 'rollercoaster';
}

function sortBounds(bounds: readonly RangeBoundState[]): RangeBoundState[] {
  return [...bounds].sort((a, b) => {
    const left = parseValue(a.value) ?? ZERO;
    const right = parseValue(b.value) ?? ZERO;
    return left.compareTo(right);
  });
}

/** 설정의 `unit` 눈금에 맞춘 가장 가까운 값. 범위 밖은 끝 눈금이 된다(정중앙은 큰 쪽). */
function snapToUnit(min: Rational, max: Rational, unit: Rational, value: Rational): Rational {
  const clamped = value.compareTo(min) < 0 ? min : value.compareTo(max) > 0 ? max : value;
  const steps = clamped.sub(min).div(unit);
  const low = floorRational(steps);
  const lowValue = min.add(unit.mul(Rational.of(low)));
  const highValue = lowValue.add(unit);
  const useHigh =
    highValue.compareTo(max) <= 0 && highValue.sub(clamped).compareTo(clamped.sub(lowValue)) <= 0;
  return useHigh ? highValue : lowValue;
}

export function rangeSnap(state: NumberLineState, text: string): Rational | null {
  const value = parseValue(text);
  const min = parseValue(state.min);
  const max = parseValue(state.max);
  const unit = parseValue(state.unit);
  if (!value || !min || !max || !unit || unit.isZero() || unit.isNegative()) return null;
  return snapToUnit(min, max, unit, value);
}

export function createRangeState(config: NumberLineConfig): NumberLineState {
  const unitRaw = configRational(config.unit);
  const unit = unitRaw && !unitRaw.isZero() && !unitRaw.isNegative() ? unitRaw : ONE;
  const min = configRational(config.min) ?? ZERO;
  let max = configRational(config.max) ?? Rational.of(100);
  if (max.compareTo(min) <= 0) max = min.add(unit);

  const labelEvery =
    typeof config.subdivisions === 'number' &&
    Number.isInteger(config.subdivisions) &&
    config.subdivisions > 0 &&
    config.subdivisions <= 100
      ? config.subdivisions
      : 10;

  const riders: number[] = [];
  for (const rider of configRationals(config.riders)) {
    if (riders.length >= MAX_RIDERS) break;
    if (!rider.isInteger()) continue;
    if (rider.compareTo(min) < 0 || rider.compareTo(max) > 0) continue;
    riders.push(Number(rider.n));
  }

  const story = storyOf(config);
  const maxBounds: 1 | 2 = config.maxBounds === 2 ? 2 : 1;

  const presetBounds: RangeBoundState[] = [];
  const lower = config.preset?.lower;
  const upper = config.preset?.upper;
  for (const entry of [lower, upper]) {
    if (!entry) continue;
    const parsed = configRational(entry.value);
    if (!parsed) continue;
    presetBounds.push({
      value: snapToUnit(min, max, unit, parsed).toJSON(),
      closed: entry.closed === true,
    });
  }
  const bounds = sortBounds(presetBounds).slice(0, 2);
  let direction: RangeDirection | null = null;
  if (bounds.length === 1) direction = lower ? 'right' : 'left';

  const range: RangeState = {
    bounds,
    direction,
    gateOpened: false,
    story,
    riders,
    maxBounds: bounds.length === 2 ? 2 : maxBounds,
    locked: config.readOnly === true,
  };
  const state = makeBaseState({ mode: 'range', min, max, unit, range });
  return { ...state, subdivisions: [labelEvery] };
}

function withRange(state: NumberLineState, range: RangeState): NumberLineState {
  // 범위를 바꾸면 이전 게이트 결과는 낡은 것이므로 닫는다.
  return { ...state, range: { ...range, gateOpened: false } };
}

/** 바뀐 것이 없으면 null. */
export function reduceRangeAction(
  state: NumberLineState,
  action: RangeAction,
): NumberLineState | null {
  const range = state.range;
  if (!range) return null;

  if (action.type === 'open-gate') {
    if (range.story === 'none' || range.gateOpened || !rangeComplete(range)) return null;
    return { ...state, range: { ...range, gateOpened: true } };
  }
  if (range.locked) return null;

  switch (action.type) {
    case 'place-bound': {
      if (range.bounds.length >= range.maxBounds) return null;
      const value = rangeSnap(state, action.value);
      if (!value) return null;
      const text = value.toJSON();
      if (range.bounds.some((bound) => bound.value === text)) return null;
      return withRange(state, {
        ...range,
        bounds: sortBounds([...range.bounds, { value: text, closed: false }]),
        direction: null,
      });
    }

    case 'move-bound': {
      const current = range.bounds[action.index];
      if (!current) return null;
      const value = rangeSnap(state, action.value);
      if (!value) return null;
      const text = value.toJSON();
      if (text === current.value) return null;
      if (range.bounds.some((bound, index) => index !== action.index && bound.value === text)) {
        return null;
      }
      const next = range.bounds.map((bound, index) =>
        index === action.index ? { value: text, closed: bound.closed } : bound,
      );
      return withRange(state, { ...range, bounds: sortBounds(next) });
    }

    case 'toggle-closed': {
      const current = range.bounds[action.index];
      if (!current) return null;
      const next = range.bounds.map((bound, index) =>
        index === action.index ? { value: bound.value, closed: !bound.closed } : bound,
      );
      return withRange(state, { ...range, bounds: next });
    }

    case 'set-direction': {
      if (range.bounds.length !== 1) return null;
      if (action.dir !== 'left' && action.dir !== 'right') return null;
      if (range.direction === action.dir) return null;
      return withRange(state, { ...range, direction: action.dir });
    }

    case 'remove-bound': {
      if (range.bounds.length === 0) return null;
      const index = action.index ?? range.bounds.length - 1;
      if (!range.bounds[index]) return null;
      return withRange(state, {
        ...range,
        bounds: range.bounds.filter((_, position) => position !== index),
        direction: null,
      });
    }

    case 'reset': {
      if (range.bounds.length === 0 && range.direction === null && !range.gateOpened) return null;
      return withRange(state, { ...range, bounds: [], direction: null });
    }
  }
}
