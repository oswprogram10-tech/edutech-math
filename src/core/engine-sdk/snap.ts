/**
 * 자석 스냅: 격자·목표점·다른 객체 가장자리.
 * 학생이 손을 떼는 순간에만 스냅해도 충분하다(드래그 중에는 미리보기).
 */
import type { Point } from './coordinates';
import { clamp, distance } from './coordinates';

export interface SnapGrid {
  readonly size: number;
  readonly origin?: Point;
}

export interface SnapEdgeRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SnapTargets {
  readonly grid?: SnapGrid;
  readonly points?: readonly Point[];
  /** 다른 객체의 사각형 경계. 가장 가까운 변·모서리로 붙는다. */
  readonly edges?: readonly SnapEdgeRect[];
  /** 모든 종류에 공통으로 쓰는 거리 문턱(논리 좌표). */
  readonly threshold?: number;
  readonly pointThreshold?: number;
  readonly edgeThreshold?: number;
  readonly gridThreshold?: number;
}

export type SnapKind = 'point' | 'edge' | 'grid' | 'none';

export interface SnapResult {
  readonly point: Point;
  readonly kind: SnapKind;
  readonly distance: number;
  /** points/edges 배열에서 몇 번째 대상에 붙었는지. */
  readonly index?: number;
}

const DEFAULT_THRESHOLD = 24;

function thresholdOf(targets: SnapTargets, kind: 'point' | 'edge' | 'grid'): number {
  if (kind === 'point' && targets.pointThreshold !== undefined) return targets.pointThreshold;
  if (kind === 'edge' && targets.edgeThreshold !== undefined) return targets.edgeThreshold;
  if (kind === 'grid' && targets.gridThreshold !== undefined) return targets.gridThreshold;
  return targets.threshold ?? DEFAULT_THRESHOLD;
}

/** 사각형 경계 위에서 p와 가장 가까운 점. 사각형 안이면 가장 가까운 변으로 붙인다. */
export function nearestPointOnRect(p: Point, rect: SnapEdgeRect): Point {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const inside = p.x >= left && p.x <= right && p.y >= top && p.y <= bottom;

  if (inside) {
    const distances = [
      { distance: p.x - left, point: { x: left, y: p.y } },
      { distance: right - p.x, point: { x: right, y: p.y } },
      { distance: p.y - top, point: { x: p.x, y: top } },
      { distance: bottom - p.y, point: { x: p.x, y: bottom } },
    ];
    return distances.reduce((best, candidate) =>
      candidate.distance < best.distance ? candidate : best,
    ).point;
  }

  return {
    x: clamp(p.x, left, right),
    y: clamp(p.y, top, bottom),
  };
}

export function snapToGrid(p: Point, grid: SnapGrid, threshold: number): SnapResult | null {
  if (grid.size <= 0) return null;
  const origin = grid.origin ?? { x: 0, y: 0 };
  const point = {
    x: origin.x + Math.round((p.x - origin.x) / grid.size) * grid.size,
    y: origin.y + Math.round((p.y - origin.y) / grid.size) * grid.size,
  };
  const d = distance(p, point);
  return d <= threshold ? { point, kind: 'grid', distance: d } : null;
}

export function snapToPoints(
  p: Point,
  points: readonly Point[],
  threshold: number,
): SnapResult | null {
  let best: SnapResult | null = null;
  points.forEach((point, index) => {
    const d = distance(p, point);
    if (d <= threshold && (!best || d < best.distance)) {
      best = { point, kind: 'point', distance: d, index };
    }
  });
  return best;
}

export function snapToEdges(
  p: Point,
  rects: readonly SnapEdgeRect[],
  threshold: number,
): SnapResult | null {
  let best: SnapResult | null = null;
  rects.forEach((rect, index) => {
    const point = nearestPointOnRect(p, rect);
    const d = distance(p, point);
    if (d <= threshold && (!best || d < best.distance)) {
      best = { point, kind: 'edge', distance: d, index };
    }
  });
  return best;
}

/**
 * 목표점 → 다른 객체 가장자리 → 격자 순서로 가까운 것을 고른다.
 * 목표점이 가장 강한 자석이고, 격자는 마지막 안전망이다.
 */
export function snapPoint(p: Point, targets: SnapTargets): SnapResult {
  const candidates: SnapResult[] = [];
  if (targets.points && targets.points.length > 0) {
    const found = snapToPoints(p, targets.points, thresholdOf(targets, 'point'));
    if (found) candidates.push(found);
  }
  if (targets.edges && targets.edges.length > 0) {
    const found = snapToEdges(p, targets.edges, thresholdOf(targets, 'edge'));
    if (found) candidates.push(found);
  }
  if (targets.grid) {
    const found = snapToGrid(p, targets.grid, thresholdOf(targets, 'grid'));
    if (found) candidates.push(found);
  }

  const order: SnapKind[] = ['point', 'edge', 'grid'];
  for (const kind of order) {
    const sameKind = candidates.filter((candidate) => candidate.kind === kind);
    if (sameKind.length === 0) continue;
    return sameKind.reduce((best, candidate) =>
      candidate.distance < best.distance ? candidate : best,
    );
  }
  return { point: p, kind: 'none', distance: 0 };
}
