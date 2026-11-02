/**
 * 확대/축소(핀치) 제스처.
 * (1) 두 손가락 포인터 (2) Ctrl+휠 (3) 화면 +/- 버튼 세 가지를 모두 지원한다(결정 10).
 */
import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { Point } from './coordinates';
import { clamp, distance } from './coordinates';

export interface UsePinchOptions {
  initialScale?: number;
  min?: number;
  max?: number;
  /** 버튼·휠·핀치에서 한 번에 바뀌는 크기 */
  step?: number;
  onChange?: (scale: number) => void;
}

export interface UsePinchResult {
  readonly scale: number;
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly handlers: {
    readonly onPointerDown: (event: ReactPointerEvent<Element>) => void;
    readonly onPointerMove: (event: ReactPointerEvent<Element>) => void;
    readonly onPointerUp: (event: ReactPointerEvent<Element>) => void;
    readonly onPointerCancel: (event: ReactPointerEvent<Element>) => void;
    readonly onWheel: (event: ReactWheelEvent<Element>) => void;
  };
}

export function clampScale(value: number, min: number, max: number): number {
  return clamp(value, Math.min(min, max), Math.max(min, max));
}

/** 두 손가락 사이 거리 비율로 새 배율을 구한다. */
export function pinchScale(
  startDistance: number,
  currentDistance: number,
  startScale: number,
): number {
  if (startDistance <= 0) return startScale;
  return startScale * (currentDistance / startDistance);
}

export function pinchDistance(a: Point, b: Point): number {
  return distance(a, b);
}

function firstTwo(pointers: Map<number, Point>): [Point, Point] | null {
  const values = [...pointers.values()];
  const a = values[0];
  const b = values[1];
  return a && b ? [a, b] : null;
}

export function usePinch(options: UsePinchOptions = {}): UsePinchResult {
  const { initialScale = 1, min = 1, max = 3, step = 0.25, onChange } = options;
  const [scale, setScale] = useState(() => clampScale(initialScale, min, max));
  const scaleRef = useRef(scale);
  const pointers = useRef(new Map<number, Point>());
  const session = useRef<{ distance: number; scale: number } | null>(null);

  const applyScale = useCallback(
    (next: number) => {
      const clamped = clampScale(next, min, max);
      if (clamped === scaleRef.current) return clamped;
      scaleRef.current = clamped;
      setScale(clamped);
      onChange?.(clamped);
      return clamped;
    },
    [min, max, onChange],
  );

  const zoomIn = useCallback(() => {
    applyScale(scaleRef.current + step);
  }, [applyScale, step]);

  const zoomOut = useCallback(() => {
    applyScale(scaleRef.current - step);
  }, [applyScale, step]);

  const onPointerDown = useCallback((event: ReactPointerEvent<Element>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pair = firstTwo(pointers.current);
    session.current = pair
      ? { distance: distance(pair[0], pair[1]), scale: scaleRef.current }
      : null;
  }, []);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pair = firstTwo(pointers.current);
      if (!pair || !session.current) return;
      const currentDistance = distance(pair[0], pair[1]);
      applyScale(pinchScale(session.current.distance, currentDistance, session.current.scale));
    },
    [applyScale],
  );

  const endPointer = useCallback((event: ReactPointerEvent<Element>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) session.current = null;
  }, []);

  const onWheel = useCallback(
    (event: ReactWheelEvent<Element>) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      applyScale(scaleRef.current + (event.deltaY < 0 ? step : -step));
    },
    [applyScale, step],
  );

  return {
    scale,
    canZoomIn: scale < max,
    canZoomOut: scale > min,
    zoomIn,
    zoomOut,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onWheel,
    },
  };
}
