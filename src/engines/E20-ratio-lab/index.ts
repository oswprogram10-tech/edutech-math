/** E20 비·비율 실험실 엔진 정의. 이번 카드는 `mix`·`resize` 모드만 있다. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { GrowthArrowsOverlay } from './overlays/growth-arrows';
import { RatioGridOverlay } from './overlays/ratio-grid';
import { SideBySideOverlay } from './overlays/side-by-side';
import { UnitGroupsOverlay } from './overlays/unit-groups';
import { createInitialState, reduce } from './reduce';
import { E20_STRINGS } from './strings.ko';
import type { RatioAction, RatioConfig, RatioState } from './types';
import { RatioView } from './View';

const definition: EngineDefinition<RatioConfig, RatioState, RatioAction> = {
  id: 'E20',
  name: E20_STRINGS.name,
  modes: ['mix', 'resize'],
  layout: 'fit',
  createInitialState,
  reduce,
  View: RatioView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'side-by-side': SideBySideOverlay,
    'unit-groups': UnitGroupsOverlay,
    'ratio-grid': RatioGridOverlay,
    'growth-arrows': GrowthArrowsOverlay,
  },
};

export default definition;
