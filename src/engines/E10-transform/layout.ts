/**
 * E10 화면 배치. View·overlay·E2E가 같은 좌표를 쓰도록 한 곳에 모은다.
 * 좌표는 모두 논리 좌표(1000×1000)이고, 여기서만 number를 쓴다.
 */
import { clamp } from '../../core/engine-sdk';
import type { Point } from '../../core/engine-sdk';
import type { Cell, Pt, SquareFigure, TurnDirection } from './types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';

const MARGIN = 60;
const USABLE = LOGICAL_WIDTH - MARGIN * 2;

export interface BoardRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly cell: number;
  readonly grid: number;
}

/** `grid`×`grid` 칸을 가운데에 놓는다. 칸 크기는 `880 / grid`다. */
export function boardRect(grid: number): BoardRect {
  const size = Math.max(1, Math.round(grid));
  const cell = USABLE / size;
  const width = cell * size;
  const height = cell * size;
  return {
    x: (LOGICAL_WIDTH - width) / 2,
    y: (LOGICAL_HEIGHT - height) / 2,
    width,
    height,
    cell,
    grid: size,
  };
}

export function cellRect(
  rect: BoardRect,
  cell: Cell,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  return {
    x: rect.x + cell[0] * rect.cell,
    y: rect.y + cell[1] * rect.cell,
    width: rect.cell,
    height: rect.cell,
  };
}

export function cellCenter(rect: BoardRect, cell: Cell): Point {
  return {
    x: rect.x + (cell[0] + 0.5) * rect.cell,
    y: rect.y + (cell[1] + 0.5) * rect.cell,
  };
}

export function ptXY(rect: BoardRect, point: Pt): Point {
  return { x: rect.x + point[0] * rect.cell, y: rect.y + point[1] * rect.cell };
}

/** 눌린 논리 좌표가 속한 칸. 격자 밖이면 가장자리로 자른다. */
export function pointerToCell(rect: BoardRect, point: Point): Cell {
  const i = clamp(Math.floor((point.x - rect.x) / rect.cell), 0, rect.grid - 1);
  const j = clamp(Math.floor((point.y - rect.y) / rect.cell), 0, rect.grid - 1);
  return [i, j];
}

export function polygonPoints(rect: BoardRect, points: readonly Pt[]): string {
  return points
    .map((point) => {
      const xy = ptXY(rect, point);
      return `${xy.x.toFixed(2)},${xy.y.toFixed(2)}`;
    })
    .join(' ');
}

/** 도형의 꼭짓점 상자를 화면 좌표로. */
export function figureBox(rect: BoardRect, figure: SquareFigure) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of figure.outline) {
    if (point[0] < minX) minX = point[0];
    if (point[1] < minY) minY = point[1];
    if (point[0] > maxX) maxX = point[0];
    if (point[1] > maxY) maxY = point[1];
  }
  const topLeft = ptXY(rect, [minX, minY]);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: (maxX - minX) * rect.cell,
    height: (maxY - minY) * rect.cell,
    minX,
    minY,
    maxX,
    maxY,
  };
}

function polar(center: Point, radius: number, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: center.x + radius * Math.cos(radians),
    y: center.y + radius * Math.sin(radians),
  };
}

/**
 * 돌리기 궤적 호. 화면 좌표라 number를 쓴다.
 * 시계 방향은 SVG sweep 1, 반시계는 0이다.
 */
export function arcPath(
  center: Point,
  from: Point,
  to: Point,
  angle: 90 | 180 | 270,
  direction: TurnDirection,
): string | null {
  const radius = Math.hypot(from.x - center.x, from.y - center.y);
  if (radius < 0.5) return null;
  const largeArc = angle === 270 ? 1 : 0;
  const sweep = direction === 'cw' ? 1 : 0;
  return [
    `M ${from.x.toFixed(2)} ${from.y.toFixed(2)}`,
    `A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${largeArc} ${sweep} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`,
  ].join(' ');
}

/** 시계판 눈금 12개의 양 끝. */
export function clockTicks(
  center: Point,
  radius: number,
): readonly { readonly from: Point; readonly to: Point }[] {
  const ticks = [];
  for (let index = 0; index < 12; index += 1) {
    const angle = -90 + index * 30;
    ticks.push({
      from: polar(center, radius * 0.82, angle),
      to: polar(center, radius, angle),
    });
  }
  return ticks;
}

/** 시계 방향 화살표 호(300°). 줄인 움직임의 정지 그림에 쓴다. */
export function clockwiseArrow(
  center: Point,
  radius: number,
): {
  readonly path: string;
  readonly head: string;
} {
  const start = polar(center, radius, -90);
  const end = polar(center, radius, -90 + 300);
  const path = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 1 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  const tangent = polar(center, radius * 0.16, -90 + 300 + 90);
  const head = [
    `${end.x.toFixed(2)},${end.y.toFixed(2)}`,
    `${(end.x + tangent.x - center.x).toFixed(2)},${(end.y + tangent.y - center.y).toFixed(2)}`,
    `${(end.x - tangent.x + center.x).toFixed(2)},${(end.y - tangent.y + center.y).toFixed(2)}`,
  ];
  return { path, head: head.join(' ') };
}

export { LOGICAL_HEIGHT, LOGICAL_WIDTH };
