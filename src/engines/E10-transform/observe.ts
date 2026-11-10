/** E10 관찰 결과. 판정·힌트는 이 값만 본다. */
import type { Observation } from '../../core/engine-sdk';
import { observeCongruence } from './modes/congruence';
import { observeLineSymmetry } from './modes/line-symmetry';
import { observePointSymmetry } from './modes/point-symmetry';
import { observePredict } from './modes/predict';
import { observeSlideFlipTurn } from './modes/slide-flip-turn';
import { observeTessellation } from './modes/tessellation';
import type { TransformState } from './types';

export function observe(state: TransformState): Observation {
  switch (state.mode) {
    case 'slide-flip-turn':
      return observeSlideFlipTurn(state);
    case 'predict':
      return observePredict(state);
    case 'tessellation':
      return observeTessellation(state);
    case 'congruence':
      return observeCongruence(state);
    case 'line-symmetry':
      return observeLineSymmetry(state);
    case 'point-symmetry':
      return observePointSymmetry(state);
  }
}
