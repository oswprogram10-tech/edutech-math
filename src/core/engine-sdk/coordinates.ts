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

/**
 * DOMRect(또는 같은 모양)를 논리 좌표계로 옮긴다.
 * SVG의 preserveAspectRatio 기본값(xMidYMid meet)처럼, 상자와 논리 크기의 비율이 다르면
 * 작은 쪽 배율로 줄이고 가운데에 놓인 그림을 기준으로 바꾼다. 남는 여백을 누르면 가장자리로 자른다.
 */
export function clientToLogical(
  clientX: number,
  clientY: number,
  rect: RectLike,
  logical: LogicalSize,
): Point {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  const scale = Math.min(rect.width / logical.width, rect.height / logical.height);
  const offsetX = (rect.width - logical.width * scale) / 2;
  const offsetY = (rect.height - logical.height * scale) / 2;
  return {
    x: clamp((clientX - rect.left - offsetX) / scale, 0, logical.width),
    y: clamp((clientY - rect.top - offsetY) / scale, 0, logical.height),
  };
}

interface ScreenMatrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

function screenMatrixOf(element: Element): ScreenMatrix | null {
  const candidate = element as Element & { getScreenCTM?: () => ScreenMatrix | null };
  if (typeof candidate.getScreenCTM !== 'function') return null;
  return candidate.getScreenCTM();
}

/**
 * PointerEvent를 논리 좌표로 바꾼다. element가 없으면 0,0.
 * SVG면 브라우저가 실제로 그린 변환(viewBox·여백·테두리 포함)을 거꾸로 적용한다.
 */
export function pointerToLogical(
  event: { readonly clientX: number; readonly clientY: number },
  element: Element | null,
  logical: LogicalSize,
): Point {
  if (!element) return { x: 0, y: 0 };
  const m = screenMatrixOf(element);
  const det = m ? m.a * m.d - m.b * m.c : 0;
  if (!m || det === 0) {
    return clientToLogical(event.clientX, event.clientY, element.getBoundingClientRect(), logical);
  }
  const dx = event.clientX - m.e;
  const dy = event.clientY - m.f;
  return {
    x: clamp((m.d * dx - m.c * dy) / det, 0, logical.width),
    y: clamp((m.a * dy - m.b * dx) / det, 0, logical.height),
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
