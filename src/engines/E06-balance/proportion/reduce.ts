/**
 * proportion 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(범위 밖·잘못된 번호)은 상태 그대로(같은 객체)를 돌려준다.
 */
import { normalizeProportion } from './settings';
import type { ProportionAction, ProportionConfig, ProportionState } from './types';

export function createProportionState(config: ProportionConfig): ProportionState {
  return normalizeProportion(config);
}

/** 넣어 볼 수: 정수 문자열이고 슬라이더 범위 안이어야 한다. 아니면 null. */
export function parseSliderValue(raw: unknown, min: number, max: number): number | null {
  if (typeof raw !== 'string' || !/^\d{1,3}$/.test(raw)) return null;
  const value = Number(raw);
  return value >= min && value <= max ? value : null;
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3;
}

export function reduceProportion(
  state: ProportionState,
  action: ProportionAction,
): ProportionState {
  if (state.error !== null) return state;
  switch (action.type) {
    case 'try': {
      if (state.boxIndex === null) return state;
      const { min, max } = state.settings.slider;
      const value = parseSliderValue(action.value, min, max);
      if (value === null) return state;
      const text = String(value);
      return { ...state, tryValue: text, tries: [...state.tries, text] };
    }
    case 'select-card': {
      const index: unknown = action.index;
      if (typeof index !== 'number' || !Number.isInteger(index)) return state;
      const card = state.cards[index];
      if (card === undefined || state.cardIndex === index) return state;
      return { ...state, cardIndex: index, terms: [...card] };
    }
    case 'pick-pair': {
      if (!state.settings.pairSelect || state.terms.length !== 4) return state;
      const indices: unknown = action.indices;
      if (!Array.isArray(indices) || indices.length !== 2) return state;
      const [i, j] = indices as unknown[];
      if (!isIndex(i) || !isIndex(j) || i === j) return state;
      if (state.pair !== null && state.pair[0] === i && state.pair[1] === j) return state;
      return { ...state, pair: [i, j] };
    }
    case 'reset': {
      const cardMode = state.cards.length > 0;
      if (
        state.tryValue === null &&
        state.pair === null &&
        state.cardIndex === null &&
        (!cardMode || state.terms.length === 0)
      ) {
        return state;
      }
      // tries는 기록이라 지우지 않는다.
      return {
        ...state,
        tryValue: null,
        pair: null,
        cardIndex: null,
        terms: cardMode ? [] : state.terms,
      };
    }
    default:
      return state;
  }
}
