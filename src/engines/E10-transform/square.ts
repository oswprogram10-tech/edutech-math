/**
 * E10의 정수 모눈 변환.
 *
 * 칸은 두 배 좌표의 중심 `(2i+1, 2j+1)`로 바꿔 변환하고 다시
 * `[(X−1)/2, (Y−1)/2]`로 돌린다. 꼭짓점은 그대로 변환한다. 그래서 꼭짓점
 * 중심 회전도 칸이 칸으로 정확히 간다.
 *
 * 모든 입구에서 `Number.isSafeInteger`가 아니면 예외를 던진다. 이 파일에는
 * 부동소수 연산이 없다.
 */
import type {
  Cell,
  Move,
  Orientation,
  Pt,
  Side,
  SquareFigure,
  TurnAngle,
  TurnDirection,
} from './types';

export interface FigureBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function fail(message: string): never {
  throw new RangeError(message);
}

/** 정수인지 확인한다. `NaN`·`Infinity`·소수는 모두 거부한다. */
export function safeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value)) fail(`${name}은(는) 안전한 정수여야 합니다.`);
  return value;
}

export function pt(x: number, y: number): Pt {
  return [safeInteger(x, 'x'), safeInteger(y, 'y')];
}

function pair(value: readonly number[], name: string): readonly [number, number] {
  const x = value[0];
  const y = value[1];
  if (x === undefined || y === undefined) fail(`${name}의 좌표가 두 개가 아닙니다.`);
  return [safeInteger(x, `${name}.x`), safeInteger(y, `${name}.y`)];
}

export function assertPt(value: Pt, name = '점'): Pt {
  return pair(value, name);
}

export function assertCell(value: Cell, name = '칸'): Cell {
  return pair(value, name);
}

function assertAngle(angle: number): TurnAngle {
  if (angle !== 90 && angle !== 180 && angle !== 270) {
    fail('회전 각은 90·180·270 중 하나여야 합니다.');
  }
  return angle;
}

/** 반대 방향. 270°는 반대 방향 90°와 같다. */
function opposite(direction: TurnDirection): TurnDirection {
  return direction === 'cw' ? 'ccw' : 'cw';
}

/**
 * 시계 90°(화면, y 아래쪽): `v' = (−v.y, v.x)`.
 * 반시계 90°: `v' = (v.y, −v.x)`. 180°는 `(−v.x, −v.y)`.
 */
export function rotatePt(point: Pt, center: Pt, angle: TurnAngle, direction: TurnDirection): Pt {
  const p = assertPt(point, '점');
  const c = assertPt(center, '중심');
  const rotation = assertAngle(angle);
  if (rotation === 180) {
    return [2 * c[0] - p[0], 2 * c[1] - p[1]];
  }
  const effective: TurnDirection = rotation === 270 ? opposite(direction) : direction;
  const vx = p[0] - c[0];
  const vy = p[1] - c[1];
  if (effective === 'cw') return [c[0] - vy, c[1] + vx];
  return [c[0] + vy, c[1] - vx];
}

/** 칸 중심(두 배 좌표)을 같은 식으로 돌린다. */
export function rotateCell(
  cell: Cell,
  center: Pt,
  angle: TurnAngle,
  direction: TurnDirection,
): Cell {
  const [i, j] = assertCell(cell);
  const c = assertPt(center, '중심');
  const rotation = assertAngle(angle);
  const cx = 2 * c[0];
  const cy = 2 * c[1];
  const x = 2 * i + 1;
  const y = 2 * j + 1;
  let nextX: number;
  let nextY: number;
  if (rotation === 180) {
    nextX = 2 * cx - x;
    nextY = 2 * cy - y;
  } else {
    const effective: TurnDirection = rotation === 270 ? opposite(direction) : direction;
    if (effective === 'cw') {
      nextX = cx - (y - cy);
      nextY = cy + (x - cx);
    } else {
      nextX = cx + (y - cy);
      nextY = cy - (x - cx);
    }
  }
  const next: Cell = [(nextX - 1) / 2, (nextY - 1) / 2];
  if (!Number.isSafeInteger(next[0]) || !Number.isSafeInteger(next[1])) {
    fail('회전한 칸이 정수 격자에 놓이지 않습니다.');
  }
  return next;
}

export function translatePt(point: Pt, dx: number, dy: number): Pt {
  const p = assertPt(point);
  return [p[0] + safeInteger(dx, 'dx'), p[1] + safeInteger(dy, 'dy')];
}

