/** E10 관찰 결과. 판정·힌트는 이 값만 본다. */
import type { Observation } from '../../core/engine-sdk';
import { observePredict } from './modes/predict';
import { observeSlideFlipTurn } from './modes/slide-flip-turn';
import type { TransformState } from './types';

export function observe(state: TransformState): Observation {
  if (state.mode === 'slide-flip-turn') return observeSlideFlipTurn(state);
  return observePredict(state);
}
