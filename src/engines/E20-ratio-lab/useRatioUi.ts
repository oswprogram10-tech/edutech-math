/** E20 조작 칸의 지역 상태(안내 글)와 키보드 처리. 거절된 조작은 이유를 글로 알린다. */
import { useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { cleanExpr, cleanInteger } from './bar';
import { racersComplete } from './observe';
import { reduce } from './reduce';
import { shortcutsOf } from './shortcuts';
import { E20_STRINGS as S } from './strings.ko';
import type { RatioAction, RatioState } from './types';

export interface RatioUi {
  readonly message: string | null;
  readonly send: (action: RatioAction) => void;
  /** rate: 입력 칸에서 글자를 받아 검사한 뒤 `set`을 보낸다. 잘못된 글은 안내만 하고 칸에 남긴다. */
  readonly draft: (racerId: string, field: 'distance' | 'time') => string | null;
  readonly typeValue: (racerId: string, field: 'distance' | 'time', text: string) => void;
  readonly clearDraft: (racerId: string, field: 'distance' | 'time') => void;
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

function rejection(state: RatioState, action: RatioAction): string {
  if (state.mode === 'rate') {
    const text = S.rate.rejected;
    if (action.type === 'set') {
      const racer = state.racers.find((r) => r.id === action.racerId);
      const editable = action.field === 'distance' ? racer?.editDistance : racer?.editTime;
      if (!editable) return text.locked;
      if (racer?.[action.field] === action.value) return '';
      return action.field === 'distance'
        ? text.distanceRange(state.settings.maxDistance)
        : text.timeRange(state.settings.maxTime);
    }
    if (action.type === 'predict') {
      return state.prediction !== null ? text.predicted : text.needValues;
    }
    if (action.type === 'run') {
      return racersComplete(state.racers) ? text.needPrediction : text.needValues;
    }
    return '';
  }
  if (state.mode === 'bar-model') {
    const text = S.bar.rejected;
    if (action.type === 'set-expr') {
      if (state.settings.look !== 'symbols') return text.locked;
      return cleanExpr(action.value) === undefined ? text.notExpr : '';
    }
    if (action.type === 'set-unit' || action.type === 'set-part' || action.type === 'set-total') {
      if (cleanInteger(action.value) === undefined) return text.notNumber;
      const locked =
        (action.type === 'set-unit' && state.settings.look === 'symbols') ||
        (action.type === 'set-part' && state.settings.known?.part === action.index) ||
        (action.type === 'set-total' && state.settings.total !== null);
      return locked ? text.locked : '';
    }
    return '';
  }
  if (state.mode === 'percent') {
    return action.type === 'reset' ? '' : S.percent.rejected.locked;
  }
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
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});

  const send = (action: RatioAction) => {
    if (readOnly) return;
    if (action.type === 'reset') setDrafts({});
    if (reduce(state, action) === state) {
      const text = rejection(state, action);
      setMessage(text === '' ? null : text);
      return;
    }
    setMessage(null);
    dispatch(action);
  };

  const draftKey = (racerId: string, field: string) => `${racerId}.${field}`;
  const clearDraft = (racerId: string, field: 'distance' | 'time') => {
    setDrafts((current) => {
      const key = draftKey(racerId, field);
      return Object.fromEntries(Object.entries(current).filter(([k]) => k !== key));
    });
  };
  const typeValue = (racerId: string, field: 'distance' | 'time', text: string) => {
    if (readOnly) return;
    setDrafts((current) => ({ ...current, [draftKey(racerId, field)]: text }));
    if (text === '') {
      setMessage(null);
      return;
    }
    if (!/^[0-9]{1,6}$/.test(text)) {
      setMessage(S.rate.rejected.notNumber);
      return;
    }
    send({ type: 'set', racerId, field, value: Number(text) });
  };
  const draft = (racerId: string, field: 'distance' | 'time') =>
    drafts[draftKey(racerId, field)] ?? null;

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    // 입력 칸에 글을 쓰는 중에는 단축키(숫자·R·G)를 쓰지 않는다.
    const target = event.target;
    if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.isContentEditable)) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const hit = shortcutsOf(state).find((s) => s.code === event.code);
    if (!hit) return;
    event.preventDefault();
    send(hit.action);
  };

  return { message, send, draft, typeValue, clearDraft, onKeyDown };
}
