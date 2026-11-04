/**
 * E03 double(이중 수직선) 순수 reduce.
 *
 * 위·아래를 같은 연산으로 ÷/×해 새 쌍을 붙인다. anchor는 지울 수 없다.
 * 화면 구간은 `max(top.max, 모든 쌍의 top) × 1.1`로 자동으로 늘어난다(카드 6번).
 */
import { Rational } from '../../core/math/rational';
import { doubleTick, doubleViewMax, normalizeAnchors } from './double';
import { configRational, makeBaseState, ONE, ZERO } from './state-helpers';
import { parseValue } from './ticks';
import type { NumberLineAction, NumberLineConfig, NumberLineState } from './types';

export type DoubleAction = Extract<
  NumberLineAction,
  { readonly type: 'select-pair' | 'scale-pair' | 'remove-pair' }
>;

function maxOf(values: readonly Rational[]): Rational {
  let highest: Rational | null = null;
  for (const value of values) {
    if (highest === null || value.compareTo(highest) > 0) highest = value;
  }
  return highest ?? ONE;
}

export function createDoubleState(config: NumberLineConfig): NumberLineState {
  const anchors = normalizeAnchors(config.anchors);
  const topMax = configRational(config.top?.max) ?? maxOf(anchors.map((anchor) => anchor.top));
  const pairs = anchors.map((anchor) => ({
    top: anchor.top.toJSON(),
    bottom: anchor.bottom.toJSON(),
    from: null,
    op: null,
  }));
  const viewMax = doubleViewMax(
    topMax,
    anchors.map((anchor) => anchor.top),
  );
  const unit = doubleTick(topMax, anchors);

  return makeBaseState({
    mode: 'double',
    min: ZERO,
    max: viewMax,
    unit,
    double: { pairs, selected: 0, topMax: topMax.toJSON() },
  });
}

function pairTops(pairs: readonly { readonly top: string }[]): Rational[] {
  const tops: Rational[] = [];
  for (const pair of pairs) {
    const top = parseValue(pair.top);
    if (top) tops.push(top);
  }
  return tops;
}

/** 바뀐 것이 없으면 null. */
export function reduceDoubleAction(
  state: NumberLineState,
  action: DoubleAction,
): NumberLineState | null {
  const line = state.double;
  if (!line) return null;

  switch (action.type) {
    case 'select-pair': {
      if (action.index < 0 || action.index >= line.pairs.length) return null;
      if (line.selected === action.index) return null;
      return { ...state, double: { ...line, selected: action.index } };
    }

    case 'scale-pair': {
      const factor = action.factor;
      if (!Number.isInteger(factor) || factor <= 0 || factor > 1000) return null;
      const base = line.pairs[line.selected];
      if (!base) return null;
      const top = parseValue(base.top);
      const bottom = parseValue(base.bottom);
      if (!top || !bottom) return null;
      const ratio = Rational.of(factor);
      const nextTop = action.kind === 'divide' ? top.div(ratio) : top.mul(ratio);
      const nextBottom = action.kind === 'divide' ? bottom.div(ratio) : bottom.mul(ratio);
      const pairs = [
        ...line.pairs,
        {
          top: nextTop.toJSON(),
          bottom: nextBottom.toJSON(),
          from: line.selected,
          op: { kind: action.kind, factor },
        },
      ];
      const topMax = parseValue(line.topMax) ?? nextTop;
      const viewMax = doubleViewMax(topMax, pairTops(pairs));
      return {
        ...state,
        max: viewMax.toJSON(),
        viewMax: viewMax.toJSON(),
        double: { ...line, pairs, selected: pairs.length - 1 },
      };
    }

    case 'remove-pair': {
      let last = -1;
      for (let index = line.pairs.length - 1; index >= 0; index -= 1) {
        const candidate = line.pairs[index];
        if (candidate && candidate.from !== null) {
          last = index;
          break;
        }
      }
      if (last < 0) return null;
      const pairs = line.pairs.filter((_, index) => index !== last);
      const topMax = parseValue(line.topMax) ?? ONE;
      const viewMax = doubleViewMax(topMax, pairTops(pairs));
      const selected = Math.min(line.selected, pairs.length - 1);
      return {
        ...state,
        max: viewMax.toJSON(),
        viewMax: viewMax.toJSON(),
        double: { ...line, pairs, selected: Math.max(0, selected) },
      };
    }
  }
}
