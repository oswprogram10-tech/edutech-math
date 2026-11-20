/**
 * E14 duration 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(범위·step 밖, 끝이 시작보다 앞, 고정된 시작, 같은 값)은 같은 객체를 돌려준다.
 */
import { normalizeDuration, onGrid } from './settings';
import type { DurationAction, DurationConfig, DurationState } from './types';

export function createDurationState(config: DurationConfig): DurationState {
  return normalizeDuration(config);
}

export function reduceDuration(state: DurationState, action: DurationAction): DurationState {
  if (state.error !== null) return state;
  switch (action.type) {
    case 'set-mark': {
      const { which, minutes } = action;
      if (which !== 'start' && which !== 'end') return state;
      if (!onGrid(state, minutes)) return state;
      if (which === 'start') {
        if (state.startFixed) return state;
        if (state.end !== null && minutes > state.end) return state;
        if (minutes === state.start) return state;
        return { ...state, start: minutes, moves: state.moves + 1 };
      }
      if (state.start !== null && minutes < state.start) return state;
      if (minutes === state.end) return state;
      return { ...state, end: minutes, moves: state.moves + 1 };
    }
    case 'reset':
      return state.start === state.initialStart && state.end === null && state.moves === 0
        ? state
        : { ...state, start: state.initialStart, end: null, moves: 0 };
    default:
      return state;
  }
}
