/** E05 분수 모델 엔진 정의. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { emit, predicates, receive } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { fractionModelStrings } from './strings.ko';
import type { FractionModelAction, FractionModelConfig, FractionModelState } from './types';
import { FractionModelView } from './View';
import { GridRevealOverlay } from './overlays/grid-reveal';
import { OverlapCountOverlay } from './overlays/overlap-count';
import { RemainderBesideOverlay } from './overlays/remainder-beside';
import { RowPreviewOverlay } from './overlays/row-preview';
import { RulerRepeatOverlay } from './overlays/ruler-repeat';
import { SizeCompareOverlay } from './overlays/size-compare';

const definition: EngineDefinition<FractionModelConfig, FractionModelState, FractionModelAction> = {
  id: 'E05',
  name: fractionModelStrings.name,
  modes: [
    'partition',
    'shade',
    'compare',
    'overlay-slicer',
    'discrete',
    'mixed',
    'add-sub',
    'decimal-grid',
    'multiply',
    'divide-measure',
  ],
  createInitialState,
  reduce,
  View: FractionModelView,
  observe,
  events: [
    'partitioned',
    'shaded',
    'value-changed',
    'fused',
    'broke-whole',
    'overlaid',
    'area-changed',
    'ruler-laid',
    'dealt',
    'rows-set',
    'row-kept',
  ],
  emit,
  receive,
  predicates,
  overlays: {
    'size-compare': SizeCompareOverlay,
    'grid-reveal': GridRevealOverlay,
    'overlap-count': OverlapCountOverlay,
    'ruler-repeat': RulerRepeatOverlay,
    'remainder-beside': RemainderBesideOverlay,
    'row-preview': RowPreviewOverlay,
  },
};

export default definition;
