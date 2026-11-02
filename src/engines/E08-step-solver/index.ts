/** E08 단계 풀이 엔진 정의. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { emit, predicates } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { stepSolverStrings } from './strings.ko';
import type { StepSolverAction, StepSolverConfig, StepSolverState } from './types';
import { StepSolverView } from './View';
import { BarCheckOverlay } from './overlays/bar-check';

const definition: EngineDefinition<StepSolverConfig, StepSolverState, StepSolverAction> = {
  id: 'E08',
  name: stepSolverStrings.name,
  modes: ['lines', 'fraction-steps', 'debug'],
  createInitialState,
  reduce,
  View: StepSolverView,
  observe,
  events: ['line-added', 'line-checked', 'misconception-found', 'value-changed'],
  emit,
  predicates,
  overlays: {
    'bar-check': BarCheckOverlay,
  },
};

export default definition;
