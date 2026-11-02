/**
 * 올가미 판정. 자유 폐곡선(마지막 점과 첫 점을 잇는다) 안에 점이 있는지 본다.
 * 화면 좌표 궤적은 Action에 넣지 않고, 여기서 고른 객체 ID만 Action으로 보낸다.
 */
import type { Point } from './coordinates';
import { distance } from './coordinates';

const EPSILON = 1e-9;

function pointOnSegment(p: Point, a: Point, b: Point): boolean {
  const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  // 올가미 끝점이 시작점과 겹치면 길이 0인 변이 생긴다. 그 변은 점 하나와 같다.
  if (lengthSquared <= EPSILON * EPSILON) {
    return (p.x - a.x) ** 2 + (p.y - a.y) ** 2 <= EPSILON * EPSILON;
  }
  const cross = (p.y - a.y) * (b.x - a.x) - (p.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > EPSILON) return false;
  const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
  if (dot < -EPSILON) return false;
  return dot <= lengthSquared + EPSILON;
}

/** 변 위의 점도 포함으로 본다(초등 조작에서 경계에 걸친 셈돌을 놓치지 않게). */
export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  if (polygon.length < 3) return false;

  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i] as Point;
    const b = polygon[(i + 1) % polygon.length] as Point;
    if (pointOnSegment(point, a, b)) return true;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i] as Point;
    const b = polygon[j] as Point;
    const crosses = a.y > point.y !== b.y > point.y;
    if (crosses) {
      const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
}

/** 폴리곤 안에 중심이 있는 항목만 고른다. */
export function selectInside<T>(
  polygon: readonly Point[],
  items: readonly T[],
  getPoint: (item: T) => Point,
): T[] {
  if (polygon.length < 3) return [];
  return items.filter((item) => pointInPolygon(getPoint(item), polygon));
}

/** 손가락이 거의 움직이지 않았으면 '탭'으로 본다. (올가미 대신 셈돌 놓기) */
export function isTapGesture(points: readonly Point[], threshold: number): boolean {
  const first = points[0];
  if (!first) return true;
  return points.every((point) => distance(first, point) <= threshold);
}

/** 자유 곡선의 총 이동 거리. 테스트·디버깅용. */
export function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distance(points[i - 1] as Point, points[i] as Point);
  }
  return total;
}
