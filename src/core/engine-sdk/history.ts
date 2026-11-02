/**
 * 되돌리기/다시하기(Action 스택).
 *
 * 엔진의 reduce는 되돌리기를 몰라도 된다. 러너가 상태 스냅숏을 쌓고
 * Ctrl+Z/Ctrl+Y로 present만 갈아 끼운다. 스냅숏은 JSON 직렬화 가능한 상태다.
 */
import { useCallback, useState } from 'react';

export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
  /** 보관할 과거 스냅숏 최대 개수. */
  readonly limit: number;
}

export const DEFAULT_HISTORY_LIMIT = 100;

export function createHistory<T>(initial: T, limit = DEFAULT_HISTORY_LIMIT): History<T> {
  return { past: [], present: initial, future: [], limit: Math.max(1, limit) };
}

/** 새 상태를 present로 올리고 future를 비운다. 같은 상태면 그대로 둔다. */
export function pushHistory<T>(history: History<T>, next: T): History<T> {
  if (Object.is(history.present, next)) return history;
  const past = [...history.past, history.present];
  const overflow = past.length - history.limit;
  if (overflow > 0) past.splice(0, overflow);
  return { past, present: next, future: [], limit: history.limit };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

export function undoHistory<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    limit: history.limit,
  };
}

export function redoHistory<T>(history: History<T>): History<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
    limit: history.limit,
  };
}

export interface UseHistoryResult<State, Action> {
  readonly state: State;
  readonly dispatch: (action: Action) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly reset: (state: State) => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/**
 * 엔진 reducer를 감싸 되돌리기/다시하기를 붙인다.
 * `const history = useHistory(definition.reduce, initialState)`처럼 쓴다.
 */
export function useHistory<State, Action>(
  reduce: (state: State, action: Action) => State,
  initial: State,
  limit = DEFAULT_HISTORY_LIMIT,
): UseHistoryResult<State, Action> {
  const [history, setHistory] = useState<History<State>>(() => createHistory(initial, limit));

  const dispatch = useCallback(
    (action: Action) => {
      setHistory((current) => pushHistory(current, reduce(current.present, action)));
    },
    [reduce],
  );
  const undo = useCallback(() => setHistory(undoHistory), []);
  const redo = useCallback(() => setHistory(redoHistory), []);
  const reset = useCallback((state: State) => setHistory(createHistory(state, limit)), [limit]);

  return {
    state: history.present,
    dispatch,
    undo,
    redo,
    reset,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  };
}
