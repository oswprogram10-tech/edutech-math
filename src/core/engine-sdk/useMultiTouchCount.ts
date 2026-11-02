/**
 * 동시에 눌린 손가락(pointerId) 수를 센다.
 * E02 `summon` 모드처럼 "누른 손가락 수만큼 셈돌 생성"에 쓴다.
 * 크롬북·전자칠판은 동시 터치가 불안정하므로 엔진은 반드시 버튼 대체 입력도 제공한다.
 */
import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface UseMultiTouchCountResult {
  readonly count: number;
  readonly maxCount: number;
  readonly reset: () => void;
  readonly handlers: {
    readonly onPointerDown: (event: ReactPointerEvent<Element>) => void;
    readonly onPointerUp: (event: ReactPointerEvent<Element>) => void;
    readonly onPointerCancel: (event: ReactPointerEvent<Element>) => void;
  };
}

export function useMultiTouchCount(): UseMultiTouchCountResult {
  const pointers = useRef(new Set<number>());
  const [count, setCount] = useState(0);
  const [maxCount, setMaxCount] = useState(0);

  const onPointerDown = useCallback((event: ReactPointerEvent<Element>) => {
    pointers.current.add(event.pointerId);
    const next = pointers.current.size;
    setCount(next);
    setMaxCount((current) => Math.max(current, next));
  }, []);

  const endPointer = useCallback((event: ReactPointerEvent<Element>) => {
    pointers.current.delete(event.pointerId);
    setCount(pointers.current.size);
  }, []);

  const reset = useCallback(() => {
    pointers.current.clear();
    setCount(0);
    setMaxCount(0);
  }, []);

  return {
    count,
    maxCount,
    reset,
    handlers: { onPointerDown, onPointerUp: endPointer, onPointerCancel: endPointer },
  };
}
