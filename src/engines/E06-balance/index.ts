/** E06 양팔저울 엔진 정의. 이번 카드는 `equation` 모드만 있다. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { BigTiltOverlay } from './overlays/big-tilt';
import { MatchBarsOverlay } from './overlays/match-bars';
import { createInitialState, reduce } from './reduce';
import { balanceStrings } from './strings.ko';
import type { BalanceAction, BalanceConfig, BalanceState } from './types';
import { BalanceView } from './View';

const definition: EngineDefinition<BalanceConfig, BalanceState, BalanceAction> = {
  id: 'E06',
  name: balanceStrings.name,
  modes: ['equation'],
  layout: 'fit',
  createInitialState,
  reduce,
  View: BalanceView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'big-tilt': BigTiltOverlay,
    'match-bars': MatchBarsOverlay,
  },
};

export default definition;
