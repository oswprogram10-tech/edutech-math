/**
 * E17 sort 순수 reducer. 시간·난수를 쓰지 않는다(컨베이어 순서는 설정의 카드 순서).
 * 분류가 맞는지는 저장하지 않는다. 판정은 `observe.ts`가 계산한다.
 */
import { iconChoices } from './criteria';
import { activeBinIds, sortSettings } from './settings';
import { COUNT_MAX } from './types';
import type { BinId, SortAction, SortSettings, SortState } from './types';

export function initialSortState(settings: SortSettings): SortState {
  const binOf: Record<string, BinId | null> = {};
  for (const id of settings.cards) binOf[id] = null;
  for (const [bin, ids] of Object.entries(settings.prefill)) {
    for (const id of ids) binOf[id] = bin as BinId;
  }
  return {
    mode: 'sort',
    settings,
    criterion: null,
    criterionHistory: [],
    binOf,
    icons: {},
    counts: {},
  };
}

export function createSortState(config: unknown): SortState {
  return initialSortState(sortSettings(config));
}

/** 컨베이어에서 지금 벨트에 온 카드: 순서상 처음으로 상자에 없는 카드. */
export function currentCard(state: SortState): string | null {
  for (const id of state.settings.cards) {
    if (state.binOf[id] === null) return id;
  }
  return null;
}

export function activeBins(state: SortState): BinId[] {
  return activeBinIds(state.settings, state.criterion);
}

export function allPlacedOf(state: SortState): boolean {
  return state.settings.cards.every((id) => state.binOf[id] !== null);
}

export function reduceSort(state: SortState, action: SortAction): SortState {
  if (state.settings.error !== null) return state;
  switch (action.type) {
    case 'choose-criterion': {
      const choices = state.settings.criterionChoice;
      if (choices === null || state.criterion !== null) return state;
      if (!choices.includes(action.criterion)) return state;
      return {
        ...state,
        criterion: action.criterion,
        criterionHistory: [...state.criterionHistory, action.criterion],
      };
    }
    case 'change-criterion': {
      if (state.settings.criterionChoice === null || state.criterion === null) return state;
      const binOf: Record<string, BinId | null> = {};
      for (const id of state.settings.cards) binOf[id] = null;
      return { ...state, criterion: null, binOf, icons: {}, counts: {} };
    }
    case 'move': {
      if (!state.settings.cards.includes(action.card)) return state;
      const from = state.binOf[action.card] ?? null;
      if (action.to === 'tray') {
        if (from === null) return state;
        return { ...state, binOf: { ...state.binOf, [action.card]: null } };
      }
      if (state.settings.criterionChoice !== null && state.criterion === null) return state;
      if (!activeBins(state).includes(action.to)) return state;
      if (from === action.to) return state;
      if (state.settings.conveyor && from === null && currentCard(state) !== action.card) {
        return state;
      }
      return { ...state, binOf: { ...state.binOf, [action.card]: action.to } };
    }
    case 'label-bin': {
      if (state.settings.binLabels !== 'student-choice-icon') return state;
      if (!activeBins(state).includes(action.bin)) return state;
      if (action.icon !== null && !iconChoices(state.settings.deck).includes(action.icon)) {
        return state;
      }
      if ((state.icons[action.bin] ?? null) === action.icon) return state;
      return { ...state, icons: { ...state.icons, [action.bin]: action.icon } };
    }
    case 'count': {
      if (state.settings.countTable !== 'student' || !allPlacedOf(state)) return state;
      if (!activeBins(state).includes(action.bin)) return state;
      if (!Number.isInteger(action.value) || action.value < 0 || action.value > COUNT_MAX) {
        return state;
      }
      if ((state.counts[action.bin] ?? null) === action.value) return state;
      return { ...state, counts: { ...state.counts, [action.bin]: action.value } };
    }
    case 'reset':
      return initialSortState(state.settings);
    default:
      return state;
  }
}
