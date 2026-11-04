/**
 * T049 `divide-measure`: 나누는 수 막대(자)로 나뉨수를 몇 번 재는지.
 *
 * - 온전한 자를 놓을 때마다 `rulersLaid`가 1씩 늘어난다.
 * - 남은 길이가 자보다 짧으면 **부분 자**를 한 번만 놓고 더 놓지 않는다.
 *   `partial`은 그 부분이 자의 몇인지(`Rational` 문자열)다. 자의 값 글자는 쓰지 않는다.
 * - 몫·역수 곱셈 모핑은 그리지 않는다(T049 결정 4).
 */
import { Rational } from '../../core/math';
import { parseAnyRational } from './fractions';
import { EMPTY_COUNTS, bumpCounts } from './types';
import type { DivideMeasureState, FractionModelAction, FractionModelConfig } from './types';

export function createDivideMeasure(config: FractionModelConfig): DivideMeasureState {
  const dividend = parseAnyRational(config.dividend, '3/4');
  const rawDivisor = parseAnyRational(config.divisor, '1/4');
  const divisor =
    rawDivisor.isZero() || rawDivisor.isNegative() ? Rational.parse('1/4') : rawDivisor;
  return {
    mode: 'divide-measure',
    dividend: dividend.toString(),
    divisor: divisor.toString(),
    rulersLaid: 0,
    partial: null,
    showRemainderFractionOfDivisor: config.showRemainderFractionOfDivisor ?? false,
    counters: EMPTY_COUNTS,
  };
}

export interface MeasureSummary {
  readonly dividend: Rational;
  readonly divisor: Rational;
  /** 나뉨수 ÷ 나누는 수. 관찰에만 쓰고 화면에는 쓰지 않는다. */
  readonly quotient: Rational;
  readonly rulersLaid: number;
  readonly partial: Rational | null;
  /** 온전한 자 + 부분 자. */
  readonly measured: Rational;
  /** 나뉨수를 정확히 다 쟀는지. */
  readonly measureComplete: boolean;
  /** 아직 재지 않은 길이(나뉨수 기준). */
  readonly remaining: Rational;
}

export function measureSummary(state: DivideMeasureState): MeasureSummary {
  const dividend = Rational.parse(state.dividend);
  const divisor = Rational.parse(state.divisor);
  const quotient = divisor.isZero() ? Rational.of(0) : dividend.div(divisor);
  const partial = state.partial === null ? null : Rational.parse(state.partial);
  const measured =
    partial === null ? Rational.of(state.rulersLaid) : Rational.of(state.rulersLaid).add(partial);
  const measuredLength = divisor.mul(measured);
  const remaining = dividend.sub(measuredLength);
  return {
    dividend,
    divisor,
    quotient,
    rulersLaid: state.rulersLaid,
    partial,
    measured,
    measureComplete: remaining.isZero() && measured.compareTo(Rational.of(0)) > 0,
    remaining: remaining.isNegative() ? Rational.of(0) : remaining,
  };
}

export function reduceDivideMeasure(
  state: DivideMeasureState,
  action: FractionModelAction,
): DivideMeasureState {
  const summary = measureSummary(state);
  switch (action.type) {
    case 'lay-ruler': {
      // 부분 자를 놓았으면 더 놓지 않는다.
      if (state.partial !== null) return state;
      if (summary.remaining.isZero()) return state;
      const remainingUnits = summary.remaining.div(summary.divisor);
      if (remainingUnits.compareTo(Rational.of(1)) >= 0) {
        return {
          ...state,
          rulersLaid: state.rulersLaid + 1,
          counters: bumpCounts(state.counters, 'valueChanged'),
        };
      }
      return {
        ...state,
        partial: remainingUnits.toString(),
        counters: bumpCounts(state.counters, 'valueChanged'),
      };
    }
    case 'lift-ruler': {
      if (state.partial !== null) {
        return {
          ...state,
          partial: null,
          counters: bumpCounts(state.counters, 'valueChanged'),
        };
      }
      if (state.rulersLaid <= 0) return state;
      return {
        ...state,
        rulersLaid: state.rulersLaid - 1,
        counters: bumpCounts(state.counters, 'valueChanged'),
      };
    }
    case 'clear-rulers': {
      if (state.rulersLaid === 0 && state.partial === null) return state;
      return {
        ...state,
        rulersLaid: 0,
        partial: null,
        counters: bumpCounts(state.counters, 'valueChanged'),
      };
    }
    default:
      return state;
  }
}
