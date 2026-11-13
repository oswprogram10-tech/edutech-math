/**
 * E12 2D·3D 공용 포인터 누르기/길게 누르기 훅.
 *
 * - 8px 넘게 움직이지 않고 떼면 짧은 누르기(`onTap`)
 * - 600ms 넘게 누르고 있으면 길게 누르기(`onLongPress`), 뗄 때는 아무것도 보내지 않는다
 * - `mouse`는 왼쪽 버튼(button === 0)만 반응한다(오른쪽 궤도 회전과 분리)
 * - `cancel()`을 부르면 두 손가락 터치 등에서 진행 중인 누르기를 즉시 취소한다
 */
import { useCallback, useEffect, useRef } from 'react';

export const LONG_PRESS_MS = 600;
export const MOVE_THRESHOLD_PX = 8;

export interface PressPointerLike {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly button: number;
  readonly clientX: number;
  readonly clientY: number;
}

interface PressSession {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly startX: number;
  readonly startY: number;
  timerId: number | null;
  longPressed: boolean;
  moved: boolean;
}

export interface UsePressGestureOptions {
  readonly disabled: boolean;
  readonly onTap: (x: number, y: number) => void;
  readonly onLongPress: (x: number, y: number) => void;
}

export interface PressGestureHandlers {
  readonly onPointerDown: (event: PressPointerLike, x: number, y: number) => void;
  readonly onPointerMove: (event: PressPointerLike) => void;
  readonly onPointerUp: (event: PressPointerLike, x: number, y: number) => void;
  readonly onPointerCancel: (event: PressPointerLike) => void;
  readonly cancel: () => void;
}

export function usePressGesture({
  disabled,
  onTap,
  onLongPress,
}: UsePressGestureOptions): PressGestureHandlers {
  const sessionRef = useRef<PressSession | null>(null);
  const onTapRef = useRef(onTap);
  const onLongPressRef = useRef(onLongPress);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onTapRef.current = onTap;
  }, [onTap]);

  useEffect(() => {
    onLongPressRef.current = onLongPress;
  }, [onLongPress]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const clearTimer = useCallback((session: PressSession | null) => {
    if (session && session.timerId !== null) {
      window.clearTimeout(session.timerId);
      session.timerId = null;
    }
  }, []);

  const cancel = useCallback(() => {
    clearTimer(sessionRef.current);
    sessionRef.current = null;
  }, [clearTimer]);

  const handleMove = useCallback(
    (event: PressPointerLike) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== event.pointerId || session.longPressed) return;
      if (
        Math.hypot(event.clientX - session.startX, event.clientY - session.startY) >
        MOVE_THRESHOLD_PX
      ) {
        session.moved = true;
        clearTimer(session);
      }
    },
    [clearTimer],
  );

  const resolveUp = useCallback(
    (event: PressPointerLike, tapX: number, tapY: number) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      clearTimer(session);
      sessionRef.current = null;
      if (disabledRef.current || session.longPressed || session.moved) return;
      if (
        Math.hypot(event.clientX - session.startX, event.clientY - session.startY) >
        MOVE_THRESHOLD_PX
      ) {
        return;
      }
      onTapRef.current(tapX, tapY);
    },
    [clearTimer],
  );

  const handleCancel = useCallback(
    (event: PressPointerLike) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      clearTimer(session);
      sessionRef.current = null;
    },
    [clearTimer],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onWinMove = (event: PointerEvent) => handleMove(event);
    const onWinUp = (event: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      resolveUp(event, session.x, session.y);
    };
    const onWinCancel = (event: PointerEvent) => handleCancel(event);

    window.addEventListener('pointermove', onWinMove);
    window.addEventListener('pointerup', onWinUp);
    window.addEventListener('pointercancel', onWinCancel);
    return () => {
      window.removeEventListener('pointermove', onWinMove);
      window.removeEventListener('pointerup', onWinUp);
      window.removeEventListener('pointercancel', onWinCancel);
      clearTimer(sessionRef.current);
      sessionRef.current = null;
    };
  }, [handleMove, resolveUp, handleCancel, clearTimer]);

  const onPointerDown = useCallback(
    (event: PressPointerLike, x: number, y: number) => {
      if (disabledRef.current) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      clearTimer(sessionRef.current);

      const session: PressSession = {
        pointerId: event.pointerId,
        x,
        y,
        startX: event.clientX,
        startY: event.clientY,
        timerId: null,
        longPressed: false,
        moved: false,
      };

      session.timerId = window.setTimeout(() => {
        if (sessionRef.current !== session) return;
        session.longPressed = true;
        session.timerId = null;
        onLongPressRef.current(x, y);
      }, LONG_PRESS_MS);

      sessionRef.current = session;
    },
    [clearTimer],
  );

  const onPointerUp = useCallback(
    (event: PressPointerLike, x: number, y: number) => {
      resolveUp(event, x, y);
    },
    [resolveUp],
  );

  return {
    onPointerDown,
    onPointerMove: handleMove,
    onPointerUp,
    onPointerCancel: handleCancel,
    cancel,
  };
}
