/**
 * E13 unit-train 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 조건이 안 맞는 Action(10cm 막대 10개 미만 승격, 풀 칸 없음, 칸이 모자란 빼기, 두 번째 빼기)은
 * 상태 그대로를 돌려준다.
 */
import { normalizeTrain } from './settings';
import type { TrainAction, TrainConfig, TrainState } from './types';

export function createTrainState(config: TrainConfig): TrainState {
  return normalizeTrain(config);
}

/** 빼기에 필요한 칸이 모두 있는가(m 칸, 10cm 막대, 1cm 블록). */
export function canTakeAway(state: TrainState): boolean {
  return (
    state.op === 'sub' &&
    !state.tookAway &&
    state.m >= state.b.m &&
    state.rods >= Math.floor(state.b.cm / 10) &&
    state.blocks >= state.b.cm % 10
  );
}

export function reduceTrain(state: TrainState, action: TrainAction): TrainState {
  if (state.error !== null) return state;
  const moved = { moves: state.moves + 1 };
  switch (action.type) {
    case 'promote':
      if (state.rods < 10) return state;
      return {
        ...state,
        rods: state.rods - 10,
        m: state.m + 1,
        promotes: state.promotes + 1,
        ...moved,
      };
    case 'unpack':
      if (state.m < 1) return state;
      return {
        ...state,
        m: state.m - 1,
        rods: state.rods + 10,
        unpacks: state.unpacks + 1,
        ...moved,
      };
    case 'unpack-small':
      if (state.rods < 1) return state;
      return { ...state, rods: state.rods - 1, blocks: state.blocks + 10, ...moved };
    case 'take-away':
      if (!canTakeAway(state)) return state;
      return {
        ...state,
        m: state.m - state.b.m,
        rods: state.rods - Math.floor(state.b.cm / 10),
        blocks: state.blocks - (state.b.cm % 10),
        tookAway: true,
        ...moved,
      };
    case 'reset': {
      if (state.moves === 0) return state;
      return {
        ...state,
        ...state.initial,
        promotes: 0,
        unpacks: 0,
        tookAway: false,
        moves: 0,
      };
    }
    default:
      return state;
  }
}
