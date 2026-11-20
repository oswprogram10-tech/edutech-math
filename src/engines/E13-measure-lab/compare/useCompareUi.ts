/**
 * E13 compare-direct 조작 칸의 지역 상태(안내 글)와 키보드 이동.
 * 거절된 조작은 이유를 글로 알린다. 끌기 도중 좌표는 판 컴포넌트의 지역 상태에만 둔다.
 */
import { useState } from 'react';
import { E13_STRINGS as S } from '../strings.ko';
import { num } from '../rat';
import { reduceCompare } from './reduce';
import { boundsOf } from './settings';
import type { CompareAction, CompareState } from './types';

export interface CompareUi {
  readonly message: string | null;
  readonly send: (action: CompareAction) => boolean;
  /** 놓을 칸(정수)을 Action으로 보낸다. */
  readonly place: (id: string, x: number, y: number) => boolean;
  /** 방향키 한 칸 이동. */
  readonly moveBy: (id: string, dx: number, dy: number) => void;
}

function rejection(action: CompareAction): string {
  const text = S.compare.rejected;
  if (action.type === 'place') return text.same;
  if (action.type === 'reset') return text.same;
  return text.already;
}

export function useCompareUi(
  state: CompareState,
  dispatch: (action: CompareAction) => void,
  readOnly: boolean,
): CompareUi {
  const [message, setMessage] = useState<string | null>(null);

  const send = (action: CompareAction): boolean => {
    if (readOnly) return false;
    if (reduceCompare(state, action) === state) {
      setMessage(rejection(action));
      return false;
    }
    setMessage(null);
    dispatch(action);
    return true;
  };

  const place = (id: string, x: number, y: number): boolean =>
    send({ type: 'place', id, x: String(x), y: String(y) });

  const moveBy = (id: string, dx: number, dy: number) => {
    if (state.attribute === 'capacity') return;
    const item = state.items.find((candidate) => candidate.id === id);
    const bounds = boundsOf(state, id);
    if (!item || !bounds) return;
    const x = num(item.x) + dx;
    const y = num(item.y) + dy;
    if (x < 0 || y < 0 || x > bounds.maxX || y > bounds.maxY) {
      if (!readOnly) setMessage(S.compare.rejected.out);
      return;
    }
    place(id, x, y);
  };

  return { message, send, place, moveBy };
}
