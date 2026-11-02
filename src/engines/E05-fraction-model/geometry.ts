/**
 * E05의 도형 기하.
 *
 * 조각 넓이는 화면 기하(논리 좌표)라서 number로 계산한다(T010 구현 결정 2의 예외).
 * 등분 판정은 넓이 비교로만 하고, 조각 수만으로 판정하지 않는다.
 *
 * - 직선 절단은 평면 그래프(변 + 절단선)의 면(face)을 뽑아 조각을 만든다.
 * - 원의 방사형 절단은 정다각형 근사가 아니라 부채꼴 넓이 `(각/2)·r²`로 계산한다.
 */
import type { Point } from '../../core/engine-sdk';
import { CIRCLE_CENTER, CIRCLE_RADIUS } from './types';
import type { Cut, FractionShape } from './types';

const EPS = 1e-6;
const DIVISIONS = [2, 3, 4, 5, 6, 8] as const;

export interface Piece {
  readonly points: readonly Point[];
  readonly area: number;
  readonly centroid: Point;
}

export function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}

export function pointKey(point: Point): string {
  return `${point.x.toFixed(4)},${point.y.toFixed(4)}`;
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function signedArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!a || !b) continue;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function polygonArea(points: readonly Point[]): number {
  return Math.abs(signedArea(points));
}

export function polygonCentroid(points: readonly Point[]): Point {
  const area = signedArea(points);
  if (Math.abs(area) < EPS) {
    const sum = points.reduce(
      (accumulator, point) => ({ x: accumulator.x + point.x, y: accumulator.y + point.y }),
      { x: 0, y: 0 },
    );
    const count = Math.max(1, points.length);
    return { x: sum.x / count, y: sum.y / count };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!a || !b) continue;
    const cross = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    const crosses = a.y > point.y !== b.y > point.y;
    if (crosses) {
      const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
}

function interiorPoint(points: readonly Point[]): Point {
  const centroid = polygonCentroid(points);
  if (pointInPolygon(centroid, points)) return centroid;
  for (let i = 1; i + 1 < points.length; i += 1) {
    const a = points[0];
    const b = points[i];
    const c = points[i + 1];
    if (!a || !b || !c) continue;
    const triangleArea = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
    if (triangleArea < EPS) continue;
    const candidate = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
    if (pointInPolygon(candidate, points)) return candidate;
  }
  return centroid;
}

/** 화면 좌표(y 아래)에서 양의 부호 면적을 갖도록 꼭짓점 순서를 맞춘다. */
function ensurePositive(points: readonly Point[]): Point[] {
  const copy = points.map((point) => ({ ...point }));
  return signedArea(copy) < 0 ? copy.reverse() : copy;
}

export function rectOutline(x: number, y: number, width: number, height: number): Point[] {
  return ensurePositive([
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]);
}

export function circleOutline(
  center: Point = CIRCLE_CENTER,
  radius: number = CIRCLE_RADIUS,
  segments = 180,
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (Math.PI * 2 * i) / segments;
    points.push({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
  }
  return points;
}

export function outlineFor(shape: FractionShape, polygonPoints?: readonly Point[]): Point[] {
  switch (shape) {
    case 'rect':
      return rectOutline(150, 150, 700, 300);
    case 'square':
      return rectOutline(260, 60, 480, 480);
    case 'bar':
      return rectOutline(100, 230, 800, 140);
    case 'circle':
      return circleOutline();
    case 'triangle':
      return ensurePositive([
        { x: 500, y: 90 },
        { x: 880, y: 510 },
        { x: 120, y: 510 },
      ]);
    case 'polygon':
      return ensurePositive(
        polygonPoints && polygonPoints.length >= 3
          ? polygonPoints
          : [
              { x: 160, y: 140 },
              { x: 780, y: 140 },
              { x: 880, y: 300 },
              { x: 650, y: 520 },
              { x: 260, y: 470 },
              { x: 120, y: 300 },
            ],
      );
  }
}

/** 원 위의 등분 후보점. 원의 방사형 절단은 이 점들로 스냅한다. */
export function circleCandidates(
  center: Point = CIRCLE_CENTER,
  radius: number = CIRCLE_RADIUS,
): Point[] {
  const points: Point[] = [{ ...center }];
  for (const division of DIVISIONS) {
    for (let k = 0; k < division; k += 1) {
      const angle = (Math.PI * 2 * k) / division;
      points.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      });
    }
  }
  return points;
}

