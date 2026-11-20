/** proportion 결과 글(색만으로 전달하지 않는다). */
import { balanceStrings as S } from '../strings.ko';
import type { BalanceTilt } from '../types';
import type { ProportionState } from './types';

/** 결과 글(색만으로 전달하지 않는다). */
export function proportionResultText(state: ProportionState, tilt: BalanceTilt): string {
  if (state.cards.length > 0 && state.cardIndex === null) return S.proportion.result.pickCard;
  if (state.settings.pairSelect && state.pair === null) return S.proportion.result.pickPair;
  if (tilt === 'left') return S.result.left;
  if (tilt === 'right') return S.result.right;
  if (tilt === 'level') return S.result.level;
  return S.result.unknown;
}
