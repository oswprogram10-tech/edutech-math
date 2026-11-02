/**
 * 화면 픽셀 → 엔진 논리 좌표 변환.
 * 엔진 상태에는 픽셀을 저장하지 않는다(결정 3). 기기·scale이 달라도 상태가 같아야 한다.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface LogicalSize {
  readonly width: number;
  readonly height: number;
}

export interface RectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** DOMRect(또는 같은 모양)를 논리 좌표계로 옮긴다. */
export function clientToLogical(
  clientX: number,
  clientY: number,
  rect: RectLike,
  logical: LogicalSize,
): Point {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp(((clientX - rect.left) / rect.width) * logical.width, 0, logical.width),
    y: clamp(((clientY - rect.top) / rect.height) * logical.height, 0, logical.height),
  };
}

/** PointerEvent를 논리 좌표로 바꾼다. element가 없으면 0,0. */
export function pointerToLogical(
  event: { readonly clientX: number; readonly clientY: number },
  element: Element | null,
  logical: LogicalSize,
): Point {
  if (!element) return { x: 0, y: 0 };
  return clientToLogical(event.clientX, event.clientY, element.getBoundingClientRect(), logical);
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
