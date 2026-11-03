/** E01 수 모형(자릿값 블록) 엔진 정의. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { baseTenStrings } from './strings.ko';
import type { BaseTenAction, BaseTenConfig, BaseTenState } from './types';
import { BaseTenView } from './View';
import { BreakPreviewOverlay } from './overlays/break-preview';
import { PlaceValueOverlay } from './overlays/place-value';
import { TenOutlineOverlay } from './overlays/ten-outline';

const definition: EngineDefinition<BaseTenConfig, BaseTenState, BaseTenAction> = {
  id: 'E01',
  name: baseTenStrings.name,
  modes: ['count', 'regroup', 'add-sub', 'place-chart', 'free'],
  createInitialState,
  reduce,
  View: BaseTenView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'ten-outline': TenOutlineOverlay,
    'place-value': PlaceValueOverlay,
    'break-preview': BreakPreviewOverlay,
  },
};

export default definition;
