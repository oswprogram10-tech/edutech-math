/**
 * E14 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(읽기 전용·허용 분 밖·같은 값)은 상태 그대로(같은 객체)를 돌려준다.
 */
import { allowedTotals, isAllowed, isInt, normalizeConfig } from './settings';
import { MINUTES_PER_HALF_DAY } from './types';
import type { ClockAction, ClockConfig, ClockState } from './types';

export function createInitialState(config: ClockConfig): ClockState {
  return normalizeConfig(config);
}

export function reduce(state: ClockState, action: ClockAction): ClockState {
  if (state.error !== null) return state;
  switch (action.type) {
    case 'set-time': {
      if (state.readOnly) return state;
      const { minutes } = action;
      if (!isInt(minutes, 0, MINUTES_PER_HALF_DAY - 1)) return state;
      if (!isAllowed(state, minutes) || minutes === state.minutes) return state;
      return { ...state, minutes, moves: state.moves + 1 };
    }
    case 'step': {
      if (state.readOnly) return state;
      const { delta } = action;
      if (!Number.isInteger(delta) || delta === 0) return state;
      const list = allowedTotals(state);
      const index = list.indexOf(state.minutes);
      if (index < 0) return state;
      const next = list[(((index + delta) % list.length) + list.length) % list.length];
      if (next === undefined || next === state.minutes) return state;
      return { ...state, minutes: next, moves: state.moves + 1 };
    }
    case 'toggle-unroll':
      return state.unroll ? { ...state, unrolled: !state.unrolled } : state;
    case 'reset':
      return state.minutes === state.initial && state.moves === 0 && !state.unrolled
        ? state
        : { ...state, minutes: state.initial, moves: 0, unrolled: false };
    default:
      return state;
  }
}
