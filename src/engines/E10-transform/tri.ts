/**
 * E10 삼각 격자. 격자점은 축 좌표 `(a, b)` 정수이고 화면 위치는
 * `a·e1 + b·e2`(`e1 = (1, 0)`, `e2 = (1/2, √3/2)`)다. √3은 화면 계산에만 쓴다.
 *
 * 단위 삼각형은 세 배 무게중심 좌표 `(3p+1, 3q+1)`(위로 뾰족한 U) 또는
 * `(3p+2, 3q+2)`(D)로 나타낸다. 모든 변환은 정수 일차식이라 정확하다.
 */
import type { Move, Pt, Side } from './types';
import { assertPt, safeInteger } from './square';

export interface TriFigure {
  readonly outline: readonly Pt[];
  /** 단위 삼각형의 세 배 무게중심 좌표. */
  readonly tris: readonly Pt[];
}

export const TRI_ANGLES: readonly number[] = [60, 120, 180, 240, 300];

export function isTriAngle(value: number): boolean {
  return value === 60 || value === 120 || value === 180 || value === 240 || value === 300;
}

export function triAngle(value: number): number {
  if (!isTriAngle(value)) throw new RangeError('삼각 격자 회전 각은 60°의 배수여야 합니다.');
  return value;
}

function pair(value: Pt, name: string): readonly [number, number] {
  return assertPt(value, name);
}

function cw(a: number, b: number): readonly [number, number] {
  return [-b, a + b];
}

function ccw(a: number, b: number): readonly [number, number] {
  return [a + b, -a];
}

function rotate(
  a: number,
  b: number,
  angle: number,
  direction: 'cw' | 'ccw',
): readonly [number, number] {
  const steps = triAngle(angle) / 60;
  let x = a;
  let y = b;
  for (let index = 0; index < steps; index += 1) {
    const next = direction === 'cw' ? cw(x, y) : ccw(x, y);
    x = next[0];
    y = next[1];
  }
  return [x, y];
}

export function translateTriPoint(point: Pt, dx: number, dy: number): Pt {
  const [a, b] = pair(point, '격자점');
  return [a + safeInteger(dx, 'dx'), b + safeInteger(dy, 'dy')];
}

export function translateTriFigure(figure: TriFigure, dx: number, dy: number): TriFigure {
  const x = safeInteger(dx, 'dx');
  const y = safeInteger(dy, 'dy');
  return {
    outline: figure.outline.map((point) => {
      const [a, b] = pair(point, '격자점');
      return [a + x, b + y];
    }),
    tris: figure.tris.map((cell) => {
      const [a, b] = pair(cell, '삼각형');
      return [a + 3 * x, b + 3 * y];
    }),
  };
}

function boundsOf(figure: TriFigure): { readonly minB: number; readonly maxB: number } {
  if (figure.outline.length === 0) throw new RangeError('도형의 꼭짓점이 없습니다.');
  let minB = Number.POSITIVE_INFINITY;
  let maxB = Number.NEGATIVE_INFINITY;
  for (const point of figure.outline) {
    const [, b] = pair(point, '격자점');
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
  }
  return { minB, maxB };
}

