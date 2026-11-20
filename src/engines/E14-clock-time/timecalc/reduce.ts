/**
 * E14 time-calc 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 조건이 안 맞는 Action(60 미만 묶기, 풀 큰 칸 없음·작은 칸이 이미 60 이상인 풀기, 칸이 모자란 빼기,
 * 두 번째 빼기)은 상태 그대로를 돌려준다. 작은 단위는 풀어도 119개를 넘지 않는다.
 */
import { BASE, normalizeTimeCalc } from './settings';
import type { TimeCalcAction, TimeCalcConfig, TimeCalcState } from './types';

export function createTimeCalcState(config: TimeCalcConfig): TimeCalcState {
  return normalizeTimeCalc(config);
}

export function canBundle(state: TimeCalcState): boolean {
  return state.error === null && state.small >= BASE;
}

export function canUnbundle(state: TimeCalcState): boolean {
  return state.error === null && state.big >= 1 && state.small < BASE;
}

/** 빼기에 필요한 칸이 모두 있는가(큰 단위·작은 단위가 각각 모자라지 않을 때). */
export function canTakeAway(state: TimeCalcState): boolean {
  return (
    state.error === null &&
    state.op === 'sub' &&
    !state.tookAway &&
    state.big >= state.b.big &&
    state.small >= state.b.small
  );
}

export function reduceTimeCalc(state: TimeCalcState, action: TimeCalcAction): TimeCalcState {
  if (state.error !== null) return state;
  const moved = { moves: state.moves + 1 };
  switch (action.type) {
    case 'bundle':
      if (!canBundle(state)) return state;
      return {
        ...state,
        small: state.small - BASE,
        big: state.big + 1,
        bundles: state.bundles + 1,
        ...moved,
      };
    case 'unbundle':
      if (!canUnbundle(state)) return state;
      return {
        ...state,
        big: state.big - 1,
        small: state.small + BASE,
        unbundles: state.unbundles + 1,
        ...moved,
      };
    case 'take-away':
      if (!canTakeAway(state)) return state;
      return {
        ...state,
        big: state.big - state.b.big,
        small: state.small - state.b.small,
        tookAway: true,
        ...moved,
      };
    case 'reset':
      if (state.moves === 0) return state;
      return { ...state, ...state.initial, bundles: 0, unbundles: 0, tookAway: false, moves: 0 };
    default:
      return state;
  }
}
