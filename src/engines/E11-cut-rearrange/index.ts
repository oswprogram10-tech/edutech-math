/** E11 자르고 붙이기 엔진 정의. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { cutStrings } from './strings.ko';
import type { CutAction, CutConfig, CutState } from './types';
import { CutView } from './View';
import { HingeReplayOverlay } from './overlays/hinge-replay';
import { RadiusHeightOverlay } from './overlays/radius-height';
import { RimVsCoverOverlay } from './overlays/rim-vs-cover';
import { SlantRectangleOverlay } from './overlays/slant-rectangle';
import { TopArcsOverlay } from './overlays/top-arcs';
import { TrialCompareOverlay } from './overlays/trial-compare';
import { UnitCompareOverlay } from './overlays/unit-compare';
import { UprightTurnOverlay } from './overlays/upright-turn';
import { WorkOutlineOverlay } from './overlays/work-outline';

const definition: EngineDefinition<CutConfig, CutState, CutAction> = {
  id: 'E11',
  name: cutStrings.name,
  modes: ['slice', 'formula-derive', 'angle-gather', 'tangram', 'circle-sectors'],
  layout: 'fit',
  createInitialState,
  reduce,
  View: CutView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'work-outline': WorkOutlineOverlay,
    'slant-rectangle': SlantRectangleOverlay,
    'hinge-replay': HingeReplayOverlay,
    'unit-compare': UnitCompareOverlay,
    'trial-compare': TrialCompareOverlay,
    'upright-turn': UprightTurnOverlay,
    'top-arcs': TopArcsOverlay,
    'rim-vs-cover': RimVsCoverOverlay,
    'radius-height': RadiusHeightOverlay,
  },
};

export default definition;
