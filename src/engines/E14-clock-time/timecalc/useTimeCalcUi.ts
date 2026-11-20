/**
 * E14 time-calc 조작 칸의 지역 상태(안내 글·올가미 연출)와 조작 함수.
 * 조건이 안 맞는 조작은 이유를 글로 알리고 Action을 보내지 않는다.
 * [묶기]는 올가미 연출(400ms) 뒤에 Action을 보낸다. 움직임 줄이기를 켜면 바로 보낸다.
 */
import { useEffect, useRef, useState } from 'react';
import { E14_MODE_STRINGS } from '../strings-modes.ko';
import { canBundle, reduceTimeCalc } from './reduce';
import type { TimeCalcAction, TimeCalcState } from './types';

const S = E14_MODE_STRINGS.timeCalc;

/** 묶기 올가미 연출 시간(ms). */
export const LASSO_MS = 400;

export interface TimeCalcUi {
  readonly message: string | null;
  readonly lasso: boolean;
  readonly send: (action: TimeCalcAction) => boolean;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function rejection(state: TimeCalcState, action: TimeCalcAction): string {
  const text = S.rejected;
  switch (action.type) {
    case 'bundle':
      return text.bundle;
    case 'unbundle':
      return state.big < 1 ? text.unbundleNone : text.unbundleFull;
    case 'take-away':
      if (state.op !== 'sub') return text.notSub;
      return state.tookAway ? text.tookAway : text.takeAway;
    default:
      return text.same;
  }
}

export function useTimeCalcUi(
  state: TimeCalcState,
  dispatch: (action: TimeCalcAction) => void,
  readOnly: boolean,
): TimeCalcUi {
  const [message, setMessage] = useState<string | null>(null);
  const [lasso, setLasso] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const send = (action: TimeCalcAction): boolean => {
    if (readOnly || lasso) return false;
    if (reduceTimeCalc(state, action) === state) {
      if (action.type !== 'reset') setMessage(rejection(state, action));
      return false;
    }
    setMessage(null);
    if (action.type === 'bundle' && canBundle(state) && !prefersReducedMotion()) {
      setLasso(true);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setLasso(false);
        dispatch(action);
      }, LASSO_MS);
      return true;
    }
    dispatch(action);
    return true;
  };

  return { message, lasso, send };
}