/** 다각형 변을 2·3·4·5·6·8등분한 점 + 꼭짓점. */
export function boundaryCandidates(outline: readonly Point[]): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    if (!a || !b) continue;
    points.push({ ...a });
    for (const division of DIVISIONS) {
      for (let k = 1; k < division; k += 1) {
        points.push(lerp(a, b, k / division));
      }
    }
  }
  return points;
}

export function cutCandidates(shape: FractionShape, outline: readonly Point[]): Point[] {
  return shape === 'circle' ? circleCandidates() : boundaryCandidates(outline);
}

export function projectToBoundary(point: Point, outline: readonly Point[]): Point {
  let best: Point = outline[0] ?? { x: 0, y: 0 };
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t =
      lengthSquared > 0
        ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
        : 0;
    const candidate = { x: a.x + dx * t, y: a.y + dy * t };
    const candidateDistance = distance(point, candidate);
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      best = candidate;
    }
  }
  return best;
}

export function snapToCandidates(
  point: Point,
  candidates: readonly Point[],
  outline: readonly Point[],
  threshold: number,
): Point {
  let best: Point | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const candidateDistance = distance(point, candidate);
    if (candidateDistance <= threshold && candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      best = candidate;
    }
  }
  return best ?? projectToBoundary(point, outline);
}

interface Intersection {
  readonly t: number;
  readonly u: number;
  readonly point: Point;
}

function segmentIntersection(a: Point, b: Point, c: Point, d: Point): Intersection | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denominator = r.x * s.y - r.y * s.x;
  if (Math.abs(denominator) < EPS) return null;
  const q = { x: c.x - a.x, y: c.y - a.y };
  const t = (q.x * s.y - q.y * s.x) / denominator;
  const u = (q.x * r.y - q.y * r.x) / denominator;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  const clampedT = Math.max(0, Math.min(1, t));
  return { t: clampedT, u: Math.max(0, Math.min(1, u)), point: lerp(a, b, clampedT) };
}

function uniqueSorted(values: readonly number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const result: number[] = [];
  for (const value of sorted) {
    const last = result[result.length - 1];
    if (last === undefined || Math.abs(last - value) > 1e-9) result.push(value);
  }
  return result;
}

function addUndirectedEdge(edges: Map<string, readonly [Point, Point]>, a: Point, b: Point): void {
  if (samePoint(a, b)) return;
  const keyA = pointKey(a);
  const keyB = pointKey(b);
  const key = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
  if (!edges.has(key)) edges.set(key, [a, b]);
}

