/**
 * 자를 점 후보와 경첩 점 후보.
 *
 * 자를 점은 꼭짓점, 변의 중점, 변이 정수 격자선(x = 정수 또는 y = 정수)과
 * 만나는 점뿐이다. 모두 유리수이므로 잘린 점도 언제나 유리수다(카드 결정 2·6).
 */
import { Rational, dist2, gp, midpoint, samePoint, vsub } from '../../../core/math';
import type { GPoint } from '../../../core/math';
import { fromG, toG } from '../rpoint';
import type { RPoint } from '../rpoint';
import type { Piece } from './types';

function integerLinesBetween(min: Rational, max: Rational): bigint[] {
  if (min.compareTo(max) > 0) return [];
  const first = min.integerPart() + 1n;
  const last = max.isInteger() ? max.integerPart() - 1n : max.integerPart();
  const result: bigint[] = [];
  for (let value = first; value <= last; value += 1n) result.push(value);
  return result;
}

function betweenZeroAndOne(value: Rational): boolean {
  return value.compareTo(Rational.of(0)) > 0 && value.compareTo(Rational.of(1)) < 0;
}

function interiorCandidates(a: GPoint, b: GPoint): GPoint[] {
  const found: GPoint[] = [];
  const push = (point: GPoint) => {
    if (samePoint(point, a) || samePoint(point, b)) return;
    if (found.some((existing) => samePoint(existing, point))) return;
    found.push(point);
  };

  if (!a.x.equals(b.x)) {
    const [minX, maxX] = a.x.compareTo(b.x) <= 0 ? [a.x, b.x] : [b.x, a.x];
    for (const line of integerLinesBetween(minX, maxX)) {
      const x = Rational.of(line);
      const t = x.sub(a.x).div(b.x.sub(a.x));
      if (!betweenZeroAndOne(t)) continue;
      push({ x, y: a.y.add(t.mul(b.y.sub(a.y))) });
    }
  }

  if (!a.y.equals(b.y)) {
    const [minY, maxY] = a.y.compareTo(b.y) <= 0 ? [a.y, b.y] : [b.y, a.y];
    for (const line of integerLinesBetween(minY, maxY)) {
      const y = Rational.of(line);
      const t = y.sub(a.y).div(b.y.sub(a.y));
      if (!betweenZeroAndOne(t)) continue;
      push({ x: a.x.add(t.mul(b.x.sub(a.x))), y });
    }
  }

  push(midpoint(a, b));

  found.sort((first, second) => dist2(a, first).compareTo(dist2(a, second)));
  return found;
}

/** 꼭짓점 0부터 순서대로, 각 변의 시작 꼭짓점 → 변 안쪽 후보(가까운 순). */
export function cutCandidates(piece: Piece): RPoint[] {
  const vertices = piece.vertices;
  const result: RPoint[] = [];
  const seen = new Set<string>();
  const add = (point: RPoint) => {
    const key = `${point[0]},${point[1]}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(point);
  };

  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    if (!current || !next) continue;
    add(current);
    const a = toG(current);
    const b = toG(next);
    for (const point of interiorCandidates(a, b)) add(fromG(point));
  }
  return result;
}

/** `[v0, m01, v1, m12, …]`처럼 꼭짓점과 변의 중점을 번갈아 둔다. */
export function hingeCandidates(piece: Piece): RPoint[] {
  const vertices = piece.vertices;
  const result: RPoint[] = [];
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    if (!current || !next) continue;
    result.push(current);
    result.push(fromG(midpoint(toG(current), toG(next))));
  }
  return result;
}

/** 변 위의 점 하나를 꼭짓점 기준 거리로 정렬할 때 쓴다(테스트·View 공용). */
export function orderAlongEdge(a: RPoint, points: readonly RPoint[]): RPoint[] {
  const start = toG(a);
  return [...points].sort(
    (first, second) =>
      dist2(start, toG(first)).compareTo(dist2(start, toG(second))) ||
      vsub(toG(first), start).x.compareTo(vsub(toG(second), start).x) ||
      vsub(toG(first), start).y.compareTo(vsub(toG(second), start).y),
  );
}

/** 격자 단위 거리(화면 히트 테스트용, 수학 판정에는 쓰지 않는다). */
export function gridDistance(a: RPoint, b: RPoint): number {
  const first = toG(a);
  const second = toG(b);
  const dx = Number(first.x.n) / Number(first.x.d) - Number(second.x.n) / Number(second.x.d);
  const dy = Number(first.y.n) / Number(first.y.d) - Number(second.y.n) / Number(second.y.d);
  return Math.hypot(dx, dy);
}

/** 정수 격자 점. View가 포인터 위치를 후보와 비교할 때만 number를 쓴다. */
export function nearestCandidate(
  candidates: readonly RPoint[],
  x: number,
  y: number,
  tolerance: number,
): RPoint | null {
  let best: RPoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const g = toG(candidate);
    const dx = Number(g.x.n) / Number(g.x.d) - x;
    const dy = Number(g.y.n) / Number(g.y.d) - y;
    const distance = Math.hypot(dx, dy);
    if (distance <= tolerance && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/** `gp`를 쓰지 않는 곳에서 정수 점을 만들 때. */
export function intPoint(x: number, y: number): GPoint {
  return gp(x, y);
}
