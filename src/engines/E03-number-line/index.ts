/**
 * E03 수직선 엔진 정의.
 * 다른 엔진을 import하지 않는다. 연동은 events의 `value-changed`로만 한다.
 */
import type { EngineDefinition } from '../../core/engine-sdk';
import { emit, predicates, receive } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { numberLineStrings } from './strings.ko';
import type { NumberLineAction, NumberLineConfig, NumberLineState } from './types';
import { NumberLineView } from './View';
import { DistanceFromZeroOverlay } from './overlays/distance-from-zero';
import { SamePointOverlay } from './overlays/same-point';

const definition: EngineDefinition<NumberLineConfig, NumberLineState, NumberLineAction> = {
  id: 'E03',
  name: numberLineStrings.name,
  modes: ['integer', 'fraction', 'decimal'],
  createInitialState,
  reduce,
  View: NumberLineView,
  observe,
  events: ['point-placed', 'point-moved', 'jumped', 'card-placed', 'zoomed', 'value-changed'],
  emit,
  receive,
  predicates,
  overlays: {
    'distance-from-zero': DistanceFromZeroOverlay,
    'same-point': SamePointOverlay,
  },
};

export default definition;
