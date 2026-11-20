/**
 * E13 estimate Observation. 물건 길이와 끝 눈금은 Observation에만 두고 화면·DOM에는 두지 않는다.
 */
import type { Observation } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import { endTick, nearestCm, objectLength, offsetOf } from './settings';
import type { EstimateState } from './types';

export function observeEstimate(state: EstimateState): Observation {
  const base = { mode: 'estimate', moves: state.moves };
  if (state.error !== null) return { ...base, error: true, misconceptions: [] };
  const offset = offsetOf(state);
  return {
    ...base,
    lengthCm: objectLength(state).toString(),
    rulerOffset: offset.toString(),
    zeroAligned: offset.isZero(),
    endTick: endTick(state).toString(),
    nearestCm: nearestCm(state),
    estimate: state.estimate,
    estimateLocked: state.estimateLocked,
    rulerMoved: state.rulerMoves >= 1,
    // mm 확대가 있는 설정에서만 붙인다(없으면 기존 Observation 그대로).
    ...(state.zoomMm
      ? { zoomed: state.zoomed, lengthMm: objectLength(state).mul(Rational.of(10)).toString() }
      : {}),
    misconceptions: [],
  };
}
