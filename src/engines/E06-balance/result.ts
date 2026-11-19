/** 결과 글(색만으로 전달하지 않는다). */
import { balanceStrings as S } from './strings.ko';
import type { BalanceState, BalanceTilt } from './types';

export function resultText(state: BalanceState, tilt: BalanceTilt): string {
  if (tilt === 'left') return S.result.left;
  if (tilt === 'right') return S.result.right;
  if (tilt === 'level') return S.result.level;
  return state.settings.allowTryValue ? S.result.unknown : S.result.unknownFixed;
}
