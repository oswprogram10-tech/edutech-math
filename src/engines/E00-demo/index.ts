/**
 * E00-demo 엔진 정의.
 * 다른 엔진을 만들 때 이 폴더를 본보기로 삼는다.
 */
import type { EngineDefinition } from '../../core/engine-sdk';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { demoStrings } from './strings.ko';
import type { DemoAction, DemoConfig, DemoState } from './types';
import { DemoView } from './View';
import { LassoGuideOverlay } from './overlays/lasso-guide';

const definition: EngineDefinition<DemoConfig, DemoState, DemoAction> = {
  id: 'E00',
  name: demoStrings.name,
  modes: ['free'],
  createInitialState,
  reduce,
  View: DemoView,
  observe,
  events: ['counter-added', 'counter-moved', 'grouped', 'ungrouped'],
  overlays: {
    'lasso-guide': LassoGuideOverlay,
  },
};

export default definition;
