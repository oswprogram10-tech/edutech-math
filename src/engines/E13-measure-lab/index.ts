/** E13 측정 실험실 엔진 정의. 모드 둘(`compare-direct`, `length`). */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EndpointLinesOverlay } from './compare/overlays/endpoint-lines';
import { HalfStraightenOverlay } from './compare/overlays/half-straighten';
import { SameTankOverlay } from './compare/overlays/same-tank';
import { GapMarksOverlay } from './length/overlays/gap-marks';
import { SpanCompareOverlay } from './length/overlays/span-compare';
import {
  E13_EVENT_NAMES,
  E13_MODES,
  E13_PREDICATES,
  createInitialState,
  emit,
  observe,
  reduce,
} from './modes';
import type { E13Action, E13Config, E13State } from './modes';
import { E13View } from './ModeView';
import { forCompare, forLength } from './overlays/adapt';
import { E13_STRINGS } from './strings.ko';

const definition: EngineDefinition<E13Config, E13State, E13Action> = {
  id: 'E13',
  name: E13_STRINGS.name,
  modes: E13_MODES,
  layout: 'fit',
  createInitialState,
  reduce,
  View: E13View,
  observe,
  events: E13_EVENT_NAMES,
  emit,
  predicates: E13_PREDICATES,
  overlays: {
    'endpoint-lines': forCompare(EndpointLinesOverlay),
    'half-straighten': forCompare(HalfStraightenOverlay),
    'same-tank': forCompare(SameTankOverlay),
    'gap-marks': forLength(GapMarksOverlay),
    'span-compare': forLength(SpanCompareOverlay),
  },
};

export default definition;
