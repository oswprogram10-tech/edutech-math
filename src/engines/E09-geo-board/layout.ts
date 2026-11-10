/**
 * E09 화면 배치. View·overlay·E2E가 같은 좌표를 쓰도록 한 곳에 모은다.
 * 좌표는 모두 논리 좌표(1000×1000)이고, 여기서만 number를 쓴다.
 */
import { snapToPoints } from '../../core/engine-sdk';
import type { Point } from '../../core/engine-sdk';
import type { Rational, Surd } from '../../core/math';
import type { Peg } from './types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';

const MARGIN = 100;

export interface BoardRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly spacing: number;
  readonly cols: number;
  readonly rows: number;
}

/** 못판의 네모와 못 간격. 격자 크기가 달라도 가운데에 놓는다. */
export function boardRect(cols: number, rows: number): BoardRect {
  const safeCols = Math.max(2, Math.round(cols));
  const safeRows = Math.max(2, Math.round(rows));
  const usable = LOGICAL_WIDTH - MARGIN * 2;
  const spacing = Math.min(usable / (safeCols - 1), usable / (safeRows - 1));
  const width = (safeCols - 1) * spacing;
  const height = (safeRows - 1) * spacing;
  return {
    x: Math.round((LOGICAL_WIDTH - width) / 2),
    y: Math.round((LOGICAL_HEIGHT - height) / 2),
    width,
    height,
    spacing,
    cols: safeCols,
    rows: safeRows,
  };
}

export function pegX(rect: BoardRect, i: number): number {
  return rect.x + i * rect.spacing;
}

export function pegY(rect: BoardRect, j: number): number {
  return rect.y + j * rect.spacing;
}

export function pegPoint(rect: BoardRect, peg: Peg): Point {
  return { x: pegX(rect, peg[0]), y: pegY(rect, peg[1]) };
}

export function pegAt(rect: BoardRect, i: number, j: number): Point {
  return { x: pegX(rect, i), y: pegY(rect, j) };
}

/** 눌린 화면 위치에서 가장 가까운 못(격자 번호). 범위를 벗어나면 가장자리로 자른다. */
export function nearestPeg(rect: BoardRect, point: Point): Peg {
  const i = Math.max(0, Math.min(rect.cols - 1, Math.round((point.x - rect.x) / rect.spacing)));
  const j = Math.max(0, Math.min(rect.rows - 1, Math.round((point.y - rect.y) / rect.spacing)));
  return [i, j];
}

/** 모든 못 좌표(행 우선). */
export function allPegs(rect: BoardRect): Peg[] {
  const result: Peg[] = [];
  for (let j = 0; j < rect.rows; j += 1) {
    for (let i = 0; i < rect.cols; i += 1) result.push([i, j]);
  }
  return result;
}

export function allPegPoints(rect: BoardRect): Point[] {
  return allPegs(rect).map((peg) => pegPoint(rect, peg));
}

/** 터치 반경 안에서 가장 가까운 못. 없으면 null. */
export function snapPeg(rect: BoardRect, point: Point, threshold: number): Peg | null {
  const pegs = allPegs(rect);
  const found = snapToPoints(point, allPegPoints(rect), threshold);
  if (!found || found.index === undefined) return null;
  return pegs[found.index] ?? null;
}

export function pegDistance(rect: BoardRect, first: Peg, second: Peg): number {
  return Math.hypot((first[0] - second[0]) * rect.spacing, (first[1] - second[1]) * rect.spacing);
}

/** 정확한 유리수를 화면 숫자로. 화면에만 쓴다. */
export function ratToScreen(value: Rational): number {
  return Number(value.n) / Number(value.d);
}

/** 정확한 무리수를 화면 숫자로. 화면에만 쓴다. */
export function surdToScreen(value: Surd): number {
  return ratToScreen(value.a) + ratToScreen(value.b) * Math.sqrt(ratToScreen(value.d));
}

function normalize(point: Point): Point {
  const length = Math.hypot(point.x, point.y);
  if (length === 0) return { x: 1, y: 0 };
  return { x: point.x / length, y: point.y / length };
}

function exitParameter(origin: Point, direction: Point): number {
  let best = Number.POSITIVE_INFINITY;
  if (direction.x > 1e-9) best = Math.min(best, (LOGICAL_WIDTH - origin.x) / direction.x);
  if (direction.x < -1e-9) best = Math.min(best, (0 - origin.x) / direction.x);
  if (direction.y > 1e-9) best = Math.min(best, (LOGICAL_HEIGHT - origin.y) / direction.y);
  if (direction.y < -1e-9) best = Math.min(best, (0 - origin.y) / direction.y);
  return Number.isFinite(best) && best > 0 ? best : 0;
}

