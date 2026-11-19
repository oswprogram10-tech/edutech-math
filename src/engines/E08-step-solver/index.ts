/** E08 단계 풀이 엔진 정의. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { emit, predicates } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { stepSolverStrings } from './strings.ko';
import type { AnyStepSolverConfig, AnyStepSolverState, StepSolverAction } from './types';
import { StepSolverView } from './View';
import { BarCheckOverlay } from './overlays/bar-check';
import { GroupBoxOverlay } from './overlays/group-box';
import { TwoWaysOverlay } from './overlays/two-ways';

const definition: EngineDefinition<AnyStepSolverConfig, AnyStepSolverState, StepSolverAction> = {
  id: 'E08',
  name: stepSolverStrings.name,
  modes: ['lines', 'fraction-steps', 'debug', 'order-tree'],
  layout: 'content',
  createInitialState,
  reduce,
  View: StepSolverView,
  observe,
  events: [
    'line-added',
    'line-checked',
    'misconception-found',
    'value-changed',
    'reduced',
    'wrong-tap',
  ],
  emit,
  predicates,
  overlays: {
    'bar-check': BarCheckOverlay,
    'group-box': GroupBoxOverlay,
    'two-ways': TwoWaysOverlay,
  },
};

export default definition;