export function translateCell(cell: Cell, dx: number, dy: number): Cell {
  const c = assertCell(cell);
  return [c[0] + safeInteger(dx, 'dx'), c[1] + safeInteger(dy, 'dy')];
}

export function translateFigure(figure: SquareFigure, dx: number, dy: number): SquareFigure {
  const x = safeInteger(dx, 'dx');
  const y = safeInteger(dy, 'dy');
  return {
    outline: figure.outline.map((point) => translatePt(point, x, y)),
    cells: figure.cells.map((cell) => translateCell(cell, x, y)),
  };
}

export function figureBounds(figure: SquareFigure): FigureBounds {
  if (figure.outline.length === 0) fail('도형의 꼭짓점이 없습니다.');
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of figure.outline) {
    const [x, y] = assertPt(point);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** 축은 도형 꼭짓점 상자(bbox)의 그 쪽 변이다. 교과서의 "오른쪽으로 뒤집기"와 같다. */
export function flipFigure(figure: SquareFigure, side: Side): SquareFigure {
  const bounds = figureBounds(figure);
  const flipX = (x: number): number => {
    if (side === 'right') return 2 * bounds.maxX - x;
    if (side === 'left') return 2 * bounds.minX - x;
    return x;
  };
  const flipY = (y: number): number => {
    if (side === 'down') return 2 * bounds.maxY - y;
    if (side === 'up') return 2 * bounds.minY - y;
    return y;
  };
  const flipCellX = (i: number): number => {
    if (side === 'right') return 2 * bounds.maxX - i - 1;
    if (side === 'left') return 2 * bounds.minX - i - 1;
    return i;
  };
  const flipCellY = (j: number): number => {
    if (side === 'down') return 2 * bounds.maxY - j - 1;
    if (side === 'up') return 2 * bounds.minY - j - 1;
    return j;
  };
  return {
    outline: figure.outline.map((point) => {
      const [x, y] = assertPt(point);
      return [flipX(x), flipY(y)];
    }),
    cells: figure.cells.map((cell) => {
      const [i, j] = assertCell(cell);
      return [flipCellX(i), flipCellY(j)];
    }),
  };
}

export function rotateFigure(
  figure: SquareFigure,
  center: Pt,
  angle: TurnAngle,
  direction: TurnDirection,
): SquareFigure {
  return {
    outline: figure.outline.map((point) => rotatePt(point, center, angle, direction)),
    cells: figure.cells.map((cell) => rotateCell(cell, center, angle, direction)),
  };
}

export function applySquareMove(figure: SquareFigure, move: Move): SquareFigure {
  switch (move.kind) {
    case 'slide':
      return translateFigure(figure, move.dx, move.dy);
    case 'flip':
      return flipFigure(figure, move.side);
    case 'turn':
      return rotateFigure(figure, move.center, assertAngle(move.angle), move.direction);
  }
  return fail('알 수 없는 이동입니다.');
}

/** 모든 칸이 `0 ≤ i, j < grid`인지. */
export function inGrid(figure: SquareFigure, grid: number): boolean {
  const size = safeInteger(grid, 'grid');
  return figure.cells.every((cell) => {
    const [i, j] = assertCell(cell);
    return i >= 0 && j >= 0 && i < size && j < size;
  });
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** j, i 순으로 정렬한 새 배열. */
export function sortedCells(cells: readonly Cell[]): Cell[] {
  return [...cells].sort((a, b) => (a[1] === b[1] ? a[0] - b[0] : a[1] - b[1]));
}

export function cellKey(cell: Cell): string {
  return `${cell[0]},${cell[1]}`;
}

export function cellSetKey(cells: readonly Cell[]): string {
  return sortedCells(cells)
    .map((cell) => cellKey(cell))
    .join(';');
}

export function sameCellSet(a: readonly Cell[], b: readonly Cell[]): boolean {
  return cellSetKey(a) === cellSetKey(b);
}

/** 두 점을 잇는 선분이 가로·세로인지(뒤집기 축 표시용). */
export function isAxisAligned(a: Pt, b: Pt): boolean {
  return a[0] === b[0] || a[1] === b[1];
}

/** 방향 이름을 그대로 돌려준다. 설정 해석에서 쓴다. */
export function isOrientationValue(value: string): value is Orientation {
  return (
    value === 'id' ||
    value === 'cw90' ||
    value === 'r180' ||
    value === 'ccw90' ||
    value === 'flip-h' ||
    value === 'flip-v' ||
    value === 'flip-d' ||
    value === 'flip-a'
  );
}
