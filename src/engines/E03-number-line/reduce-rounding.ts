/**
 * E03 rounding(어림) 순수 reduce.
 *
 * 원래 값은 점으로, 어림한 자리는 삼각 깃발로 표시한다. 결과 값을 따로 글자로 쓰지 않는다
 * (눈금 라벨로만 읽는다 — 카드 4·10번).
 */
import { Rational } from '../../core/math/rational';
import { roundingBounds, roundValue, snapToBigTick } from './rounding';
import {
  clampRational,
  configRational,
  configRationals,
  makeBaseState,
  ZERO,
} from './state-helpers';
import { numberLineStrings } from './strings.ko';
import { parseValue } from './ticks';
import { bumpCounts } from './types';
import type {
  NumberLineAction,
  NumberLineConfig,
  NumberLineState,
  RoundingItemState,
  RoundingMethod,
} from './types';

export type RoundingAction = Extract<
  NumberLineAction,
  { readonly type: 'round' | 'move-marker' | 'select-item' | 'clear-marker' }
>;

const DEFAULT_PLACE = Rational.of(10);
const MIN_GROUP = Rational.of(2);
const MAX_GROUP = Rational.of(20);
const METHODS: readonly RoundingMethod[] = ['up', 'down', 'half-up'];

export function roundingPlaceOf(state: NumberLineState): Rational | null {
  if (!state.rounding) return null;
  const unit = parseValue(state.unit);
  if (!unit || unit.isZero() || unit.isNegative()) return null;
  return unit.mul(Rational.of(10));
}

export function createRoundingState(config: NumberLineConfig): NumberLineState {
  const placeRaw = configRational(config.place);
  const place = placeRaw && !placeRaw.isZero() && !placeRaw.isNegative() ? placeRaw : DEFAULT_PLACE;

  const listed = configRationals(config.values);
  let values = listed.slice(0, 3);
  if (values.length === 0) {
    const single = configRational(config.value);
    if (single) values = [single];
  }
  if (values.length === 0) values = [ZERO];
  const scenario = config.scenario;
  // 상황 장면은 값이 하나일 때만 쓴다(T219). 여러 값이면 설정 오류.
  if (scenario !== undefined && listed.length > 1) {
    throw new Error(numberLineStrings.rounding.scenarioMultiError);
  }
  if (scenario === 'bus-seats' || scenario === 'candy-bags') {
    const single = values[0] ?? ZERO;
    if (
      !single.isInteger() ||
      single.isNegative() ||
      !place.isInteger() ||
      place.compareTo(MIN_GROUP) < 0 ||
      place.compareTo(MAX_GROUP) > 0
    ) {
      throw new Error(numberLineStrings.rounding.scenarioValueError);
    }
  }

  const bounds = roundingBounds(values, place);
  const min = bounds.min;
  const max = bounds.max;

  const items: RoundingItemState[] = values.map((value) => ({
    value: value.toJSON(),
    marker: null,
    method: null,
  }));

  return makeBaseState({
    mode: 'rounding',
    min,
    max,
    unit: place.div(Rational.of(10)),
    rounding: {
      items,
      selected: 0,
      ...(scenario === 'bus-seats' || scenario === 'candy-bags' || scenario === 'height'
        ? { scenario, showConsequence: config.showConsequence !== false }
        : {}),
    },
  });
}

function withItem(
  state: NumberLineState,
  item: number,
  next: RoundingItemState,
  selected = item,
): NumberLineState {
  if (!state.rounding) return state;
  return {
    ...state,
    rounding: {
      ...state.rounding,
      items: state.rounding.items.map((current, index) => (index === item ? next : current)),
      selected,
    },
  };
}

/** 바뀐 것이 없으면 null. */
export function reduceRoundingAction(
  state: NumberLineState,
  action: RoundingAction,
): NumberLineState | null {
  const rounding = state.rounding;
  const place = roundingPlaceOf(state);
  if (!rounding || !place) return null;
  const item = rounding.items[action.item];
  if (!item) return null;

  switch (action.type) {
    case 'round': {
      if (!METHODS.includes(action.method)) return null;
      const value = parseValue(item.value);
      if (!value) return null;
      const marker = roundValue(value, place, action.method).toJSON();
      if (
        item.marker === marker &&
        item.method === action.method &&
        rounding.selected === action.item
      ) {
        return null;
      }
      const next = withItem(
        state,
        action.item,
        { value: item.value, marker, method: action.method },
        action.item,
      );
      return {
        ...next,
        lastValue: marker,
        counts: bumpCounts(state.counts, 'valueChanged'),
      };
    }

    case 'move-marker': {
      const parsed = parseValue(action.value);
      if (!parsed) return null;
      const min = parseValue(state.min) ?? parsed;
      const max = parseValue(state.max) ?? parsed;
      const marker = clampRational(snapToBigTick(parsed, place), min, max).toJSON();
      if (item.marker === marker && item.method === null && rounding.selected === action.item) {
        return null;
      }
      const next = withItem(
        state,
        action.item,
        { value: item.value, marker, method: null },
        action.item,
      );
      return {
        ...next,
        lastValue: marker,
        counts: bumpCounts(state.counts, 'valueChanged'),
      };
    }

    case 'select-item': {
      if (action.item < 0 || action.item >= rounding.items.length) return null;
      if (rounding.selected === action.item) return null;
      return { ...state, rounding: { ...rounding, selected: action.item } };
    }

    case 'clear-marker': {
      if (item.marker === null && item.method === null) return null;
      return withItem(state, action.item, { value: item.value, marker: null, method: null });
    }
  }
}
