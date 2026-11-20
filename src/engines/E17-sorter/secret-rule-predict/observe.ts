/** E17 predict의 관찰 결과. 비밀 기준·새 카드의 정답 상자는 넣지 않는다. */
import type { Observation } from '../../../core/engine-sdk';
import type { PredictState } from './types';

export function predictObservation(state: PredictState): Observation {
  return {
    mode: 'secret-rule',
    variant: 'predict',
    streak: state.streak,
    predictions: state.predictions,
    correctPredictions: state.correctPredictions,
    unlocked: state.unlocked,
    guesses: state.guesses,
    guessedRight: state.guessedRight,
    misconceptions: [],
  };
}
