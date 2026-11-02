/**
 * Pointer Events 기반 드래그.
 *
 * 드래그 중 좌표는 로컬 UI 상태에만 두고, 손을 뗄 때 `onEnd`에서 Action 한 번만 보낸다.
 * (AGENTS 규칙 9: 화면 좌표 궤적을 저장하지 않는다)
 */
import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from './coordinates';

export interface DragInfo {
  readonly pointerId: number;
  readonly start: Point;
  readonly current: Point;
  readonly delta: Point;
}

export interface UseDragOptions {
  getPoint(event: { readonly clientX: number; readonly clientY: number }): Point;
  onStart?: (info: DragInfo) => void;
  onMove?: (info: DragInfo) => void;
  onEnd?: (info: DragInfo) => void;
  onCancel?: (info: DragInfo) => void;
  disabled?: boolean;
}

export interface UseDragResult {
  readonly dragging: boolean;
  readonly start: Point | null;
  readonly current: Point | null;
  readonly handlers: {
    readonly onPointerDown: (event: ReactPointerEvent<Element>) => void;
    readonly onPointerMove: (event: ReactPointerEvent<Element>) => void;
    readonly onPointerUp: (event: ReactPointerEvent<Element>) => void;
    readonly onPointerCancel: (event: ReactPointerEvent<Element>) => void;
  };
}

function capture(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture?.(pointerId);
  } catch {
    // 포인터가 이미 끝났거나 jsdom처럼 캡처를 지원하지 않는 환경.
  }
}

function release(element: Element, pointerId: number): void {
  try {
    element.releasePointerCapture?.(pointerId);
  } catch {
    // 위와 같다.
  }
}

function infoOf(pointerId: number, start: Point, current: Point): DragInfo {
  return {
    pointerId,
    start,
    current,
    delta: { x: current.x - start.x, y: current.y - start.y },
  };
}

export function useDrag(options: UseDragOptions): UseDragResult {
  const { getPoint, onStart, onMove, onEnd, onCancel, disabled = false } = options;
  const pointerId = useRef<number | null>(null);
  const startPoint = useRef<Point | null>(null);
  const currentPoint = useRef<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);

  const reset = useCallback(() => {
    pointerId.current = null;
    startPoint.current = null;
    currentPoint.current = null;
    setDragging(false);
    setStart(null);
    setCurrent(null);
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (disabled || event.isPrimary === false || event.button !== 0) return;
      const point = getPoint(event);
      pointerId.current = event.pointerId;
      startPoint.current = point;
      currentPoint.current = point;
      setDragging(true);
      setStart(point);
      setCurrent(point);
      capture(event.currentTarget, event.pointerId);
      onStart?.(infoOf(event.pointerId, point, point));
    },
    [disabled, getPoint, onStart],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (!dragging || pointerId.current !== event.pointerId || !startPoint.current) return;
      const point = getPoint(event);
      const previous = currentPoint.current;
      if (previous && previous.x === point.x && previous.y === point.y) return;
      currentPoint.current = point;
      setCurrent(point);
      onMove?.(infoOf(event.pointerId, startPoint.current, point));
    },
    [dragging, getPoint, onMove],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (pointerId.current !== event.pointerId || !startPoint.current) return;
      const point = getPoint(event);
      const info = infoOf(event.pointerId, startPoint.current, point);
      release(event.currentTarget, event.pointerId);
      reset();
      onEnd?.(info);
    },
    [getPoint, onEnd, reset],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (pointerId.current !== event.pointerId || !startPoint.current) return;
      const point = currentPoint.current ?? startPoint.current;
      const info = infoOf(event.pointerId, startPoint.current, point);
      release(event.currentTarget, event.pointerId);
      reset();
      onCancel?.(info);
    },
    [onCancel, reset],
  );

  return {
    dragging,
    start,
    current,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
