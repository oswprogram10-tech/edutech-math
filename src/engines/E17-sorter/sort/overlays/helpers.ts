/** sort 오버레이 공용 도우미. 정답(어느 상자가 맞는지)은 계산하지 않는다. */
import type { SorterState } from '../../types';
import { sortCardSlots } from '../layout';
import type { CardSlot } from '../layout';
import { currentCard } from '../reduce';
import type { SortState } from '../types';

export function sortStateOf(state: SorterState): SortState | null {
  return state.mode === 'sort' && state.settings.error === null ? state : null;
}

/** 지금 판에 보이는 카드 자리(컨베이어면 벨트의 지금 카드 포함). */
export function slotsOf(state: SortState): CardSlot[] {
  return sortCardSlots(state, state.settings.conveyor ? currentCard(state) : null);
}
