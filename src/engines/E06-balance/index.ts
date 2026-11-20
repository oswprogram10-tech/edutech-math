/** E06 양팔저울 엔진 정의. 모드: `equation`(양팔저울 식), `proportion`(외항·내항 격자 넓이 저울), `compare`(물건 무게 비교). */
import type { EngineDefinition } from '../../core/engine-sdk';
import { comparePredicates, emitCompare } from './compare/events';
import { SizeVsWeightOverlay } from './compare/overlays/size-vs-weight';
import { skipInCompare } from './compare/overlays/guard';
import type { CompareAction, CompareState } from './compare/types';
import { createState, observeState, reduceState } from './engine';
import { EVENT_NAMES, emit as emitBalance, predicates as balancePredicates } from './events';
import { AreaDiffOverlay } from './overlays/area-diff';
import { BigTiltOverlay } from './overlays/big-tilt';
import { CrossBracketsOverlay } from './overlays/cross-brackets';
import { MatchBarsOverlay } from './overlays/match-bars';
import { balanceStrings } from './strings.ko';
import type { E06Action, E06Config, E06State } from './unions';
import { BalanceView } from './View';

function emit(prev: E06State, next: E06State, action: E06Action) {
  return next.mode === 'compare'
    ? emitCompare(prev as CompareState, next, action as CompareAction)
    : emitBalance(prev, next, action);
}

const definition: EngineDefinition<E06Config, E06State, E06Action> = {
  id: 'E06',
  name: balanceStrings.name,
  modes: ['equation', 'proportion', 'compare'],
  layout: 'fit',
  createInitialState: createState,
  reduce: reduceState,
  View: BalanceView,
  observe: observeState,
  events: EVENT_NAMES,
  emit,
  predicates: { ...balancePredicates, ...comparePredicates },
  overlays: {
    'big-tilt': skipInCompare(BigTiltOverlay),
    'match-bars': skipInCompare(MatchBarsOverlay),
    'cross-brackets': skipInCompare(CrossBracketsOverlay),
    'area-diff': skipInCompare(AreaDiffOverlay),
    'size-vs-weight': SizeVsWeightOverlay,
  },
};

export default definition;
