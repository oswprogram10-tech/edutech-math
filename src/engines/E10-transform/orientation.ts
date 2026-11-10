/**
 * E10의 8가지 방향 판정.
 *
 * 두 배 칸 중심에 거는 식은 차례로 `(x,y)`, `(−y,x)`, `(−x,−y)`, `(y,−x)`,
 * `(−x,y)`, `(x,−y)`, `(y,x)`, `(−y,−x)`이다. 모양을 상자 왼쪽 위로 옮긴
 * 뒤 비교하므로 위치가 달라도 같은 방향이면 같은 키가 된다.
 */
import { assertCell, assertPt, safeInteger, sortedCells } from './square';
import type { Cell, Orientation, Pt } from './types';
import { ORIENTATIONS } from './types';

function mapPoint(x: number, y: number, orientation: Orientation): readonly [number, number] {
  switch (orientation) {
    case 'id':
      return [x, y];
    case 'cw90':
      return [-y, x];
    case 'r180':
      return [-x, -y];
    case 'ccw90':
      return [y, -x];
    case 'flip-h':
      return [-x, y];
    case 'flip-v':
      return [x, -y];
    case 'flip-d':
      return [y, x];
    case 'flip-a':
      return [-y, -x];
  }
}

/** 칸을 두 배 좌표 중심으로 옮겨 방향을 건다. */
export function transformCell(cell: Cell, orientation: Orientation): Cell {
  const [i, j] = assertCell(cell);
  const [x, y] = mapPoint(2 * i + 1, 2 * j + 1, orientation);
  const next: Cell = [(x - 1) / 2, (y - 1) / 2];
  if (!Number.isSafeInteger(next[0]) || !Number.isSafeInteger(next[1])) {
    throw new RangeError('방향을 건 칸이 정수 격자에 놓이지 않습니다.');
  }
  return next;
}

/** 점에 방향을 건다. 칸과 같은 선형 변환이다. */
export function transformPoint(point: Pt, orientation: Orientation): Pt {
  const [x, y] = assertPt(point);
  return mapPoint(x, y, orientation);
}

function cellsBounds(cells: readonly Cell[]): { readonly minI: number; readonly minJ: number } {
  let minI = Number.POSITIVE_INFINITY;
  let minJ = Number.POSITIVE_INFINITY;
  for (const cell of cells) {
    const [i, j] = assertCell(cell);
    if (i < minI) minI = i;
    if (j < minJ) minJ = j;
  }
  return { minI, minJ };
}

function pointsBounds(points: readonly Pt[]): { readonly minX: number; readonly minY: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const [x, y] = assertPt(point);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  return { minX, minY };
}

/** 상자 왼쪽 위를 `(0,0)`으로 옮기고 정렬한 칸 목록. */
export function normalizedCells(cells: readonly Cell[]): Cell[] {
  if (cells.length === 0) return [];
  const { minI, minJ } = cellsBounds(cells);
  return sortedCells(cells.map((cell): Cell => [cell[0] - minI, cell[1] - minJ]));
}

/** 상자 왼쪽 위를 `(0,0)`으로 옮기고 정렬한 키 문자열. */
export function normalizeCells(cells: readonly Cell[]): string {
  return normalizedCells(cells)
    .map((cell) => `${cell[0]},${cell[1]}`)
    .join(';');
}

/** 방향을 걸고 상자 왼쪽 위를 `at`에 맞춘다. */
export function orientCells(cells: readonly Cell[], orientation: Orientation, at: Pt): Cell[] {
  const origin = assertPt(at, 'at');
  if (cells.length === 0) return [];
  const transformed = cells.map((cell) => transformCell(cell, orientation));
  const { minI, minJ } = cellsBounds(transformed);
  return sortedCells(
    transformed.map((cell): Cell => [
      cell[0] - minI + safeInteger(origin[0], 'at.x'),
      cell[1] - minJ + safeInteger(origin[1], 'at.y'),
    ]),
  );
}

/** 꼭짓점에 방향을 걸고 상자 왼쪽 위를 `at`에 맞춘다. 이름표 자리를 옮길 때 쓴다. */
export function orientPoints(points: readonly Pt[], orientation: Orientation, at: Pt): Pt[] {
  const origin = assertPt(at, 'at');
  if (points.length === 0) return [];
  const transformed = points.map((point) => transformPoint(point, orientation));
  const { minX, minY } = pointsBounds(transformed);
  return transformed.map((point): Pt => [
    point[0] - minX + safeInteger(origin[0], 'at.x'),
    point[1] - minY + safeInteger(origin[1], 'at.y'),
  ]);
}

/** 8가지 중 `normalizeCells`가 같은 방향. 같은 모양이 아니면 null. */
export function orientationOf(
  startCells: readonly Cell[],
  cells: readonly Cell[],
): Orientation | null {
  if (startCells.length === 0 || cells.length === 0) return null;
  if (startCells.length !== cells.length) return null;
  const target = normalizeCells(cells);
  for (const orientation of ORIENTATIONS) {
    if (normalizeCells(orientCells(startCells, orientation, [0, 0])) === target) {
      return orientation;
    }
  }
  return null;
}

/** 방향에 따라 ㄱ… 이름표가 갈 자리. `at`은 칸 상자의 왼쪽 위다. */
export function labeledPoints(
  startOutline: readonly Pt[],
  startCells: readonly Cell[],
  orientation: Orientation,
): Pt[] {
  if (startCells.length === 0) return [];
  const { minI, minJ } = cellsBounds(startCells);
  return orientPoints(startOutline, orientation, [minI, minJ]);
}
