/**
 * E14 duration 조작 칸의 지역 상태(안내 글)와 키보드 처리.
 * 거절된 조작은 이유를 글로 알린다. 끌기 도중 좌표는 판 컴포넌트의 지역 상태에만 둔다.
 */
import { useState } from 'react';
import { E14_MODE_STRINGS } from '../strings-modes.ko';
import { reduceDuration } from './reduce';
import { onGrid } from './settings';
import type { DurationAction, DurationState, MarkName } from './types';

const S = E14_MODE_STRINGS.duration;

export interface DurationUi {
  readonly message: string | null;
  readonly send: (action: DurationAction) => boolean;
  /** 표시를 step만큼 옮긴다. 아직 놓지 않았다면 기준 자리에 처음 놓는다. */
  readonly moveMark: (which: MarkName, delta: -1 | 1) => void;
  readonly locked: boolean;
}

function rejection(state: DurationState, action: DurationAction): string {
  if (action.type !== 'set-mark') return S.rejected.same;
  if (!onGrid(state, action.minutes)) return S.rejected.notAllowed;
  if (action.which === 'start') {
    if (state.startFixed) return S.rejected.startFixed;
    if (state.end !== null && action.minutes > state.end) return S.rejected.startAfterEnd;
    return S.rejected.same;
  }
  if (state.start !== null && action.minutes < state.start) return S.rejected.endBeforeStart;
  return S.rejected.same;
}

export function useDurationUi(
  state: DurationState,
  dispatch: (action: DurationAction) => void,
  readOnly: boolean,
): DurationUi {
  const [message, setMessage] = useState<string | null>(null);

  const send = (action: DurationAction): boolean => {
    if (readOnly) return false;
    if (reduceDuration(state, action) === state) {
      setMessage(rejection(state, action));
      return false;
    }
    setMessage(null);
    dispatch(action);
    return true;
  };

  const moveMark = (which: MarkName, delta: -1 | 1) => {
    const current = which === 'start' ? state.start : state.end;
    const base = which === 'start' ? state.from : (state.start ?? state.from);
    const minutes = current === null ? base : current + delta * state.step;
    send({ type: 'set-mark', which, minutes });
  };

  return { message, send, moveMark, locked: readOnly };
}
