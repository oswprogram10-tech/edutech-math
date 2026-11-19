/** E15 규칙·패턴 엔진 정의. 모드 다섯(`sequence`, `hundred-chart`, `calc-pattern`, `growth`, `gears`). */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { CellDiffOverlay } from './overlays/cell-diff';
import { ColumnLinkOverlay } from './overlays/column-link';
import { CoreBoxesOverlay } from './overlays/core-boxes';
import { GrowthSplitOverlay } from './overlays/growth-split';
import { MeetTrailOverlay } from './overlays/meet-trail';
import { MappingCardOverlay } from './overlays/mapping-card';
import { ReplayBreakOverlay } from './overlays/replay-break';
import { StepTableOverlay } from './overlays/step-table';
import { TenStepOverlay } from './overlays/ten-step';
import { createInitialState, reduce } from './reduce';
import { patternStrings } from './strings.ko';
import type { PatternAction, PatternConfig, PatternState } from './types';
import { PatternView } from './View';

const definition: EngineDefinition<PatternConfig, PatternState, PatternAction> = {
  id: 'E15',
  name: patternStrings.name,
  modes: ['sequence', 'hundred-chart', 'calc-pattern', 'growth', 'gears'],
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
    'step-table': StepTableOverlay,
    'column-link': ColumnLinkOverlay,
    'growth-split': GrowthSplitOverlay,
    'cell-diff': CellDiffOverlay,
    'meet-trail': MeetTrailOverlay,
  },
};

export default definition;
