/**
 * E07 세로셈 격자 엔진 정의.
 * 다른 엔진을 import하지 않는다. 연동은 `value-changed` 등 이벤트로만 한다.
 */
import type { EngineDefinition } from '../../core/engine-sdk';
import { emit, predicates } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { columnCalcStrings } from './strings.ko';
import type { ColumnCalcAction, ColumnCalcConfig, ColumnCalcState } from './types';
import { ColumnCalcView } from './View';
import { ColumnSumOverlay } from './overlays/column-sum';
import { PlaceValueOverlay } from './overlays/place-value';

const definition: EngineDefinition<ColumnCalcConfig, ColumnCalcState, ColumnCalcAction> = {
  id: 'E07',
  name: columnCalcStrings.name,
  modes: ['add', 'sub', 'decimal'],
  createInitialState,
  reduce,
  View: ColumnCalcView,
  observe,
  events: ['cell-entered', 'carry-marked', 'aligned', 'value-changed'],
  emit,
  predicates,
  overlays: {
    'place-value': PlaceValueOverlay,
    'column-sum': ColumnSumOverlay,
  },
};

export default definition;
