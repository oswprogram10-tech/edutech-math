/** E11 공통 reducer. 모드별 폴더의 순수 함수로 넘긴다. */
import { createAngleGatherState, reduceAngleGather } from './angle-gather/reduce';
import type { AngleGatherAction, AngleGatherState } from './angle-gather/types';
import { createCircleSectorsState, reduceCircleSectors } from './circle-sectors/reduce';
import type {
  CircleSectorsAction,
  CircleSectorsConfig,
  CircleSectorsState,
} from './circle-sectors/types';
import { createPiecesState, reducePieces } from './pieces/reduce';
import type { PiecesAction, PiecesState } from './pieces/types';
import { createTangramState, reduceTangram } from './tangram/reduce';
import type { TangramAction, TangramConfig, TangramState } from './tangram/types';
import type { CutAction, CutConfig, CutState } from './types';

function isAngleState(state: CutState): state is AngleGatherState {
  return state.mode === 'angle-gather';
}

function isPiecesState(state: CutState): state is PiecesState {
  return state.mode === 'slice' || state.mode === 'formula-derive';
}

function isTangramState(state: CutState): state is TangramState {
  return state.mode === 'tangram';
}

function isCircleState(state: CutState): state is CircleSectorsState {
  return state.mode === 'circle-sectors';
}

export function createInitialState(config: CutConfig): CutState {
  const record = (config ?? {}) as { readonly mode?: unknown };
  if (record.mode === 'angle-gather') return createAngleGatherState(config);
  if (record.mode === 'tangram') return createTangramState(config as TangramConfig);
  if (record.mode === 'circle-sectors')
    return createCircleSectorsState(config as CircleSectorsConfig);
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
      if (!isPiecesState(state)) return state;
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
    case 'place-piece':
    case 'turn-piece':
    case 'flip-piece':
    case 'add-piece':
    case 'remove-piece':
    case 'toggle-select': {
      if (!isTangramState(state)) return state;
      return reduceTangram(state, action);
    }
    case 'set-level':
    case 'place-sector':
    case 'unplace-sector':
    case 'auto-arrange': {
      if (!isCircleState(state)) return state;
      return reduceCircleSectors(state, action);
    }
    default:
      return state;
  }
}

export type {
  AngleGatherAction,
  AngleGatherState,
  CircleSectorsAction,
  CircleSectorsState,
  PiecesAction,
  PiecesState,
  TangramAction,
  TangramState,
};
