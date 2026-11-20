/**
 * E19 Observation(순수 함수). 평균·받침점·예측은 core Rational로 계산해 기약분수 문자열로 내보낸다.
 * 정답(목표 값)은 엔진이 모른다. 평균은 자료에서 계산한 사실이라 Observation에만 둔다.
 */
import type { Observation } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import { probabilitiesOf } from './device';
import type { ChanceConfig, ChanceState, OutlierState, SeesawState } from './types';
import { OUTCOMES } from './types';

/** 평균 = 합 ÷ 개수. */
export function meanOf(values: readonly number[]): Rational {
  const sum = values.reduce((a, b) => a + b, 0);
  return Rational.of(sum, Math.max(1, values.length));
}

/** 받침점 f에서 돌림힘 합 Σ(x − f). 양수면 오른쪽이 무겁다. */
export function torqueOf(values: readonly number[], fulcrum: Rational): Rational {
  return values.reduce((acc, x) => acc.add(Rational.of(x).sub(fulcrum)), Rational.of(0));
}

export type Tilt = 'left' | 'right' | 'level';

export function tiltOf(values: readonly number[], fulcrum: Rational): Tilt {
  const torque = torqueOf(values, fulcrum);
  if (torque.isZero()) return 'level';
  return torque.isNegative() ? 'left' : 'right';
}

export function seesawFulcrum(state: SeesawState): Rational {
  return Rational.parse(state.fulcrum);
}

export function outlierMeans(state: OutlierState): { mean: Rational; initial: Rational } {
  return { mean: meanOf(state.values), initial: meanOf(state.data) };
}

export function observe(state: ChanceState, config?: ChanceConfig): Observation {
  void config;
  if (state.error !== null) {
    return { mode: state.mode, error: state.error, misconceptions: [] };
  }
  if (state.mode === 'leveling') {
    const first = state.heights[0] ?? 0;
    const leveled = state.heights.every((h) => h === first);
    return {
      mode: 'leveling',
      heights: [...state.heights],
      moves: state.moves,
      leveled,
      level: leveled ? Rational.of(first).toString() : null,
      mean: meanOf(state.data).toString(),
      misconceptions: [],
    };
  }
  if (state.mode === 'seesaw') {
    const fulcrum = seesawFulcrum(state);
    const tilt = tiltOf(state.data, fulcrum);
    return {
      mode: 'seesaw',
      fulcrum: fulcrum.toString(),
      balanced: tilt === 'level',
      tilt,
      mean: meanOf(state.data).toString(),
      moves: state.moves,
      misconceptions: [],
    };
  }
  if (state.mode === 'words') {
    const placements = { ...state.placements };
    return {
      mode: 'words',
      placements,
      allPlaced: state.cards.every((c) => state.placements[c.id] !== null),
      misconceptions: [],
    };
  }
  if (state.mode === 'spinner') {
    return {
      mode: 'spinner',
      device: JSON.parse(JSON.stringify(state.device)),
      probabilities: probabilitiesOf(state.device),
      trials: state.trials,
      counts: { ...state.counts },
      last: [...state.last],
      edits: state.edits,
      misconceptions: [],
    };
  }
  if (state.mode === 'simulate') {
    return {
      mode: 'simulate',
      device: JSON.parse(JSON.stringify(state.device)),
      probabilities: probabilitiesOf(state.device),
      batches: [...state.batches],
      results: state.results.map((r) => ({
        batch: r.batch,
        counts: { ...r.counts },
        rel: Object.fromEntries(
          OUTCOMES.map((c) => [c, Rational.of(r.counts[c], r.batch).toString()]),
        ),
      })),
      allBatchesRun: state.batches.every((b) => state.results.some((r) => r.batch === b)),
      runs: state.runs,
      edits: state.edits,
      misconceptions: [],
    };
  }
  const { mean, initial } = outlierMeans(state);
  return {
    mode: 'outlier',
    values: [...state.values],
    mean: mean.toString(),
    initialMean: initial.toString(),
    meanShift: mean.sub(initial).toString(),
    dragged: state.dragged,
    prediction: state.prediction,
    predictionLocked: state.prediction !== null,
    misconceptions: [],
  };
}