/** 가로 방향 비교값 `2a + b`의 최솟값·최댓값. */
function horizontalBounds(figure: TriFigure): { readonly min: number; readonly max: number } {
  if (figure.outline.length === 0) throw new RangeError('도형의 꼭짓점이 없습니다.');
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of figure.outline) {
    const [a, b] = pair(point, '격자점');
    const value = 2 * a + b;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

/**
 * T104처럼 상자 극단 꼭짓점을 지나는 뒤집기 축을 쓴다. 가로 방향은
 * `2a + b`가 같은 세로선, 세로 방향은 `b`가 같은 가로선이다.
 */
export function flipTriFigure(figure: TriFigure, side: Side): TriFigure {
  const horizontal = horizontalBounds(figure);
  const vertical = boundsOf(figure);
  const line = side === 'right' ? horizontal.max : side === 'left' ? horizontal.min : 0;
  const level = side === 'down' ? vertical.maxB : side === 'up' ? vertical.minB : 0;
  const mapPoint = (point: Pt): Pt => {
    const [a, b] = pair(point, '격자점');
    if (side === 'left' || side === 'right') return [line - a - b, b];
    return [a + b - level, 2 * level - b];
  };
  const mapTri = (cell: Pt): Pt => {
    const [a, b] = pair(cell, '삼각형');
    if (side === 'left' || side === 'right') return [3 * line - a - b, b];
    return [a + b - 3 * level, 6 * level - b];
  };
  return {
    outline: figure.outline.map(mapPoint),
    tris: figure.tris.map(mapTri),
  };
}

export function rotateTriFigure(
  figure: TriFigure,
  center: Pt,
  angle: number,
  direction: 'cw' | 'ccw',
): TriFigure {
  const [ca, cb] = pair(center, '중심');
  return {
    outline: figure.outline.map((point) => {
      const [a, b] = pair(point, '격자점');
      const [x, y] = rotate(a - ca, b - cb, angle, direction);
      return [x + ca, y + cb];
    }),
    tris: figure.tris.map((cell) => {
      const [a, b] = pair(cell, '삼각형');
      const [x, y] = rotate(a - 3 * ca, b - 3 * cb, angle, direction);
      return [x + 3 * ca, y + 3 * cb];
    }),
  };
}

export function applyTriMove(figure: TriFigure, move: Move): TriFigure {
  switch (move.kind) {
    case 'slide':
      return translateTriFigure(figure, move.dx, move.dy);
    case 'flip':
      return flipTriFigure(figure, move.side);
    case 'turn':
      return rotateTriFigure(figure, move.center, move.angle, move.direction);
  }
}

/** 한 변 1, 중심 `(a, b)`인 정육각형의 꼭짓점. */
export function hexagonVertices(a: number, b: number): Pt[] {
  const x = safeInteger(a, 'a');
  const y = safeInteger(b, 'b');
  return [
    [x + 1, y],
    [x, y + 1],
    [x - 1, y + 1],
    [x - 1, y],
    [x, y - 1],
    [x + 1, y - 1],
  ];
}

/** 한 변 1 정육각형을 이루는 단위 삼각형 6개의 세 배 무게중심. */
export function hexagonCells(a: number, b: number): Pt[] {
  const x = safeInteger(a, 'a');
  const y = safeInteger(b, 'b');
  const cx = 3 * x;
  const cy = 3 * y;
  const offsets: readonly Pt[] = [
    [1, 1],
    [-2, 1],
    [1, -2],
    [-1, 2],
    [2, -1],
    [-1, -1],
  ];
  return offsets.map(([dx, dy]) => [cx + dx, cy + dy]);
}

export function hexagonFigure(a: number, b: number): TriFigure {
  return { outline: hexagonVertices(a, b), tris: hexagonCells(a, b) };
}

/** 세 배 무게중심 좌표에서 삼각형 종류와 `(p, q)`를 되돌린다. */
export function decodeTriCell(
  cell: Pt,
): { readonly up: boolean; readonly a: number; readonly b: number } | null {
  const [x, y] = pair(cell, '삼각형');
  const rx = ((x % 3) + 3) % 3;
  const ry = ((y % 3) + 3) % 3;
  if (rx === 1 && ry === 1) return { up: true, a: (x - 1) / 3, b: (y - 1) / 3 };
  if (rx === 2 && ry === 2) return { up: false, a: (x - 2) / 3, b: (y - 2) / 3 };
  return null;
}

/** 세 배 무게중심 좌표를 `U(a,b)`·`D(a,b)`의 키로. */
export function triCellKey(cell: Pt): string {
  const decoded = decodeTriCell(cell);
  if (!decoded) return `${cell[0]},${cell[1]}`;
  return `${decoded.up ? 'U' : 'D'}${decoded.a},${decoded.b}`;
}
