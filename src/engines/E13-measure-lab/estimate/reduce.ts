/**
 * E13 estimate 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(어림 전 자 이동·고정된 자·한 번 넣은 어림·범위 밖)은 상태 그대로를 돌려준다.
 */
import { rat } from '../rat';
import { normalizeEstimate, offsetOf, rulerHidden, validOffset } from './settings';
import type { EstimateAction, EstimateConfig, EstimateState } from './types';

export function createEstimateState(config: EstimateConfig): EstimateState {
  return normalizeEstimate(config);
}

export function reduceEstimate(state: EstimateState, action: EstimateAction): EstimateState {
  if (state.error !== null) return state;
  switch (action.type) {
    case 'move-ruler': {
      if (!state.draggable) return state;
      if (state.estimateFirst && !state.estimateLocked) return state;
      const offset = rat(action.offsetCm);
      if (offset === null || !validOffset(offset)) return state;
      if (offset.equals(offsetOf(state))) return state;
      return {
        ...state,
        rulerOffset: offset.toString(),
        rulerMoves: state.rulerMoves + 1,
        moves: state.moves + 1,
      };
    }
    case 'estimate': {
      if (!state.estimateFirst || state.estimateLocked) return state;
      const value = action.value;
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 99) {
        return state;
      }
      return { ...state, estimate: value, estimateLocked: true, moves: state.moves + 1 };
    }
    case 'zoom': {
      // [눈금 크게]는 mm 눈금이 있는 설정에서만, 자가 보일 때만. 같은 값으로 또 바꾸면 거절한다.
      if (!state.zoomMm || rulerHidden(state)) return state;
      if (typeof action.on !== 'boolean' || action.on === state.zoomed) return state;
      return { ...state, zoomed: action.on, moves: state.moves + 1 };
    }
    case 'reset': {
      if (state.rulerOffset === state.initialOffset && state.rulerMoves === 0) return state;
      return {
        ...state,
        rulerOffset: state.initialOffset,
        rulerMoves: 0,
        moves: state.estimateLocked ? 1 : 0,
      };
    }
    default:
      return state;
  }
}
