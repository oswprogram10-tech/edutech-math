/**
 * E13 map-route 조작 칸의 지역 상태(안내 글)와 조작 함수.
 * 조건이 안 맞는 조작은 이유를 글로 알리고 Action을 보내지 않는다.
 */
import { useState } from 'react';
import { E13_STRINGS as S } from '../strings.ko';
import { reduceRoute } from './reduce';
import { segmentByKey } from './settings';
import type { RouteAction, RouteState } from './types';

export interface RouteUi {
  readonly message: string | null;
  readonly send: (action: RouteAction) => boolean;
}

function rejection(state: RouteState, action: RouteAction): string {
  const text = S.route.rejected;
  switch (action.type) {
    case 'start':
      return state.from !== null ? text.startFixed : text.started;
    case 'add-segment': {
      const end = state.path[state.path.length - 1];
      if (end === undefined) return text.notStarted;
      const segment = segmentByKey(state, action.key);
      if (segment !== undefined && state.used.includes(segment.key)) return text.used;
      return text.notConnected;
    }
    case 'undo':
      return text.nothingToUndo;
    default:
      return text.same;
  }
}

export function useRouteUi(
  state: RouteState,
  dispatch: (action: RouteAction) => void,
  readOnly: boolean,
): RouteUi {
  const [message, setMessage] = useState<string | null>(null);
  const send = (action: RouteAction): boolean => {
    if (readOnly) return false;
    if (reduceRoute(state, action) === state) {
      setMessage(rejection(state, action));
      return false;
    }
    setMessage(null);
    dispatch(action);
    return true;
  };
  return { message, send };
}
