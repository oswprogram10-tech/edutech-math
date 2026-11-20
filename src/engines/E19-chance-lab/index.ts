/** E19 평균·가능성 실험실 엔진 정의. 모드: 평균 셋(leveling·seesaw·outlier)과 가능성 셋(words·spinner·simulate). */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { AfterStreakOverlay } from './overlays/after-streak';
import { ArmsOverlay } from './overlays/arms';
import { LevelTryOverlay } from './overlays/level-try';
import { MeanPullOverlay } from './overlays/mean-pull';
import { SmallBatchesOverlay } from './overlays/small-batches';
import { SumTowerOverlay } from './overlays/sum-tower';
import { createInitialState, reduce } from './reduce';
import { E19_STRINGS } from './strings.ko';
import type { ChanceAction, ChanceConfig, ChanceState } from './types';
import { ChanceView } from './View';

const definition: EngineDefinition<ChanceConfig, ChanceState, ChanceAction> = {
  id: 'E19',
  name: E19_STRINGS.name,
  modes: ['leveling', 'seesaw', 'outlier', 'words', 'spinner', 'simulate'],
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
    'small-batches': SmallBatchesOverlay,
    'after-streak': AfterStreakOverlay,
  },
};

export default definition;
