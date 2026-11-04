/**
 * E07 세로셈 격자 엔진 정의.
 * 다른 엔진을 import하지 않는다. 연동은 `value-changed` 등 이벤트로만 한다.
 */
import type { EngineDefinition } from '../../core/engine-sdk';
import { emit, predicates } from './events';
import { observe } from './observe';
import { receive } from './receive';
import { createInitialState, reduce } from './reduce';
import { columnCalcStrings } from './strings.ko';
import type { ColumnCalcAction, ColumnCalcConfig, ColumnCalcState } from './types';
import { ColumnCalcView } from './View';
import { AlignCompareOverlay } from './overlays/align-compare';
import { ColumnSumOverlay } from './overlays/column-sum';
import { LadderFocusOverlay } from './overlays/ladder-focus';
import { LeftoverBlinkOverlay } from './overlays/leftover-blink';
import { PartialShiftOverlay } from './overlays/partial-shift';
import { PartialSplitOverlay } from './overlays/partial-split';
import { PlaceValueOverlay } from './overlays/place-value';
import { PointEstimateOverlay } from './overlays/point-estimate';
import { QuotientGapOverlay } from './overlays/quotient-gap';
import { RemainderVsDivisorOverlay } from './overlays/remainder-vs-divisor';

const definition: EngineDefinition<ColumnCalcConfig, ColumnCalcState, ColumnCalcAction> = {
  id: 'E07',
  name: columnCalcStrings.name,
  modes: ['add', 'sub', 'decimal', 'mul', 'estimate', 'div'],
  createInitialState,
  reduce,
  View: ColumnCalcView,
  observe,
  receive,
  events: [
    'cell-entered',
    'carry-marked',
    'aligned',
    'value-changed',
    'estimate-locked',
    'signal-changed',
    'estimate-tried',
    'alarm-changed',
    'rewind-requested',
    'point-placed',
    'shifted',
  ],
  emit,
  predicates,
  overlays: {
    'place-value': PlaceValueOverlay,
    'column-sum': ColumnSumOverlay,
    'partial-shift': PartialShiftOverlay,
    'partial-split': PartialSplitOverlay,
    'quotient-gap': QuotientGapOverlay,
    'remainder-vs-divisor': RemainderVsDivisorOverlay,
    'leftover-blink': LeftoverBlinkOverlay,
    'ladder-focus': LadderFocusOverlay,
    'point-estimate': PointEstimateOverlay,
    'align-compare': AlignCompareOverlay,
  },
};

export default definition;
