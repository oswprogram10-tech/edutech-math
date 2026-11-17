/**
 * E12 각기둥 전개도 '카드만 보기' 판정. 화면만 가르며 상태·reduce·observe는 바꾸지 않는다.
 * 보기 카드가 있고 그리기·접기·처음 놓인 조각이 모두 없을 때 참이다.
 */
import type { PrismNetState } from '../types';

export function isPrismNetCardsOnly(state: PrismNetState): boolean {
  const s = state.settings;
  return s.netCards.length > 0 && !s.editable && !s.foldable && state.pieces.length === 0;
}
