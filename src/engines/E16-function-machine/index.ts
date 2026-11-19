/** E16 대응 관계 엔진 정의. 모드 셋(`black-box`, `table`, `covary`)을 먼저 만든다. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { DiffArrowsOverlay } from './overlays/diff-arrows';
import { FailColsOverlay } from './overlays/fail-cols';
import { LongChainOverlay } from './overlays/long-chain';
import { SwapCheckOverlay } from './overlays/swap-check';
import { createInitialState, reduce } from './reduce';
import { functionStrings } from './strings.ko';
import type { FunctionAction, FunctionConfig, FunctionState } from './types';
import { FunctionView } from './View';

const definition: EngineDefinition<FunctionConfig, FunctionState, FunctionAction> = {
  id: 'E16',
  name: functionStrings.name,
  modes: ['black-box', 'table', 'covary'],
  createInitialState,
  reduce,
  View: FunctionView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'fail-cols': FailColsOverlay,
    'diff-arrows': DiffArrowsOverlay,
    'long-chain': LongChainOverlay,
    'swap-check': SwapCheckOverlay,
  },
};

export default definition;
