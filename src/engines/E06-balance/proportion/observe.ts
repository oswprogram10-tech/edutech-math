/**
 * proportion 관찰 결과. 엔진은 □의 정답을 모른다.
 * 기울기·수평은 학생이 넣은 값과 고른 항으로 계산한 두 접시의 넓이로만 정한다.
 */
import type { Observation } from '../../../core/engine-sdk';
import {
  MC_CROSS_WRONG,
  MC_RATIO_ADDITIVE,
  additiveTried,
  isProportionOf,
  pairingOf,
  readProportion,
  termValues,
} from './read';
import type { ProportionState } from './types';

export function observeProportion(state: ProportionState): Observation {
  const reading = readProportion(state);
  const pairing = pairingOf(state);
  const misconceptions: string[] = [];
  if (additiveTried(state)) misconceptions.push(MC_RATIO_ADDITIVE);
  if (pairing === 'other') misconceptions.push(MC_CROSS_WRONG);
  const values = termValues(state, state.tryValue);
  return {
    mode: 'proportion',
    terms: state.terms.map((term, index) =>
      term !== null ? term : index === state.boxIndex ? state.tryValue : null,
    ),
    boxIndex: state.boxIndex,
    tryValue: state.tryValue,
    tries: [...state.tries],
    leftArea: reading.left === null ? null : reading.left.toString(),
    rightArea: reading.right === null ? null : reading.right.toString(),
    balanced: reading.balanced,
    tilt: reading.tilt,
    boxValue: reading.balanced ? state.tryValue : null,
    cardIndex: state.cardIndex,
    isProportion: state.terms.length === 4 ? isProportionOf(values) : null,
    pair: state.pair === null ? null : [state.pair[0], state.pair[1]],
    pairing,
    misconceptions,
  };
}
