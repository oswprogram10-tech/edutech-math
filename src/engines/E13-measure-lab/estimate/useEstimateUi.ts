/**
 * E13 estimate 조작 칸의 지역 상태(안내 글·어림 입력 중인 수)와 조작 함수.
 * 끌기 도중 좌표는 지역 상태에만 두고 Action에는 최종 눈금만 싣는다.
 */
import { useState } from 'react';
import { Rational } from '../../../core/math';
import { E13_STRINGS as S } from '../strings.ko';
import { reduceEstimate } from './reduce';
import { offsetOf, snapRulerOffset } from './settings';
import type { EstimateAction, EstimateState } from './types';

export interface EstimateUi {
  readonly message: string | null;
  /** 키패드로 넣는 중인 어림(문자열, 최대 두 자리). */
  readonly draft: string;
  readonly send: (action: EstimateAction) => boolean;
  readonly addDigit: (digit: number) => void;
  readonly eraseDigit: () => void;
  readonly submit: () => void;
  /** 자를 끌어 놓았을 때: raw는 자 눈금으로 환산한 물건 왼쪽 끝(그림용 number). 자석이 붙는다. */
  readonly dropRuler: (rawOffset: number) => void;
  /** 방향키: delta cm만큼 자 눈금을 바꾼다(자석 없음). */
  readonly nudge: (deltaCm: number) => void;
}

function rejection(state: EstimateState, action: EstimateAction): string {
  const text = S.estimate.rejected;
  if (action.type === 'estimate') return state.estimateLocked ? text.locked : text.badEstimate;
  if (action.type === 'move-ruler') {
    if (!state.draggable) return text.fixed;
    if (state.estimateFirst && !state.estimateLocked) return text.first;
    return text.out;
  }
  return text.same;
}

export function useEstimateUi(
  state: EstimateState,
  dispatch: (action: EstimateAction) => void,
  readOnly: boolean,
): EstimateUi {
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const send = (action: EstimateAction): boolean => {
    if (readOnly) return false;
    if (reduceEstimate(state, action) === state) {
      setMessage(rejection(state, action));
      return false;
    }
    setMessage(null);
    dispatch(action);
    return true;
  };

  return {
    message,
    draft,
    send,
    addDigit: (digit) => {
      if (readOnly || state.estimateLocked) return;
      setDraft((current) => {
        const next = current + String(digit);
        if (next.length > 2 || /^0/.test(next)) return current;
        return next;
      });
    },
    eraseDigit: () => {
      if (readOnly || state.estimateLocked) return;
      setDraft((current) => current.slice(0, -1));
    },
    submit: () => {
      const value = Number(draft);
      if (draft === '' || !Number.isInteger(value)) {
        if (!readOnly) setMessage(S.estimate.rejected.badEstimate);
        return;
      }
      if (send({ type: 'estimate', value })) setDraft('');
    },
    dropRuler: (rawOffset) => {
      const next = snapRulerOffset(rawOffset);
      if (next.equals(offsetOf(state))) return;
      send({ type: 'move-ruler', offsetCm: next.toString() });
    },
    nudge: (deltaCm) => {
      const next = offsetOf(state).add(Rational.of(Math.round(deltaCm * 2), 2));
      send({ type: 'move-ruler', offsetCm: next.toString() });
    },
  };
}
