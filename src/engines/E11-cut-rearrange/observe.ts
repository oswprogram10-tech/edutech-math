/** E11 공통 관찰. 모드별 관찰 결과를 고른다. */
import type { Observation } from '../../core/engine-sdk';
import { observeAngleGather } from './angle-gather/observe';
import { observePieces } from './pieces/observe';
import type { CutState } from './types';

export function observe(state: CutState): Observation {
  if (state.mode === 'angle-gather') return observeAngleGather(state);
  return observePieces(state);
}
