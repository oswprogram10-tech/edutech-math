/**
 * E13 weight 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action은 상태 그대로(같은 객체)를 돌려준다. `reset`은 예측과 비교 기록을 남긴다.
 */
import { MAX_CLIPS, normalizeWeight, objectOf, pairKey, placeOf } from './settings';
import type { Pan, WeightAction, WeightConfig, WeightState } from './types';

export function createWeightState(config: WeightConfig): WeightState {
  return normalizeWeight(config);
}

export type WeightReject =
  | 'ok'
  | 'unknown'
  | 'predict-first'
  | 'no-tool'
  | 'same'
  | 'pan-busy'
  | 'clips-on-right'
  | 'object-on-right'
  | 'no-clips'
  | 'clip-max'
  | 'clip-min'
  | 'not-predicting'
  | 'locked'
  | 'nothing';

const PANS: readonly string[] = ['left', 'right', 'shelf'];

/** Action을 받아들일 수 있는지(거절 이유). View가 안내 글에 쓴다. */
export function rejectReason(state: WeightState, action: WeightAction): WeightReject {
  if (state.error !== null) return 'unknown';
  const blocked = state.predict && !state.predictionLocked;
  switch (action.type) {
    case 'place': {
      const { id, pan } = action;
      if (objectOf(state, id) === undefined || typeof pan !== 'string' || !PANS.includes(pan)) {
        return 'unknown';
      }
      if (blocked) return 'predict-first';
      if (pan !== 'shelf' && !state.tools.includes('pan-balance')) return 'no-tool';
      if (placeOf(state, id) === pan) return 'same';
      if (pan === 'left' && state.left !== null) return 'pan-busy';
      if (pan === 'right') {
        if (state.right !== null) return 'pan-busy';
        if (state.clips > 0) return 'clips-on-right';
      }
      return 'ok';
    }
    case 'hang': {
      if (action.id === null) return state.hung === null ? 'nothing' : 'ok';
      if (objectOf(state, action.id) === undefined) return 'unknown';
      if (blocked) return 'predict-first';
      if (!state.tools.includes('spring-scale')) return 'no-tool';
      return state.hung === action.id ? 'same' : 'ok';
    }
    case 'clip': {
      if (state.clipG === null) return 'no-clips';
      if (blocked) return 'predict-first';
      if (action.delta === 1) {
        if (state.right !== null) return 'object-on-right';
        return state.clips >= MAX_CLIPS ? 'clip-max' : 'ok';
      }
      return state.clips <= 0 ? 'clip-min' : 'ok';
    }
    case 'predict': {
      if (!state.predict) return 'not-predicting';
      if (state.predictionLocked) return 'locked';
      return objectOf(state, action.id) === undefined ? 'unknown' : 'ok';
    }
    case 'reset': {
      const clean =
        state.left === null && state.right === null && state.clips === 0 && state.hung === null;
      return clean ? 'same' : 'ok';
    }
    default:
      return 'unknown';
  }
}

function withPair(state: WeightState): readonly string[] {
  if (state.left === null || state.right === null) return state.pairs;
  const key = pairKey(state.left, state.right);
  return state.pairs.includes(key) ? state.pairs : [...state.pairs, key];
}

export function reduceWeight(state: WeightState, action: WeightAction): WeightState {
  if (rejectReason(state, action) !== 'ok') return state;
  const moves = state.moves + 1;
  switch (action.type) {
    case 'place': {
      const pan: Pan = action.pan;
      // 한 물건은 한 곳에만 있다: 있던 곳에서 빼고 새 곳에 놓는다.
      const next: WeightState = {
        ...state,
        left: state.left === action.id ? null : state.left,
        right: state.right === action.id ? null : state.right,
        hung: state.hung === action.id ? null : state.hung,
        moves,
      };
      const placed =
        pan === 'left'
          ? { ...next, left: action.id }
          : pan === 'right'
            ? { ...next, right: action.id }
            : next;
      return { ...placed, pairs: withPair(placed) };
    }
    case 'hang': {
      if (action.id === null) return { ...state, hung: null, moves };
      return {
        ...state,
        left: state.left === action.id ? null : state.left,
        right: state.right === action.id ? null : state.right,
        hung: action.id,
        moves,
      };
    }
    case 'clip':
      return { ...state, clips: state.clips + action.delta, moves };
    case 'predict':
      return { ...state, prediction: action.id, predictionLocked: true, moves };
    case 'reset':
      return { ...state, left: null, right: null, clips: 0, hung: null, moves };
    default:
      return state;
  }
}
