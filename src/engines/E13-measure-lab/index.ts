/** E13 측정 실험실 엔진 정의. 모드 여섯(`compare-direct`, `length`(+`unit-train` 변형), `estimate`, `map-route`, `capacity`, `weight`). */
import type { EngineDefinition } from '../../core/engine-sdk';
import { LiterCupsOverlay } from './capacity/overlays/liter-cups';
import { MlMergeOverlay } from './capacity/overlays/ml-merge';
import { SameBeakerOverlay } from './capacity/overlays/same-beaker';
import { SizeWeightBarsOverlay } from './weight/overlays/size-weight-bars';
import { CountCellsOverlay } from './estimate/overlays/count-cells';
import { MmCountOverlay } from './estimate/overlays/mm-count';
import { EndpointLinesOverlay } from './compare/overlays/endpoint-lines';
import { HalfStraightenOverlay } from './compare/overlays/half-straighten';
import { SameTankOverlay } from './compare/overlays/same-tank';
import { GapMarksOverlay } from './length/overlays/gap-marks';
import { SpanCompareOverlay } from './length/overlays/span-compare';
import { MeterOutlineOverlay } from './train/overlays/meter-outline';
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
import {
  Meter100Overlay,
  forCapacity,
  forCompare,
  forEstimate,
  forLength,
  forTrain,
  forWeight,
} from './overlays/adapt';
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
    'count-cells': forEstimate(CountCellsOverlay),
    'mm-count': forEstimate(MmCountOverlay),
    'meter-100': Meter100Overlay,
    'meter-outline': forTrain(MeterOutlineOverlay),
    'same-beaker': forCapacity(SameBeakerOverlay),
    'liter-cups': forCapacity(LiterCupsOverlay),
    'ml-merge': forCapacity(MlMergeOverlay),
    'size-weight-bars': forWeight(SizeWeightBarsOverlay),
  },
};

export default definition;
