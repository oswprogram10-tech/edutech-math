/** E10 도형 이동 엔진 정의. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { transformStrings } from './strings.ko';
import type { TransformAction, TransformConfig, TransformState } from './types';
import { TransformView } from './View';
import { ClockHandOverlay } from './overlays/clock-hand';
import { PinArcsOverlay } from './overlays/pin-arcs';
import { PointTrackOverlay } from './overlays/point-track';

const definition: EngineDefinition<TransformConfig, TransformState, TransformAction> = {
  id: 'E10',
  name: transformStrings.name,
  modes: ['slide-flip-turn', 'predict'],
  createInitialState,
  reduce,
  View: TransformView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'pin-arcs': PinArcsOverlay,
    'point-track': PointTrackOverlay,
    'clock-hand': ClockHandOverlay,
  },
};

export default definition;
