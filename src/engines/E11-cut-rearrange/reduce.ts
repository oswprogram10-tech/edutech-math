/** E11 공통 reducer. 모드별 폴더의 순수 함수로 넘긴다. */
import { createAngleGatherState, reduceAngleGather } from './angle-gather/reduce';
import type { AngleGatherAction, AngleGatherState } from './angle-gather/types';
import { createPiecesState, reducePieces } from './pieces/reduce';
import type { PiecesAction, PiecesState } from './pieces/types';
import type { CutAction, CutConfig, CutState } from './types';

function isAngleState(state: CutState): state is AngleGatherState {
  return state.mode === 'angle-gather';
}

export function createInitialState(config: CutConfig): CutState {
  const record = (config ?? {}) as { readonly mode?: unknown };
  if (record.mode === 'angle-gather') return createAngleGatherState(config);
  if (record.mode === 'formula-derive') return createPiecesState('formula-derive', config);
  return createPiecesState('slice', config);
}

export function reduce(state: CutState, action: CutAction): CutState {
  switch (action.type) {
    case 'cut':
    case 'move-piece':
    case 'rotate-piece':
    case 'hinge':
    case 'duplicate': {
      if (isAngleState(state)) return state;
      return reducePieces(state, action);
    }
    case 'move-vertex':
    case 'cut-corners':
    case 'gather-corner':
    case 'ungather-corner':
    case 'turn-corner':
    case 'new-trial': {
      if (!isAngleState(state)) return state;
      return reduceAngleGather(state, action);
    }
    default:
      return state;
  }
}

export type { AngleGatherAction, AngleGatherState, PiecesAction, PiecesState };
