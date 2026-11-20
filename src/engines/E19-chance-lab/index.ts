/** E19 평균·가능성 실험실 엔진 정의. 이번 카드는 `leveling`·`seesaw`·`outlier` 모드만 있다. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { ArmsOverlay } from './overlays/arms';
import { LevelTryOverlay } from './overlays/level-try';
import { MeanPullOverlay } from './overlays/mean-pull';
import { SumTowerOverlay } from './overlays/sum-tower';
import { createInitialState, reduce } from './reduce';
import { E19_STRINGS } from './strings.ko';
import type { ChanceAction, ChanceConfig, ChanceState } from './types';
import { ChanceView } from './View';

const definition: EngineDefinition<ChanceConfig, ChanceState, ChanceAction> = {
  id: 'E19',
  name: E19_STRINGS.name,
  modes: ['leveling', 'seesaw', 'outlier'],
  layout: 'fit',
  createInitialState,
  reduce,
  View: ChanceView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'level-try': LevelTryOverlay,
    'sum-tower': SumTowerOverlay,
    arms: ArmsOverlay,
    'mean-pull': MeanPullOverlay,
  },
};

export default definition;
