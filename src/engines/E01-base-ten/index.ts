/** E01 수 모형(자릿값 블록) 엔진 정의. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates, receive } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { baseTenStrings } from './strings.ko';
import type { BaseTenAction, BaseTenConfig, BaseTenState } from './types';
import { BaseTenView } from './View';
import { BreakPreviewOverlay } from './overlays/break-preview';
import { EmptyPlateOverlay } from './overlays/empty-plate';
import { FourDigitGridOverlay } from './overlays/four-digit-grid';
import { PlaceValueOverlay } from './overlays/place-value';
import { PlateLevelsOverlay } from './overlays/plate-levels';
import { TenOutlineOverlay } from './overlays/ten-outline';

const definition: EngineDefinition<BaseTenConfig, BaseTenState, BaseTenAction> = {
  id: 'E01',
  name: baseTenStrings.name,
  modes: ['count', 'regroup', 'add-sub', 'place-chart', 'free', 'big-number', 'decimal', 'divide'],
  createInitialState,
  reduce,
  View: BaseTenView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  receive(state, event) {
    return receive(state, event);
  },
  overlays: {
    'ten-outline': TenOutlineOverlay,
    'place-value': PlaceValueOverlay,
    'break-preview': BreakPreviewOverlay,
    'empty-plate': EmptyPlateOverlay,
    'four-digit-grid': FourDigitGridOverlay,
    'plate-levels': PlateLevelsOverlay,
  },
};

export default definition;
