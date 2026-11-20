/**
 * E13 weight Observation. 물건의 무게(g)는 `springG`(건 물건 하나)에만 문자열로 있고,
 * 화면·DOM·aria에는 두지 않는다(용수철저울 눈금 숫자는 예외).
 * 오개념 코드는 아직 엔진이 기록하지 않는다(`misconceptions`는 빈 배열).
 */
import type { Observation } from '../../../core/engine-sdk';
import { gramsOf, heaviestOf, readWeight } from './settings';
import type { WeightState } from './types';

export function observeWeight(state: WeightState): Observation {
  const base = { mode: 'weight', moves: state.moves };
  if (state.error !== null) return { ...base, error: true, misconceptions: [] };
  const reading = readWeight(state);
  return {
    ...base,
    left: state.left,
    right: state.right,
    clips: state.clips,
    tilt: reading.tilt,
    balanced: reading.balanced,
    hung: state.hung,
    springG: state.hung === null ? null : gramsOf(state, state.hung).toString(),
    prediction: state.prediction,
    predictionLocked: state.predictionLocked,
    heaviest: heaviestOf(state),
    pairsCompared: [...state.pairs].sort(),
    misconceptions: [],
  };
}
