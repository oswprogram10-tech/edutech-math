/**
 * 올가미(자유 폐곡선) 제스처.
 *
 * path는 그리는 동안 미리보기로만 쓰고, 손을 뗄 때 `onGesture`로 점 목록을 넘긴다.
 * 호출하는 쪽은 `selectInside`로 객체를 고른 뒤 ID만 Action에 담는다.
 */
import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from './coordinates';
import { distance } from './coordinates';
import { isTapGesture } from './lasso';

export interface LassoGesture {
  readonly points: readonly Point[];
  /** 거의 움직이지 않은 탭. 올가미 대신 '셈돌 놓기'로 처리한다. */
  readonly isTap: boolean;
}

export interface UseLassoOptions {
  getPoint(event: { readonly clientX: number; readonly clientY: number }): Point;
  onGesture: (gesture: LassoGesture) => void;
  disabled?: boolean;
  /** 탭으로 볼 최대 이동 거리(논리 좌표) */
  tapThreshold?: number;
  /** 이 거리보다 가까운 점은 버린다(점이 너무 촘촘해지지 않게). */
  minStep?: number;
}

export interface UseLassoResult {
  readonly active: boolean;
  readonly path: readonly Point[];
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
    // jsdom 등 캡처를 지원하지 않는 환경.
  }
}

function release(element: Element, pointerId: number): void {
  try {
    element.releasePointerCapture?.(pointerId);
  } catch {
    // 위와 같다.
  }
}

export function useLasso(options: UseLassoOptions): UseLassoResult {
  const { getPoint, onGesture, disabled = false, tapThreshold = 16, minStep = 3 } = options;
  const [active, setActive] = useState(false);
  const [path, setPath] = useState<readonly Point[]>([]);
  const pathRef = useRef<Point[]>([]);
  const pointerId = useRef<number | null>(null);

  const clear = useCallback(() => {
    pointerId.current = null;
    pathRef.current = [];
    setActive(false);
    setPath([]);
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (disabled || event.isPrimary === false || event.button !== 0) return;
      const point = getPoint(event);
      pointerId.current = event.pointerId;
      pathRef.current = [point];
      setActive(true);
      setPath([point]);
      capture(event.currentTarget, event.pointerId);
    },
    [disabled, getPoint],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (pointerId.current !== event.pointerId) return;
      const point = getPoint(event);
      const last = pathRef.current[pathRef.current.length - 1];
      if (last && distance(last, point) < minStep) return;
      pathRef.current = [...pathRef.current, point];
      setPath(pathRef.current);
    },
    [getPoint, minStep],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (pointerId.current !== event.pointerId) return;
      const point = getPoint(event);
      const points = [...pathRef.current, point];
      const isTap = isTapGesture(points, tapThreshold);
      release(event.currentTarget, event.pointerId);
      clear();
      onGesture({ points: isTap ? [point] : points, isTap });
    },
    [clear, getPoint, onGesture, tapThreshold],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (pointerId.current !== event.pointerId) return;
      release(event.currentTarget, event.pointerId);
      clear();
    },
    [clear],
  );

  return {
    active,
    path,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
