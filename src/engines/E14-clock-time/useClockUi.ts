/**
 * E14 조작 칸의 지역 상태(안내 글)와 키보드 처리.
 * 거절된 조작은 이유를 글로 알린다. 끌기 도중 좌표는 판 컴포넌트의 지역 상태에만 둔다.
 */
import { useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { reduce } from './reduce';
import { isAllowed, wrapMinutes } from './settings';
import { E14_STRINGS as S } from './strings.ko';
import type { ClockAction, ClockState } from './types';

export interface ClockUi {
  readonly message: string | null;
  readonly send: (action: ClockAction) => boolean;
  /** ◀ 거꾸로·앞으로 ▶: 허용 간격 한 칸. */
  readonly stepBy: (delta: -1 | 1) => void;
  /** 한 시간(60분) 움직이기. */
  readonly hourBy: (delta: -1 | 1) => void;
  readonly onSliderKeyDown: (event: ReactKeyboardEvent<Element>) => void;
}

function rejection(state: ClockState, action: ClockAction): string {
  if (action.type === 'toggle-unroll') return S.rejected.unroll;
  if (state.readOnly) return S.rejected.readOnly;
  if (action.type === 'set-time') {
    return isAllowed(state, action.minutes) ? S.rejected.same : S.rejected.notAllowed;
  }
  return S.rejected.same;
}

export function useClockUi(
  state: ClockState,
  dispatch: (action: ClockAction) => void,
  readOnly: boolean,
): ClockUi {
  const [message, setMessage] = useState<string | null>(null);

  const send = (action: ClockAction): boolean => {
    if (readOnly) return false;
    if (reduce(state, action) === state) {
      setMessage(rejection(state, action));
      return false;
    }
    setMessage(null);
    dispatch(action);
    return true;
  };

  const stepBy = (delta: -1 | 1) => {
    send({ type: 'step', delta });
  };
  const hourBy = (delta: -1 | 1) => {
    send({ type: 'set-time', minutes: wrapMinutes(state.minutes + delta * 60) });
  };

  const onSliderKeyDown = (event: ReactKeyboardEvent<Element>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    if (event.shiftKey) hourBy(delta);
    else stepBy(delta);
  };

  return { message, send, stepBy, hourBy, onSliderKeyDown };
}
