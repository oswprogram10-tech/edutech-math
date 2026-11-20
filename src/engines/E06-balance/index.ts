/** E06 양팔저울 엔진 정의. 모드: `equation`(양팔저울 식), `proportion`(외항·내항 격자 넓이 저울). */
import type { EngineDefinition } from '../../core/engine-sdk';
import { createState, observeState, reduceState } from './engine';
import { EVENT_NAMES, emit, predicates } from './events';
import { AreaDiffOverlay } from './overlays/area-diff';
import { BigTiltOverlay } from './overlays/big-tilt';
import { CrossBracketsOverlay } from './overlays/cross-brackets';
import { MatchBarsOverlay } from './overlays/match-bars';
import { balanceStrings } from './strings.ko';
import type { E06Action, E06Config, E06State } from './unions';
import { BalanceView } from './View';

const definition: EngineDefinition<E06Config, E06State, E06Action> = {
  id: 'E06',
  name: balanceStrings.name,
  modes: ['equation', 'proportion'],
  layout: 'fit',
  createInitialState: createState,
  reduce: reduceState,
  View: BalanceView,
  observe: observeState,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'big-tilt': BigTiltOverlay,
    'match-bars': MatchBarsOverlay,
    'cross-brackets': CrossBracketsOverlay,
    'area-diff': AreaDiffOverlay,
  },
};

export default definition;