function planarFaces(
  outline: readonly Point[],
  cutSegments: readonly (readonly [Point, Point])[],
): Piece[] {
  const segments: (readonly [Point, Point])[] = [];
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    if (a && b) segments.push([a, b]);
  }
  for (const segment of cutSegments) segments.push(segment);

  const parameters: number[][] = segments.map(() => [0, 1]);
  for (let i = 0; i < segments.length; i += 1) {
    const first = segments[i];
    if (!first) continue;
    for (let j = i + 1; j < segments.length; j += 1) {
      const second = segments[j];
      if (!second) continue;
      const hit = segmentIntersection(first[0], first[1], second[0], second[1]);
      if (!hit) continue;
      parameters[i]?.push(hit.t);
      parameters[j]?.push(hit.u);
    }
  }

  const edges = new Map<string, readonly [Point, Point]>();
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (!segment) continue;
    const values = uniqueSorted(parameters[i] ?? [0, 1]);
    for (let k = 0; k + 1 < values.length; k += 1) {
      const start = values[k];
      const end = values[k + 1];
      if (start === undefined || end === undefined || end - start < 1e-9) continue;
      addUndirectedEdge(
        edges,
        lerp(segment[0], segment[1], start),
        lerp(segment[0], segment[1], end),
      );
    }
  }

  const nodes: Point[] = [];
  const nodeIndex = new Map<string, number>();
  const adjacency: number[][] = [];
  const indexOf = (point: Point): number => {
    const key = pointKey(point);
    const found = nodeIndex.get(key);
    if (found !== undefined) return found;
    const index = nodes.length;
    nodes.push(point);
    adjacency.push([]);
    nodeIndex.set(key, index);
    return index;
  };

  for (const [a, b] of edges.values()) {
    const ia = indexOf(a);
    const ib = indexOf(b);
    if (ia === ib) continue;
    adjacency[ia]?.push(ib);
    adjacency[ib]?.push(ia);
  }

  for (let i = 0; i < adjacency.length; i += 1) {
    const neighbors = adjacency[i];
    const origin = nodes[i];
    if (!neighbors || !origin) continue;
    const unique = [...new Set(neighbors)];
    unique.sort((a, b) => {
      const pa = nodes[a];
      const pb = nodes[b];
      if (!pa || !pb) return 0;
      return (
        Math.atan2(pa.y - origin.y, pa.x - origin.x) - Math.atan2(pb.y - origin.y, pb.x - origin.x)
      );
    });
    adjacency[i] = unique;
  }

  const visited = new Set<string>();
  const faces: Piece[] = [];
  for (let from = 0; from < adjacency.length; from += 1) {
    for (const to of adjacency[from] ?? []) {
      if (visited.has(`${from}>${to}`)) continue;
      const cycle: number[] = [];
      let currentFrom = from;
      let currentTo = to;
      let guard = 0;
      while (!visited.has(`${currentFrom}>${currentTo}`) && guard < adjacency.length * 4 + 16) {
        visited.add(`${currentFrom}>${currentTo}`);
        cycle.push(currentFrom);
        const neighbors = adjacency[currentTo] ?? [];
        const reverse = neighbors.indexOf(currentFrom);
        if (reverse < 0 || neighbors.length === 0) break;
        const next = neighbors[(reverse - 1 + neighbors.length) % neighbors.length];
        if (next === undefined) break;
        currentFrom = currentTo;
        currentTo = next;
        guard += 1;
      }

      if (cycle.length < 3) continue;
      const points = cycle
        .map((index) => nodes[index])
        .filter((point): point is Point => point !== undefined);
      if (points.length < 3) continue;
      const area = signedArea(points);
      if (area <= EPS) continue;
      if (!pointInPolygon(interiorPoint(points), outline)) continue;
      faces.push({
        points,
        area,
        centroid: polygonCentroid(points),
      });
    }
  }

  if (faces.length === 0) {
    return [{ points: outline, area: polygonArea(outline), centroid: polygonCentroid(outline) }];
  }
  return faces;
}

function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  const wrapped = angle % twoPi;
  return wrapped < 0 ? wrapped + twoPi : wrapped;
}

