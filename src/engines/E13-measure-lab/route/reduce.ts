/**
 * E13 map-route 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(출발 전 구간·끝에 닿지 않은 구간·이미 쓴 구간·지울 것 없음)은 상태 그대로를 돌려준다.
 */
import { initialPath, normalizeRoute, otherEnd, segmentByKey } from './settings';
import type { RouteAction, RouteConfig, RouteState } from './types';

export function createRouteState(config: RouteConfig): RouteState {
  return normalizeRoute(config);
}

function samePath(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((node, i) => node === b[i]);
}

export function reduceRoute(state: RouteState, action: RouteAction): RouteState {
  if (state.error !== null) return state;
  switch (action.type) {
    case 'start': {
      // from이 정해져 있거나 이미 출발했으면 거절한다. 구간에 닿은 노드에서만 출발한다.
      if (state.from !== null || state.path.length > 0) return state;
      const touched = state.segments.some((seg) => seg.a === action.node || seg.b === action.node);
      if (!touched) return state;
      return { ...state, path: [action.node], moves: state.moves + 1 };
    }
    case 'add-segment': {
      const end = state.path[state.path.length - 1];
      if (end === undefined) return state;
      const segment = segmentByKey(state, action.key);
      if (segment === undefined || state.used.includes(segment.key)) return state;
      const next = otherEnd(segment, end);
      if (next === null) return state;
      return {
        ...state,
        path: [...state.path, next],
        used: [...state.used, segment.key],
        moves: state.moves + 1,
      };
    }
    case 'undo': {
      if (state.used.length === 0) return state;
      return {
        ...state,
        path: state.path.slice(0, -1),
        used: state.used.slice(0, -1),
        moves: state.moves + 1,
      };
    }
    case 'reset': {
      const initial = initialPath(state);
      if (state.used.length === 0 && samePath(state.path, initial)) return state;
      return { ...state, path: initial, used: [], moves: state.moves + 1 };
    }
    default:
      return state;
  }
}
