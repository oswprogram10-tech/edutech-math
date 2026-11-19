/** E15 규칙·패턴 엔진 정의. 모드 둘(`sequence`, `hundred-chart`)을 먼저 만든다. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { CoreBoxesOverlay } from './overlays/core-boxes';
import { MappingCardOverlay } from './overlays/mapping-card';
import { ReplayBreakOverlay } from './overlays/replay-break';
import { TenStepOverlay } from './overlays/ten-step';
import { createInitialState, reduce } from './reduce';
import { patternStrings } from './strings.ko';
import type { PatternAction, PatternConfig, PatternState } from './types';
import { PatternView } from './View';

const definition: EngineDefinition<PatternConfig, PatternState, PatternAction> = {
  id: 'E15',
  name: patternStrings.name,
  modes: ['sequence', 'hundred-chart'],
  createInitialState,
  reduce,
  View: PatternView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'core-boxes': CoreBoxesOverlay,
    'replay-break': ReplayBreakOverlay,
    'mapping-card': MappingCardOverlay,
    'ten-step': TenStepOverlay,
  },
};

export default definition;