/**
 * 반직선·직선의 연장 끝. 반직선은 `through`에서 한쪽으로, 직선은 양쪽으로 뻗는다.
 * 화면 계산이라 number를 쓴다(카드 결정 5).
 */
export function extensionSegment(
  from: Point,
  through: Point,
  kind: 'ray' | 'line',
): { readonly start: Point; readonly end: Point } {
  const direction = { x: through.x - from.x, y: through.y - from.y };
  if (direction.x === 0 && direction.y === 0) return { start: through, end: through };
  const forward = exitParameter(from, direction);
  const end = { x: from.x + direction.x * forward, y: from.y + direction.y * forward };
  if (kind === 'ray') return { start: through, end };
  const backward = exitParameter(from, { x: -direction.x, y: -direction.y });
  const start = { x: from.x - direction.x * backward, y: from.y - direction.y * backward };
  return { start, end };
}

/** 별 모양 점 문자열(과녁). */
export function starPoints(cx: number, cy: number, outer: number, inner = outer * 0.45): string {
  const points: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (Math.PI * index) / 5;
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return points.join(' ');
}

export interface SetSquareShape {
  readonly vertex: Point;
  readonly legA: Point;
  readonly legB: Point;
  /** 직각이 아닐 때 삼각자와 각의 다른 변 사이 틈(빗금 영역). */
  readonly gapPath: string | null;
  readonly right: boolean;
}

/**
 * 직각삼각자를 각에 댄 모양. 한 변은 각의 `a` 쪽 변에 맞추고, 다른 변은 그 변의
 * 수직 방향에 둔다. 직각이면 두 변에 꼭 맞고, 아니면 틈이 생긴다.
 */
export function setSquareShape(
  vertex: Point,
  a: Point,
  b: Point,
  size: number,
  right: boolean,
): SetSquareShape {
  const first = normalize({ x: a.x - vertex.x, y: a.y - vertex.y });
  const second = normalize({ x: b.x - vertex.x, y: b.y - vertex.y });
  const left: Point = { x: -first.y, y: first.x };
  const rightPerp: Point = { x: first.y, y: -first.x };
  const towardsB = left.x * second.x + left.y * second.y;
  const cross = left.x * second.y - left.y * second.x;
  const perpendicular = towardsB < 0 || (towardsB === 0 && cross < 0) ? rightPerp : left;

  const legA = { x: vertex.x + first.x * size, y: vertex.y + first.y * size };
  const legB = {
    x: vertex.x + perpendicular.x * size,
    y: vertex.y + perpendicular.y * size,
  };
  let gapPath: string | null = null;
  if (!right) {
    const endB = { x: vertex.x + second.x * size, y: vertex.y + second.y * size };
    const sweep = perpendicular.x * second.y - perpendicular.y * second.x > 0 ? 1 : 0;
    gapPath = [
      `M ${vertex.x.toFixed(2)} ${vertex.y.toFixed(2)}`,
      `L ${legB.x.toFixed(2)} ${legB.y.toFixed(2)}`,
      `A ${size.toFixed(2)} ${size.toFixed(2)} 0 0 ${sweep} ${endB.x.toFixed(2)} ${endB.y.toFixed(2)}`,
      'Z',
    ].join(' ');
  }
  return { vertex, legA, legB, gapPath, right };
}

/**
 * 가장 긴 변이 수평이 되도록 돌린 다각형. 힌트 ② `upright-ghost`가 쓴다.
 * 화면 계산이라 number를 쓴다.
 */
export function uprightPolygon(points: readonly Point[], center: Point, maxSize: number): Point[] {
  if (points.length < 2) return [];
  let longest = { index: 0, length: 0, angle: 0 };
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) continue;
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const length = Math.hypot(dx, dy);
    if (length > longest.length) {
      longest = { index, length, angle: Math.atan2(dy, dx) };
    }
  }
  const cos = Math.cos(-longest.angle);
  const sin = Math.sin(-longest.angle);
  const rotated = points.map((point) => ({
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }));
  const xs = rotated.map((point) => point.x);
  const ys = rotated.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const offsetX = center.x - (width * scale) / 2 - minX * scale;
  const offsetY = center.y - (height * scale) / 2 - minY * scale;
  return rotated.map((point) => ({
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY,
  }));
}
