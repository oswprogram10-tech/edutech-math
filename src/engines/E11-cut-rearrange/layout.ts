/**
 * E11 화면 배치. 화면 좌표(number)는 이 파일에서만 만든다.
 *
 * slice·formula-derive 판은 22×14칸(한 칸 50, 원점 화면 (50, 50))이고,
 * angle-gather 못판은 13×13못(0~12, 한 칸 50, 원점 화면 (50, 100))이다.
 */
import type { Point } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import type { GPoint } from '../../core/math';
import type { Piece } from './pieces/types';
import type { RPoint } from './rpoint';
import { toG } from './rpoint';
import { BOARD_ORIGIN, CELL, GATHER_CENTER, GATHER_PAD, PEG_MAX, PEG_ORIGIN } from './types';
import type { Peg } from './angle-gather/types';

export interface ScreenLine {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

function rationalNumber(value: Rational): number {
  return Number(value.n) / Number(value.d);
}

export function gridPoint(point: RPoint): Point {
  const g = toG(point);
  return { x: rationalNumber(g.x), y: rationalNumber(g.y) };
}

export function boardPoint(point: RPoint): Point {
  const g = gridPoint(point);
  return { x: BOARD_ORIGIN.x + g.x * CELL, y: BOARD_ORIGIN.y + g.y * CELL };
}

export function gridScreenPoint(x: Rational, y: Rational): Point {
  return {
    x: BOARD_ORIGIN.x + rationalNumber(x) * CELL,
    y: BOARD_ORIGIN.y + rationalNumber(y) * CELL,
  };
}

export function boardPoints(points: readonly RPoint[]): Point[] {
  return points.map(boardPoint);
}

export function pointsAttribute(points: readonly Point[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

export function centroid(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}

/** 화면 논리 좌표를 격자 단위(number)로. 히트 테스트에만 쓴다. */
export function screenToGrid(point: Point): Point {
  return {
    x: (point.x - BOARD_ORIGIN.x) / CELL,
    y: (point.y - BOARD_ORIGIN.y) / CELL,
  };
}

export function roundGrid(point: Point): { readonly x: number; readonly y: number } {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

export function boardGridLines(): ScreenLine[] {
  const lines: ScreenLine[] = [];
  const left = BOARD_ORIGIN.x;
  const top = BOARD_ORIGIN.y;
  const right = left + 22 * CELL;
  const bottom = top + 14 * CELL;
  for (let column = 0; column <= 22; column += 1) {
    const x = left + column * CELL;
    lines.push({ x1: x, y1: top, x2: x, y2: bottom });
  }
  for (let row = 0; row <= 14; row += 1) {
    const y = top + row * CELL;
    lines.push({ x1: left, y1: y, x2: right, y2: y });
  }
  return lines;
}

export function pointInScreenPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    if (!a || !b) continue;
    const crosses = a.y > point.y !== b.y > point.y;
    if (!crosses) continue;
    const x = a.x + ((point.y - a.y) / (b.y - a.y)) * (b.x - a.x);
    if (x > point.x) inside = !inside;
  }
  return inside;
}

/** 눌린 화면 위치가 속한 조각. 겹치면 위(뒤에 그린) 조각을 고른다. */
export function pieceAtPoint(pieces: readonly Piece[], point: Point): Piece | null {
  for (let index = pieces.length - 1; index >= 0; index -= 1) {
    const piece = pieces[index];
    if (!piece) continue;
    if (pointInScreenPolygon(point, boardPoints(piece.vertices))) return piece;
  }
  return null;
}

/** 후보 점 중 터치 반경 안에서 가장 가까운 것의 번호. */
export function nearestCandidateIndex(
  candidates: readonly RPoint[],
  point: Point,
  radius: number,
): number | null {
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  candidates.forEach((candidate, index) => {
    const screen = boardPoint(candidate);
    const distance = Math.hypot(screen.x - point.x, screen.y - point.y);
    if (distance <= radius && distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

export function pegScreen(peg: Peg): Point {
  return {
    x: PEG_ORIGIN.x + peg[0] * CELL,
    y: PEG_ORIGIN.y + peg[1] * CELL,
  };
}

export function pegBoardRect(): { readonly x: number; readonly y: number; readonly size: number } {
  return { x: PEG_ORIGIN.x, y: PEG_ORIGIN.y, size: PEG_MAX * CELL };
}

export function screenDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 작은 시도 그림을 상자 안에 맞춘다. */
export function normalizePolygonToBox(
  points: readonly Point[],
  box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): Point[] {
  if (points.length === 0) return [];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const scale = Math.min(box.width / width, box.height / height);
  const offsetX = box.x + (box.width - width * scale) / 2;
  const offsetY = box.y + (box.height - height * scale) / 2;
  return points.map((point) => ({
    x: offsetX + (point.x - minX) * scale,
    y: offsetY + (point.y - minY) * scale,
  }));
}

export function nearestPeg(point: Point): Peg {
  const x = Math.max(0, Math.min(PEG_MAX, Math.round((point.x - PEG_ORIGIN.x) / CELL)));
  const y = Math.max(0, Math.min(PEG_MAX, Math.round((point.y - PEG_ORIGIN.y) / CELL)));
  return [x, y];
}

export function allPegs(): Peg[] {
  const result: Peg[] = [];
  for (let y = 0; y <= PEG_MAX; y += 1) {
    for (let x = 0; x <= PEG_MAX; x += 1) result.push([x, y]);
  }
  return result;
}

export function pegPointsAttribute(vertices: readonly Peg[]): string {
  return pointsAttribute(vertices.map(pegScreen));
}

export function gatherCenterPoint(): Point {
  return { x: GATHER_CENTER.x, y: GATHER_CENTER.y };
}

export function gatherPadRect(): {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
} {
  return { x: GATHER_PAD.x, y: GATHER_PAD.y, width: GATHER_PAD.width, height: GATHER_PAD.height };
}

export function directionNumber(direction: GPoint): Point {
  return { x: rationalNumber(direction.x), y: rationalNumber(direction.y) };
}

/** `origin`에서 `direction` 쪽으로 `length`만큼 간 화면 점. */
export function rayEndPoint(origin: Point, direction: GPoint, length: number): Point {
  const vector = directionNumber(direction);
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude === 0) return origin;
  return {
    x: origin.x + (vector.x / magnitude) * length,
    y: origin.y + (vector.y / magnitude) * length,
  };
}

/** 모은 각 조각의 부채꼴 삼각형(꼭짓점 + 두 반직선). */
export function sectorTriangle(center: Point, s: GPoint, e: GPoint, radius: number): Point[] {
  return [center, rayEndPoint(center, s, radius), rayEndPoint(center, e, radius)];
}

/** 부채꼴 호 하나. 볼록 도형의 안쪽 각이라 180°보다 작다. */
export function sectorArc(center: Point, s: GPoint, e: GPoint, radius: number): string {
  const start = rayEndPoint(center, s, radius);
  const end = rayEndPoint(center, e, radius);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function cornerArcPaths(
  center: Point,
  s: GPoint,
  e: GPoint,
  radius: number,
  count: number,
): string[] {
  const paths: string[] = [];
  const lines = Math.max(1, Math.min(4, Math.round(count)));
  for (let index = 0; index < lines; index += 1) {
    paths.push(sectorArc(center, s, e, radius + index * 9));
  }
  return paths;
}

export function unitCoverRect(
  minX: Rational,
  minY: Rational,
  maxX: Rational,
  maxY: Rational,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const topLeft = gridScreenPoint(minX, minY);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: rationalNumber(maxX.sub(minX)) * CELL,
    height: rationalNumber(maxY.sub(minY)) * CELL,
  };
}

/** 단위넓이 격자 선. `unitCoverRect` 안에만 그린다. */
export function unitCoverLines(rect: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}): ScreenLine[] {
  const lines: ScreenLine[] = [];
  const columns = Math.round(rect.width / CELL);
  const rows = Math.round(rect.height / CELL);
  for (let column = 1; column < columns; column += 1) {
    const x = rect.x + column * CELL;
    lines.push({ x1: x, y1: rect.y, x2: x, y2: rect.y + rect.height });
  }
  for (let row = 1; row < rows; row += 1) {
    const y = rect.y + row * CELL;
    lines.push({ x1: rect.x, y1: y, x2: rect.x + rect.width, y2: y });
  }
  return lines;
}

export interface SlantRectangle {
  /** 처음 도형(평행사변형)의 화면 점. */
  readonly parallelogram: Point[];
  /** 밑변 × 옆변 길이 직사각형. */
  readonly rect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly base: number;
  readonly side: number;
}

/**
 * 수평 밑변이 있는 평행사변형이면 밑변 × 옆변 직사각형을 돌려준다.
 * 힌트 ② `slant-rectangle`(MC-AREA-SLANT-SIDE)용 화면 계산이다.
 */
export function slantRectangle(points: readonly RPoint[]): SlantRectangle | null {
  if (points.length !== 4) return null;
  const screen = boardPoints(points);
  const edges = screen.map((point, index) => {
    const next = screen[(index + 1) % screen.length];
    return next ? { index, horizontal: Math.abs(point.y - next.y) < 0.01, point, next } : null;
  });
  const horizontal = edges.filter(
    (edge): edge is NonNullable<(typeof edges)[number]> => edge !== null && edge.horizontal,
  );
  if (horizontal.length !== 2) return null;
  const first = horizontal[0];
  const second = horizontal[1];
  if (!first || !second) return null;
  if ((first.index + 2) % 4 !== second.index) return null;

  const bottom = first.point.y > second.point.y ? first : second;
  const width = Math.abs(bottom.next.x - bottom.point.x);
  if (width <= 0) return null;
  const sideStart = bottom.next;
  const sideEnd = screen[(bottom.index + 2) % 4];
  if (!sideEnd) return null;
  const side = Math.hypot(sideEnd.x - sideStart.x, sideEnd.y - sideStart.y);
  if (side <= 0) return null;
  const x = Math.min(bottom.point.x, bottom.next.x);
  return {
    parallelogram: screen,
    rect: { x, y: bottom.point.y - side, width, height: side },
    base: width / CELL,
    side: side / CELL,
  };
}

/** 힌트 ② `unit-compare`: 오른쪽 아래의 1칸 선분과 1칸 정사각형. */
export function unitComparePlacement(): {
  readonly segment: ScreenLine;
  readonly square: { readonly x: number; readonly y: number; readonly size: number };
} {
  return {
    segment: { x1: 1000, y1: 762, x2: 1050, y2: 762 },
    square: { x: 1080, y: 712, size: 50 },
  };
}

/** 반원(180°)·온원(360°) 부채꼴 도식. 각도 숫자는 쓰지 않는다. */
export function fanSchematic(center: Point, radius: number, sum: 180 | 360): string[] {
  if (sum === 180) {
    return [
      `M ${center.x - radius} ${center.y} A ${radius} ${radius} 0 0 1 ${center.x + radius} ${center.y}`,
      `M ${center.x} ${center.y} L ${center.x - radius} ${center.y} M ${center.x} ${center.y} L ${center.x + radius} ${center.y}`,
    ];
  }
  return [
    `M ${center.x - radius} ${center.y} A ${radius} ${radius} 0 0 1 ${center.x + radius} ${center.y}`,
    `M ${center.x + radius} ${center.y} A ${radius} ${radius} 0 0 1 ${center.x - radius} ${center.y}`,
  ];
}

/** 두 점 사이를 휘어진 호 화살표로 잇는다. 힌트 ② `hinge-replay`용. */
export function curvedArrow(from: Point, to: Point, bend: number): string {
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const control = {
    x: mid.x + (-dy / length) * bend,
    y: mid.y + (dx / length) * bend,
  };
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} Q ${control.x.toFixed(2)} ${control.y.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}
