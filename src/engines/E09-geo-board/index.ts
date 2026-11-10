/** E09 기하판 엔진 정의. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { geoBoardStrings } from './strings.ko';
import type { GeoAction, GeoConfig, GeoState } from './types';
import { GeoView } from './View';
import { ActiveScaleOverlay } from './overlays/active-scale';
import { AngleKindsOverlay } from './overlays/angle-kinds';
import { ChordGapOverlay } from './overlays/chord-gap';
import { CompassWidthOverlay } from './overlays/compass-width';
import { EqualArmsOverlay } from './overlays/equal-arms';
import { LaserExtentOverlay } from './overlays/laser-extent';
import { PropertyChecklistOverlay } from './overlays/property-checklist';
import { RadiusPairOverlay } from './overlays/radius-pair';
import { ShakeTrailOverlay } from './overlays/shake-trail';
import { SquareTurnOverlay } from './overlays/square-turn';
import { StraightRunOverlay } from './overlays/straight-run';
import { UprightGhostOverlay } from './overlays/upright-ghost';
import { ZeroGapOverlay } from './overlays/zero-gap';

const definition: EngineDefinition<GeoConfig, GeoState, GeoAction> = {
  id: 'E09',
  name: geoBoardStrings.name,
  modes: ['geoboard', 'construct', 'classify', 'drag-test', 'circle', 'angle'],
  createInitialState,
  reduce,
  View: GeoView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'straight-run': StraightRunOverlay,
    'upright-ghost': UprightGhostOverlay,
    'laser-extent': LaserExtentOverlay,
    'square-turn': SquareTurnOverlay,
    'property-checklist': PropertyChecklistOverlay,
    'angle-kinds': AngleKindsOverlay,
    'shake-trail': ShakeTrailOverlay,
    'radius-pair': RadiusPairOverlay,
    'chord-gap': ChordGapOverlay,
    'compass-width': CompassWidthOverlay,
    'active-scale': ActiveScaleOverlay,
    'zero-gap': ZeroGapOverlay,
    'equal-arms': EqualArmsOverlay,
  },
};

export default definition;
