/**
 * E03 skip-count(뛰어 세기) 순수 reduce.
 *
 * 한 줄 = `{ step, hops }`이고 `hops`는 뛴 뒤 도착 값들이다.
 * 여러 줄(`steps`)이면 줄마다 독립적으로 뛴다. 겹치는 눈금은 강조하지 않는다(그게 답이다).
 * log-zoom의 `start`/`step` 뛰어 세기도 같은 hops 상태를 쓴다(카드 5번).
 */
import { Rational } from '../../core/math/rational';
import {
  clampRational,
  configRational,
  configRationals,
  makeBaseState,
  ONE,
  ZERO,
} from './state-helpers';
import { parseValue } from './ticks';
import { bumpCounts } from './types';
import type { NumberLineAction, NumberLineConfig, NumberLineState, SkipRowState } from './types';

export type SkipAction = Extract<
  NumberLineAction,
  { readonly type: 'choose-step' | 'hop' | 'unhop' | 'clear-hops' }
>;

function positiveSteps(values: readonly (number | string)[] | undefined): Rational[] {
  return configRationals(values).filter((step) => !step.isZero() && !step.isNegative());
}

function safeUnit(value: number | string | undefined): Rational {
  const unit = configRational(value);
  if (!unit || unit.isZero() || unit.isNegative()) return ONE;
  return unit;
}

export function createSkipState(config: NumberLineConfig): NumberLineState {
  const min = configRational(config.min) ?? ZERO;
  const unit = safeUnit(config.unit);
  let max = configRational(config.max) ?? Rational.of(30);
  if (max.compareTo(min) <= 0) max = min.add(unit);
  const start = clampRational(configRational(config.start) ?? min, min, max);

  const fixedSteps = positiveSteps(config.steps);
  const rows: SkipRowState[] =
    fixedSteps.length > 0
      ? fixedSteps.map((step) => ({ step: step.toJSON(), hops: [] }))
      : [{ step: positiveSteps([config.step ?? ''])[0]?.toJSON() ?? null, hops: [] }];

  return makeBaseState({
    mode: 'skip-count',
    min,
    max,
    unit,
    skip: { start: start.toJSON(), rows },
  });
}

function replaceRow(state: NumberLineState, row: number, next: SkipRowState): NumberLineState {
  if (!state.skip) return state;
  return {
    ...state,
    skip: {
      ...state.skip,
      rows: state.skip.rows.map((item, index) => (index === row ? next : item)),
    },
  };
}

/** 바뀐 것이 없으면 null. */
export function reduceSkipAction(
  state: NumberLineState,
  action: SkipAction,
): NumberLineState | null {
  const skip = state.skip;
  if (!skip) return null;
  const row = skip.rows[action.row];
  if (!row) return null;

  switch (action.type) {
    case 'choose-step': {
      const step = parseValue(action.step);
      if (!step || step.isZero() || step.isNegative()) return null;
      const text = step.toJSON();
      if (row.step === text && row.hops.length === 0) return null;
      return replaceRow(state, action.row, { step: text, hops: [] });
    }

    case 'hop': {
      if (row.step === null) return null;
      const step = parseValue(row.step);
      if (!step || step.isZero() || step.isNegative()) return null;
      const last = row.hops[row.hops.length - 1] ?? skip.start;
      const landing = parseValue(last) ?? parseValue(skip.start);
      if (!landing) return null;
      const next = landing.add(step);
      const max = parseValue(state.max);
      if (max && next.compareTo(max) > 0) return null;
      const text = next.toJSON();
      const updated = replaceRow(state, action.row, {
        step: row.step,
        hops: [...row.hops, text],
      });
      return {
        ...updated,
        cursor: text,
        lastValue: text,
        counts: bumpCounts(bumpCounts(state.counts, 'jumped'), 'valueChanged'),
      };
    }

    case 'unhop': {
      if (row.hops.length === 0) return null;
      return replaceRow(state, action.row, {
        step: row.step,
        hops: row.hops.slice(0, -1),
      });
    }

    case 'clear-hops': {
      if (row.hops.length === 0) return null;
      return replaceRow(state, action.row, { step: row.step, hops: [] });
    }
  }
}
