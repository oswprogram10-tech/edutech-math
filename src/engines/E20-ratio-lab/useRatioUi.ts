/** E20 조작 칸의 지역 상태(안내 글)와 키보드 처리. 거절된 조작은 이유를 글로 알린다. */
import { useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { reduce } from './reduce';
import { shortcutsOf } from './shortcuts';
import { E20_STRINGS as S } from './strings.ko';
import type { RatioAction, RatioState } from './types';

export interface RatioUi {
  readonly message: string | null;
  readonly send: (action: RatioAction) => void;
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

function rejection(state: RatioState, action: RatioAction): string {
  if (state.mode === 'mix') {
    if (action.type === 'add') return S.mix.rejected.full;
    if (action.type === 'remove') return S.mix.rejected.empty;
    if (action.type === 'scale') {
      return state.cup.milk + state.cup.syrup === 0
        ? S.mix.rejected.scaleEmpty
        : S.mix.rejected.scaleFull;
    }
    return '';
  }
  if (action.type === 'save') {
    return state.saved.length >= 8 ? S.resize.rejected.savedFull : S.resize.rejected.saved;
  }
  if (action.type === 'step' && action.delta === -1) return S.resize.rejected.min;
  if (action.type === 'step' || action.type === 'add-both' || action.type === 'scale') {
    return S.resize.rejected.max;
  }
  return '';
}

export function useRatioUi(
  state: RatioState,
  dispatch: (action: RatioAction) => void,
  readOnly: boolean,
): RatioUi {
  const [message, setMessage] = useState<string | null>(null);

  const send = (action: RatioAction) => {
    if (readOnly) return;
    if (reduce(state, action) === state) {
      const text = rejection(state, action);
      setMessage(text === '' ? null : text);
      return;
    }
    setMessage(null);
    dispatch(action);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const hit = shortcutsOf(state).find((s) => s.code === event.code);
    if (!hit) return;
    event.preventDefault();
    send(hit.action);
  };

  return { message, send, onKeyDown };
}
