/** E10 순수 reducer. 모드별 분기만 한다. */
import type { TransformAction, TransformConfig, TransformMode, TransformState } from './types';
import { createCongruenceState, reduceCongruence } from './modes/congruence';
import { createLineSymmetryState, reduceLineSymmetry } from './modes/line-symmetry';
import { createPointSymmetryState, reducePointSymmetry } from './modes/point-symmetry';
import { createPredictState, reducePredict } from './modes/predict';
import { createSlideFlipTurnState, reduceSlideFlipTurn } from './modes/slide-flip-turn';
import { createTessellationState, reduceTessellation } from './modes/tessellation';

const MODES: readonly TransformMode[] = [
  'slide-flip-turn',
  'predict',
  'tessellation',
  'congruence',
  'line-symmetry',
  'point-symmetry',
];

export function inferMode(config: TransformConfig): TransformMode {
  const explicit = config.mode;
  if (typeof explicit === 'string' && (MODES as readonly string[]).includes(explicit)) {
    return explicit as TransformMode;
  }
  const record = config as Readonly<Record<string, unknown>>;
  if (
    record['baseTiles'] !== undefined ||
    record['customize'] !== undefined ||
    record['gapCheck'] !== undefined
  ) {
    return 'tessellation';
  }
  if (
    record['fixed'] !== undefined ||
    record['moving'] !== undefined ||
    record['fixedAt'] !== undefined ||
    record['fixedOrientation'] !== undefined ||
    record['pairSides'] !== undefined ||
    record['showCorrespondence'] !== undefined
  ) {
    return 'congruence';
  }
  if (record['allowDrawAxis'] !== undefined || record['foldPreview'] !== undefined) {
    return 'line-symmetry';
  }
  if (
    record['pinAnywhere'] !== undefined ||
    record['showArcs'] !== undefined ||
    record['center'] !== undefined
  ) {
    return 'point-symmetry';
  }
  if (record['task'] === 'find-axis' || record['task'] === 'decalcomania') return 'line-symmetry';
  if (record['task'] === 'pin' || record['task'] === 'complete') return 'point-symmetry';
  if (record['operation'] !== undefined || record['showOperation'] !== undefined) return 'predict';
  return 'slide-flip-turn';
}

export function createInitialState(config: TransformConfig): TransformState {
  switch (inferMode(config)) {
    case 'predict':
      return createPredictState(config as Parameters<typeof createPredictState>[0]);
    case 'tessellation':
      return createTessellationState(config as Parameters<typeof createTessellationState>[0]);
    case 'congruence':
      return createCongruenceState(config as Parameters<typeof createCongruenceState>[0]);
    case 'line-symmetry':
      return createLineSymmetryState(config as Parameters<typeof createLineSymmetryState>[0]);
    case 'point-symmetry':
      return createPointSymmetryState(config as Parameters<typeof createPointSymmetryState>[0]);
    default:
      return createSlideFlipTurnState(config as Parameters<typeof createSlideFlipTurnState>[0]);
  }
}

export function reduce(state: TransformState, action: TransformAction): TransformState {
  switch (state.mode) {
    case 'slide-flip-turn':
      return reduceSlideFlipTurn(state, action);
    case 'predict':
      return reducePredict(state, action);
    case 'tessellation':
      return reduceTessellation(state, action);
    case 'congruence':
      return reduceCongruence(state, action);
    case 'line-symmetry':
      return reduceLineSymmetry(state, action);
    case 'point-symmetry':
      return reducePointSymmetry(state, action);
  }
}
