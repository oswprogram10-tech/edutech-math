/**
 * E12 `net-fold` '카드만 보기' 판정. 화면만 가르며 상태·reduce·observe는 바꾸지 않는다.
 * 보기 카드만 있고 그리기·접기·예측·전개도 기록·처음 놓인 면이 모두 없을 때 참이다.
 */
import type { NetFoldState } from '../types';

export function isNetCardsOnly(state: NetFoldState): boolean {
  const s = state.settings;
  return (
    s.netCards.length > 0 &&
    !s.editable &&
    !s.foldable &&
    s.predict === null &&
    !s.netLog &&
    state.faces.length === 0
  );
}
