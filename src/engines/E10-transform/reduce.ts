/** E10 순수 reducer. 모드별 분기만 한다. */
import type { TransformAction, TransformConfig, TransformMode, TransformState } from './types';
import { createPredictState, reducePredict } from './modes/predict';
import { createSlideFlipTurnState, reduceSlideFlipTurn } from './modes/slide-flip-turn';

export function inferMode(config: TransformConfig): TransformMode {
  if (config.mode === 'predict' || config.mode === 'slide-flip-turn') return config.mode;
  const candidate = config as { readonly operation?: unknown; readonly showOperation?: unknown };
  if (candidate.operation !== undefined || candidate.showOperation !== undefined) return 'predict';
  return 'slide-flip-turn';
}

export function createInitialState(config: TransformConfig): TransformState {
  if (inferMode(config) === 'predict') {
    return createPredictState(config as Parameters<typeof createPredictState>[0]);
  }
  return createSlideFlipTurnState(config as Parameters<typeof createSlideFlipTurnState>[0]);
}

export function reduce(state: TransformState, action: TransformAction): TransformState {
  if (state.mode === 'slide-flip-turn') return reduceSlideFlipTurn(state, action);
  return reducePredict(state, action);
}
