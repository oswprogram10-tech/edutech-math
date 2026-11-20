/**
 * E19 조작 칸의 지역 상태(안내 글·기둥 고르기·예측 칸)와 키보드 처리.
 * 거절된 조작은 이유를 글로 알린다. 끌기 도중 좌표는 판 컴포넌트의 지역 상태에만 둔다.
 */
import { useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Rational } from '../../core/math';
import { reduce } from './reduce';
import { parseRational } from './settings';
import { E19_STRINGS as S } from './strings.ko';
import type { ChanceAction, ChanceState } from './types';

export const DRAFT_MAX = 14;

export interface ChanceUi {
  readonly message: string | null;
  readonly send: (action: ChanceAction) => boolean;
  /** leveling: 키보드로 고른 기둥, 집은 기둥. */
  readonly cursor: number;
  readonly holding: number | null;
  readonly moveCursor: (delta: -1 | 1) => void;
  readonly pickOrPlace: () => void;
  readonly cancelHold: () => void;
  /** seesaw·outlier: 한 칸씩 움직이기. */
  readonly nudgeFulcrum: (delta: -1 | 1) => void;
  readonly nudgeValue: (delta: -1 | 1) => void;
  /** outlier: 예측 칸. */
  readonly draft: string;
  readonly typeDraft: (text: string) => void;
  readonly backspaceDraft: () => void;
  readonly submitPrediction: () => void;
  readonly tell: (text: string | null) => void;
  readonly onWrapKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

function rejection(state: ChanceState, action: ChanceAction): string {
  if (state.mode === 'leveling') {
    if (action.type !== 'move') return '';
    if (action.from === action.to) return S.leveling.rejected.same;
    return (state.heights[action.from] ?? 0) <= 0
      ? S.leveling.rejected.empty
      : S.leveling.rejected.full;
  }
  if (state.mode === 'seesaw') {
    return action.type === 'set-fulcrum' ? S.seesaw.rejected.edge : '';
  }
  if (action.type === 'set-value') {
    return state.requirePrediction && state.prediction === null
      ? S.outlier.rejected.locked
      : S.outlier.rejected.range;
  }
  if (action.type === 'predict') return S.outlier.rejected.outOfRange;
  return '';
}

function waitingForPrediction(state: ChanceState): boolean {
  return state.mode === 'outlier' && state.requirePrediction && state.prediction === null;
}

export function useChanceUi(
  state: ChanceState,
  dispatch: (action: ChanceAction) => void,
  readOnly: boolean,
): ChanceUi {
  const [message, setMessage] = useState<string | null>(null);
  const [cursorRaw, setCursor] = useState(0);
  const [holding, setHolding] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  const count = state.mode === 'leveling' ? state.heights.length : 1;
  const cursor = Math.min(cursorRaw, count - 1);

  const send = (action: ChanceAction): boolean => {
    if (readOnly || state.error !== null) return false;
    if (reduce(state, action) === state) {
      const text = rejection(state, action);
      setMessage(text === '' ? null : text);
      return false;
    }
    setMessage(null);
    dispatch(action);
    return true;
  };

  const moveCursor = (delta: -1 | 1) => {
    if (state.mode !== 'leveling') return;
    const next = Math.max(0, Math.min(count - 1, cursor + delta));
    setCursor(next);
    const name = state.names[next] ?? '';
    setMessage(holding === null ? S.leveling.cursorText(name) : S.leveling.holdingText(name));
  };

  const cancelHold = () => {
    setHolding(null);
    setMessage(null);
  };

  const pickOrPlace = () => {
    if (state.mode !== 'leveling' || readOnly) return;
    if (holding === null) {
      if ((state.heights[cursor] ?? 0) <= 0) {
        setMessage(S.leveling.rejected.empty);
        return;
      }
      setHolding(cursor);
      setMessage(S.leveling.holdingText(state.names[cursor] ?? ''));
      return;
    }
    if (send({ type: 'move', from: holding, to: cursor })) setHolding(null);
  };

  const nudgeFulcrum = (delta: -1 | 1) => {
    if (state.mode !== 'seesaw') return;
    const step = Rational.parse(state.step);
    const next = Rational.parse(state.fulcrum).add(delta === 1 ? step : step.neg());
    send({ type: 'set-fulcrum', value: next.toString() });
  };

  const nudgeValue = (delta: -1 | 1) => {
    if (state.mode !== 'outlier') return;
    send({ type: 'set-value', value: (state.values[state.dragIndex] ?? 0) + delta });
  };

  const typeDraft = (text: string) => {
    if (readOnly) return;
    setMessage(null);
    setDraft((current) => (current.length >= DRAFT_MAX ? current : current + text));
  };
  const backspaceDraft = () => {
    setMessage(null);
    setDraft((current) => current.slice(0, -1));
  };

  const submitPrediction = () => {
    if (state.mode !== 'outlier' || readOnly) return;
    const value = parseRational(draft);
    if (value === null) {
      setMessage(S.outlier.rejected.bad);
      return;
    }
    if (send({ type: 'predict', value: draft.trim() })) setDraft('');
  };

  const onWrapKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!waitingForPrediction(state)) return;
    const onButton = event.target instanceof HTMLElement && event.target.tagName === 'BUTTON';
    if (/^[0-9./]$/.test(event.key)) {
      event.preventDefault();
      typeDraft(event.key);
    } else if (event.key === ' ' && !onButton) {
      event.preventDefault();
      typeDraft(' ');
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      backspaceDraft();
    } else if (event.key === 'Enter' && !onButton) {
      event.preventDefault();
      submitPrediction();
    }
  };

  return {
    message,
    send,
    cursor,
    holding,
    moveCursor,
    pickOrPlace,
    cancelHold,
    nudgeFulcrum,
    nudgeValue,
    draft,
    typeDraft,
    backspaceDraft,
    submitPrediction,
    tell: setMessage,
    onWrapKeyDown,
  };
}