function arcPoints(center: Point, radius: number, start: number, end: number): Point[] {
  const delta = end - start;
  const steps = Math.max(2, Math.ceil(Math.abs(delta) / (Math.PI / 36)));
  const points: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = start + (delta * i) / steps;
    points.push({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
  }
  return points;
}

/** 원의 방사형 절단. 각 부채꼴 넓이는 (각/2)·r²로 정확히 계산한다. */
export function circleSectors(center: Point, radius: number, cuts: readonly Cut[]): Piece[] {
  const angles: number[] = [];
  for (const cut of cuts) {
    const endpoint = cut.points[1];
    const angle = normalizeAngle(Math.atan2(endpoint.y - center.y, endpoint.x - center.x));
    if (!angles.some((value) => Math.abs(value - angle) < 1e-9)) angles.push(angle);
  }
  angles.sort((a, b) => a - b);

  if (angles.length < 2) {
    return [
      {
        points: circleOutline(center, radius),
        area: Math.PI * radius * radius,
        centroid: { ...center },
      },
    ];
  }

  const pieces: Piece[] = [];
  for (let i = 0; i < angles.length; i += 1) {
    const start = angles[i];
    const endpoint =
      i === angles.length - 1 ? (angles[0] ?? 0) + Math.PI * 2 : (angles[i + 1] ?? 0);
    if (start === undefined) continue;
    const delta = endpoint - start;
    if (delta <= 1e-9) continue;
    const points = [{ ...center }, ...arcPoints(center, radius, start, endpoint)];
    pieces.push({
      points,
      area: (radius * radius * delta) / 2,
      centroid: polygonCentroid(points),
    });
  }
  return pieces;
}

function sortPieces(pieces: readonly Piece[], shape: FractionShape): Piece[] {
  const center = CIRCLE_CENTER;
  return [...pieces].sort((a, b) => {
    if (shape === 'circle') {
      const angleA = Math.atan2(a.centroid.y - center.y, a.centroid.x - center.x);
      const angleB = Math.atan2(b.centroid.y - center.y, b.centroid.x - center.x);
      return angleA - angleB;
    }
    if (Math.abs(a.centroid.y - b.centroid.y) > 1) return a.centroid.y - b.centroid.y;
    return a.centroid.x - b.centroid.x;
  });
}

export function partitionPieces(
  outline: readonly Point[],
  cuts: readonly Cut[],
  shape: FractionShape,
): Piece[] {
  if (shape === 'circle' && cuts.length > 0 && cuts.every((cut) => cut.tool === 'radial')) {
    return circleSectors(CIRCLE_CENTER, CIRCLE_RADIUS, cuts);
  }
  if (cuts.length === 0) {
    return [
      {
        points: outline,
        area: shape === 'circle' ? Math.PI * CIRCLE_RADIUS * CIRCLE_RADIUS : polygonArea(outline),
        centroid: shape === 'circle' ? { ...CIRCLE_CENTER } : polygonCentroid(outline),
      },
    ];
  }
  const faces = planarFaces(
    outline,
    cuts.map((cut) => cut.points),
  );
  return sortPieces(faces, shape);
}

/** 조각 넓이가 모두 같은지. 조각 수만으로 판정하지 않는다. */
export function piecesAreEqual(pieces: readonly Piece[], tolerance: number): boolean {
  if (pieces.length === 0) return false;
  const areas = pieces.map((piece) => piece.area);
  const min = Math.min(...areas);
  const max = Math.max(...areas);
  const average = areas.reduce((sum, area) => sum + area, 0) / areas.length;
  if (average <= EPS) return false;
  return (max - min) / average <= tolerance;
}

/** 절단 방식 비교용 정규화 문자열. 순서가 달라도 같은 절단이면 같은 문자열이다. */
export function cutSignature(cuts: readonly Cut[]): string {
  const parts = cuts.map((cut) => {
    if (cut.tool === 'radial') {
      const endpoint = cut.points[1];
      return `radial:${endpoint.x.toFixed(1)},${endpoint.y.toFixed(1)}`;
    }
    const [first, second] = cut.points;
    const a = first.x < second.x || (first.x === second.x && first.y <= second.y) ? first : second;
    const b = a === first ? second : first;
    return `line:${a.x.toFixed(1)},${a.y.toFixed(1)}-${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  });
  return parts.sort().join(';');
}

/**
 * 칼선의 방향을 0°(가로)·45°·90°(세로)·135° 네 묶음으로 센다.
 *
 * 방향은 선분의 양 끝을 바꿔도 같으므로 0°~180°로 접어서 본다.
 * 아주 짧은 칼선은 방향을 정할 수 없어 세지 않는다.
 */
export function cutDirectionBucket(cut: Cut): 0 | 1 | 2 | 3 | null {
  const [from, to] = cut.points;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) return null;
  const degrees = ((((Math.atan2(dy, dx) * 180) / Math.PI) % 180) + 180) % 180;
  if (degrees < 22.5 || degrees >= 157.5) return 0;
  if (degrees < 67.5) return 1;
  if (degrees < 112.5) return 2;
  return 3;
}

/** 칼선 방향 묶음이 몇 가지인지. */
export function cutDirectionCount(cuts: readonly Cut[]): number {
  const buckets = new Set<number>();
  for (const cut of cuts) {
    const bucket = cutDirectionBucket(cut);
    if (bucket !== null) buckets.add(bucket);
  }
  return buckets.size;
}

/** 조각의 대표점(색칠·힌트 위치). */
export function pieceCentroid(piece: Piece): Point {
  return piece.centroid;
}
