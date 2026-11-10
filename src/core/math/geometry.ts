/**
 * 정확한 평면 기하 도우미(E09·E10·E11·E17 공용).
 *
 * 모든 수학 값은 `Rational`이고 number 연산은 쓰지 않는다. 길이는 제곱(`dist2`)으로
 * 비교하고, 각은 내적의 부호와 외적이 0인지로 판정한다.
 */
import { Rational } from './rational';

export interface GPoint {
  readonly x: Rational;
  readonly y: Rational;
}

/** 정수 좌표로 점을 만든다. */
export function gp(x: bigint | number, y: bigint | number): GPoint {
  return { x: Rational.of(x), y: Rational.of(y) };
}

export function samePoint(a: GPoint, b: GPoint): boolean {
  return a.x.equals(b.x) && a.y.equals(b.y);
}

/** `a − b` */
export function vsub(a: GPoint, b: GPoint): GPoint {
  return { x: a.x.sub(b.x), y: a.y.sub(b.y) };
}

export function dot(u: GPoint, v: GPoint): Rational {
  return u.x.mul(v.x).add(u.y.mul(v.y));
}

export function cross(u: GPoint, v: GPoint): Rational {
  return u.x.mul(v.y).sub(u.y.mul(v.x));
}

/** 길이의 제곱. 길이 자체가 필요하면 제곱끼리 비교한다. */
export function dist2(a: GPoint, b: GPoint): Rational {
  return dot(vsub(a, b), vsub(a, b));
}

/** 세 점이 이루는 방향. 반시계 1, 일직선 0, 시계 -1. */
export function orientation(a: GPoint, b: GPoint, c: GPoint): -1 | 0 | 1 {
  const value = cross(vsub(b, a), vsub(c, a));
  if (value.isZero()) return 0;
  return value.isNegative() ? -1 : 1;
}

export function collinear(a: GPoint, b: GPoint, c: GPoint): boolean {
  return orientation(a, b, c) === 0;
}

function between(value: Rational, first: Rational, second: Rational): boolean {
  const low = first.compareTo(second) <= 0 ? first : second;
  const high = first.compareTo(second) <= 0 ? second : first;
  return value.compareTo(low) >= 0 && value.compareTo(high) <= 0;
}

function insideBox(p: GPoint, a: GPoint, b: GPoint): boolean {
  return between(p.x, a.x, b.x) && between(p.y, a.y, b.y);
}

/** 선분 위(양 끝점 포함). */
export function pointOnSegment(p: GPoint, a: GPoint, b: GPoint): boolean {
  if (samePoint(a, b)) return samePoint(p, a);
  return collinear(a, b, p) && insideBox(p, a, b);
}

/** `origin`에서 `through` 쪽으로 뻗는 반직선 위(시작점 포함). */
export function pointOnRay(p: GPoint, origin: GPoint, through: GPoint): boolean {
  if (samePoint(origin, through)) return samePoint(p, origin);
  if (!collinear(origin, through, p)) return false;
  return dot(vsub(p, origin), vsub(through, origin)).compareTo(Rational.of(0)) >= 0;
}

/** 두 점을 지나는 직선 위. 두 점이 같으면 그 점만 직선으로 본다. */
export function pointOnLine(p: GPoint, a: GPoint, b: GPoint): boolean {
  if (samePoint(a, b)) return samePoint(p, a);
  return collinear(a, b, p);
}

/**
 * 두 선분이 만나는지. 끝점이 닿는 경우도 true다.
 * 일직선으로 겹치는 경우도 true다.
 */
export function segmentsIntersect(a: GPoint, b: GPoint, c: GPoint, d: GPoint): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 === 0 && pointOnSegment(c, a, b)) return true;
  if (o2 === 0 && pointOnSegment(d, a, b)) return true;
  if (o3 === 0 && pointOnSegment(a, c, d)) return true;
  if (o4 === 0 && pointOnSegment(b, c, d)) return true;

  return o1 !== o2 && o3 !== o4;
}

/**
 * 이어진 같은 점을 지우고, 꺾이지 않는 점(앞뒤 점과 한 직선 위)을 지운다.
 * 첫 점과 끝 점이 같으면 하나로 본다. 점이 3개보다 적어지지 않게 멈춘다.
 */
export function simplifyPolygon(points: readonly GPoint[]): GPoint[] {
  const cleaned: GPoint[] = [];
  for (const point of points) {
    const last = cleaned[cleaned.length - 1];
    if (last && samePoint(last, point)) continue;
    cleaned.push(point);
  }
  if (cleaned.length > 1) {
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if (first && last && samePoint(first, last)) cleaned.pop();
  }

  let result = cleaned;
  while (result.length > 3) {
    let removed = false;
    for (let index = 0; index < result.length; index += 1) {
      const previous = result[(index - 1 + result.length) % result.length];
      const current = result[index];
      const next = result[(index + 1) % result.length];
      if (!previous || !current || !next) continue;
      if (samePoint(previous, current) || samePoint(current, next)) {
        result = result.filter((_, candidate) => candidate !== index);
        removed = true;
        break;
      }
      if (collinear(previous, current, next)) {
        result = result.filter((_, candidate) => candidate !== index);
        removed = true;
        break;
      }
    }
    if (!removed) break;
  }
  return result;
}

function signedDoubleArea(points: readonly GPoint[]): Rational {
  let total = Rational.of(0);
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) continue;
    total = total.add(current.x.mul(next.y).sub(current.y.mul(next.x)));
  }
  return total;
}

/** 신발끈 공식의 절댓값. 일직선이면 0이다. */
export function polygonArea(points: readonly GPoint[]): Rational {
  return signedDoubleArea(points).abs().div(Rational.of(2));
}

/**
 * 단순 다각형인지. 점 3개 이상, 이웃하지 않는 변끼리 만나지 않음, 넓이가 0이 아님.
 * 판정 전에 `simplifyPolygon`을 적용한다.
 */
export function isSimplePolygon(points: readonly GPoint[]): boolean {
  const polygon = simplifyPolygon(points);
  if (polygon.length < 3) return false;
  if (polygonArea(polygon).isZero()) return false;
  const count = polygon.length;
  for (let first = 0; first < count; first += 1) {
    const a = polygon[first];
    const b = polygon[(first + 1) % count];
    if (!a || !b) continue;
    for (let second = first + 1; second < count; second += 1) {
      const adjacent = second === first + 1 || (first === 0 && second === count - 1);
      if (adjacent) continue;
      const c = polygon[second];
      const d = polygon[(second + 1) % count];
      if (!c || !d) continue;
      if (segmentsIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

/** `a − vertex`와 `b − vertex`가 이루는 각이 직각인지. */
export function isRightAngle(a: GPoint, vertex: GPoint, b: GPoint): boolean {
  return dot(vsub(a, vertex), vsub(b, vertex)).isZero();
}

export type AngleKind = 'acute' | 'right' | 'obtuse' | 'straight';

/** 내적의 부호와 외적이 0인지로 각의 종류를 정한다. */
export function angleKind(a: GPoint, vertex: GPoint, b: GPoint): AngleKind {
  const first = vsub(a, vertex);
  const second = vsub(b, vertex);
  const product = dot(first, second);
  if (product.isZero()) return 'right';
  if (product.isNegative()) {
    return cross(first, second).isZero() ? 'straight' : 'obtuse';
  }
  return 'acute';
}

/** 다각형의 진행 방향(부호 있는 넓이의 부호). */
function polygonOrientation(points: readonly GPoint[]): -1 | 0 | 1 {
  const area = signedDoubleArea(points);
  if (area.isZero()) return 0;
  return area.isNegative() ? -1 : 1;
}

interface VertexSignature {
  readonly edge2: Rational;
  readonly innerDot: Rational;
  readonly turn: -1 | 0 | 1;
}

function signatureOf(points: readonly GPoint[]): VertexSignature[] | null {
  const sign = polygonOrientation(points);
  if (sign === 0) return null;
  const count = points.length;
  const signature: VertexSignature[] = [];
  for (let index = 0; index < count; index += 1) {
    const previous = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];
    if (!previous || !current || !next) return null;
    signature.push({
      edge2: dist2(current, next),
      innerDot: dot(vsub(previous, current), vsub(next, current)),
      // 다각형 방향을 기준으로 정규화해 뒤집기·역순에서도 같은 값이 되게 한다.
      turn: (orientation(previous, current, next) * sign) as -1 | 0 | 1,
    });
  }
  return signature;
}

function sameSignature(a: VertexSignature, b: VertexSignature): boolean {
  return a.edge2.equals(b.edge2) && a.innerDot.equals(b.innerDot) && a.turn === b.turn;
}

function sameSequence(a: readonly VertexSignature[], b: readonly VertexSignature[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return other !== undefined && sameSignature(entry, other);
  });
}

function rotationsMatch(
  target: readonly VertexSignature[],
  candidate: readonly VertexSignature[],
): boolean {
  if (target.length !== candidate.length) return false;
  for (let offset = 0; offset < candidate.length; offset += 1) {
    const rotated: VertexSignature[] = [];
    for (let index = 0; index < candidate.length; index += 1) {
      const entry = candidate[(index + offset) % candidate.length];
      if (!entry) return false;
      rotated.push(entry);
    }
    if (sameSequence(target, rotated)) return true;
  }
  return false;
}

/**
 * 두 다각형이 합동인지. 단순화한 꼭짓점 서명(나가는 변 길이², 내적, 방향 기준 꺾임 부호)
 * 열을 비교하며 시작점 회전과 뒤집기(역순)를 모두 허용한다.
 */
export function congruentPolygons(p: readonly GPoint[], q: readonly GPoint[]): boolean {
  const first = simplifyPolygon(p);
  const second = simplifyPolygon(q);
  if (first.length < 3 || second.length < 3) return false;
  if (first.length !== second.length) return false;
  const firstSignature = signatureOf(first);
  const secondSignature = signatureOf(second);
  if (!firstSignature || !secondSignature) return false;
  if (rotationsMatch(firstSignature, secondSignature)) return true;
  const reversed = [...second].reverse();
  const reversedSignature = signatureOf(reversed);
  return reversedSignature !== null && rotationsMatch(firstSignature, reversedSignature);
}

// ── T106 ──

const HALF = Rational.of(2);
const TWO_TURNS = 4;

/** 두 점의 중점. */
export function midpoint(a: GPoint, b: GPoint): GPoint {
  return {
    x: a.x.add(b.x).div(HALF),
    y: a.y.add(b.y).div(HALF),
  };
}

/** `center`를 중심으로 90°씩 `turns`번 돌린 점. 네 번이면 제자리다. */
export function rotate90About(p: GPoint, center: GPoint, turns: number): GPoint {
  const count = ((Math.trunc(turns) % TWO_TURNS) + TWO_TURNS) % TWO_TURNS;
  let dx = p.x.sub(center.x);
  let dy = p.y.sub(center.y);
  for (let index = 0; index < count; index += 1) {
    const nextX = dy.neg();
    const nextY = dx;
    dx = nextX;
    dy = nextY;
  }
  return { x: center.x.add(dx), y: center.y.add(dy) };
}

/** `center`에 대한 점대칭(180° 회전). 두 번 하면 제자리다. */
export function pointReflect(p: GPoint, center: GPoint): GPoint {
  return {
    x: center.x.mul(Rational.of(2)).sub(p.x),
    y: center.y.mul(Rational.of(2)).sub(p.y),
  };
}

/** 점이 다각형의 안쪽·변 위(꼭짓점 포함)·바깥쪽 중 어디인지. 반직선 교차 수로 센다. */
export function locatePoint(
  p: GPoint,
  polygon: readonly GPoint[],
): 'inside' | 'boundary' | 'outside' {
  const points = simplifyPolygon(polygon);
  if (points.length < 3) return 'outside';
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (!a || !b) continue;
    if (pointOnSegment(p, a, b)) return 'boundary';
  }

  let inside = false;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (!a || !b) continue;
    const above = a.y.compareTo(p.y) > 0;
    const below = b.y.compareTo(p.y) > 0;
    if (above === below) continue;
    const t = p.y.sub(a.y).div(b.y.sub(a.y));
    const x = a.x.add(t.mul(b.x.sub(a.x)));
    if (x.compareTo(p.x) > 0) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}

/** 단순 다각형이고 모든 꺾임 부호가 같으면 볼록하다. */
export function isConvexPolygon(points: readonly GPoint[]): boolean {
  const polygon = simplifyPolygon(points);
  if (polygon.length < 3) return false;
  if (!isSimplePolygon(polygon)) return false;
  let sign: -1 | 0 | 1 = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const c = polygon[(index + 2) % polygon.length];
    if (!a || !b || !c) return false;
    const turn = orientation(a, b, c);
    if (turn === 0) return false;
    if (sign === 0) sign = turn;
    else if (sign !== turn) return false;
  }
  return true;
}

function comparePoints(a: GPoint, b: GPoint): number {
  const x = a.x.compareTo(b.x);
  return x !== 0 ? x : a.y.compareTo(b.y);
}

/** 볼록 껍질(반시계). 일직선 위의 점은 뺀다. 넓이가 0이면 점 3개 미만을 돌려준다. */
export function convexHull(points: readonly GPoint[]): GPoint[] {
  const unique: GPoint[] = [];
  for (const point of points) {
    if (!unique.some((existing) => samePoint(existing, point))) unique.push(point);
  }
  unique.sort(comparePoints);
  if (unique.length <= 2) return unique;

  const lower: GPoint[] = [];
  for (const point of unique) {
    while (lower.length >= 2) {
      const first = lower[lower.length - 2];
      const second = lower[lower.length - 1];
      if (!first || !second) break;
      if (cross(vsub(second, first), vsub(point, first)).compareTo(Rational.of(0)) > 0) break;
      lower.pop();
    }
    lower.push(point);
  }

  const upper: GPoint[] = [];
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index];
    if (!point) continue;
    while (upper.length >= 2) {
      const first = upper[upper.length - 2];
      const second = upper[upper.length - 1];
      if (!first || !second) break;
      if (cross(vsub(second, first), vsub(point, first)).compareTo(Rational.of(0)) > 0) break;
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  const hull = [...lower, ...upper];
  if (hull.length < 3 || polygonArea(hull).isZero()) {
    return hull.length >= 3 ? hull.slice(0, 2) : hull;
  }
  return hull;
}

function lineSide(a: GPoint, b: GPoint, p: GPoint): Rational {
  return cross(vsub(b, a), vsub(p, a));
}

function segmentLineIntersection(p: GPoint, q: GPoint, a: GPoint, b: GPoint): GPoint {
  const fp = lineSide(a, b, p);
  const fq = lineSide(a, b, q);
  const denominator = fp.sub(fq);
  if (denominator.isZero()) return p;
  const t = fp.div(denominator);
  return {
    x: p.x.add(t.mul(q.x.sub(p.x))),
    y: p.y.add(t.mul(q.y.sub(p.y))),
  };
}

/** 볼록 다각형 두 개의 교집합(Sutherland–Hodgman). 넓이가 0이면 `[]`. */
export function clipConvexPolygon(subject: readonly GPoint[], clip: readonly GPoint[]): GPoint[] {
  const clipPoints = simplifyPolygon(clip);
  const sign = polygonOrientation(clipPoints);
  if (sign === 0) return [];
  let output = simplifyPolygon(subject);
  if (output.length < 3) return [];

  for (let index = 0; index < clipPoints.length; index += 1) {
    const a = clipPoints[index];
    const b = clipPoints[(index + 1) % clipPoints.length];
    if (!a || !b) continue;
    const input = output;
    output = [];
    for (let position = 0; position < input.length; position += 1) {
      const current = input[position];
      const previous = input[(position - 1 + input.length) % input.length];
      if (!current || !previous) continue;
      const currentInside = lineSide(a, b, current).compareTo(Rational.of(0)) * sign >= 0;
      const previousInside = lineSide(a, b, previous).compareTo(Rational.of(0)) * sign >= 0;
      if (currentInside) {
        if (!previousInside) output.push(segmentLineIntersection(previous, current, a, b));
        output.push(current);
      } else if (previousInside) {
        output.push(segmentLineIntersection(previous, current, a, b));
      }
    }
    if (output.length === 0) return [];
  }

  const result = simplifyPolygon(output);
  if (result.length < 3 || polygonArea(result).isZero()) return [];
  return result;
}

function vertexIndex(points: readonly GPoint[], p: GPoint): number | null {
  const index = points.findIndex((point) => samePoint(point, p));
  return index >= 0 ? index : null;
}

function edgeIndex(points: readonly GPoint[], p: GPoint): number | null {
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (!a || !b) continue;
    if (pointOnSegment(p, a, b)) return index;
  }
  return null;
}

function walkBoundary(points: readonly GPoint[], from: GPoint, to: GPoint): GPoint[] | null {
  const startVertex = vertexIndex(points, from);
  const endVertex = vertexIndex(points, to);
  const startEdge = startVertex === null ? edgeIndex(points, from) : null;
  const endEdge = endVertex === null ? edgeIndex(points, to) : null;
  if (startVertex === null && startEdge === null) return null;
  if (endVertex === null && endEdge === null) return null;

  const result: GPoint[] = [from];
  let index: number;
  if (startVertex !== null) index = (startVertex + 1) % points.length;
  else if (startEdge !== null) index = (startEdge + 1) % points.length;
  else return null;
  for (let step = 0; step <= points.length; step += 1) {
    if (endVertex !== null) {
      const current = points[index];
      if (!current) return null;
      result.push(current);
      if (index === endVertex) return result;
    } else {
      if (index === endEdge) {
        const current = points[index];
        if (!current) return null;
        result.push(current);
        result.push(to);
        return result;
      }
      const current = points[index];
      if (!current) return null;
      result.push(current);
    }
    index = (index + 1) % points.length;
  }
  return null;
}

/**
 * 경계 위의 두 점 a·b를 잇는 현으로 다각형을 자른다.
 *
 * a·b가 서로 다르고 경계 위에 있으며, 같은 변 위가 아니고, 중점이 안쪽이고,
 * 선분 ab가 a·b 말고 경계와 만나지 않을 때만 자른다. 첫 조각은 a에서 꼭짓점
 * 순서대로 b까지, 둘째 조각은 b에서 a까지다. 아니면 null.
 */
export function splitPolygonByChord(
  points: readonly GPoint[],
  a: GPoint,
  b: GPoint,
): [GPoint[], GPoint[]] | null {
  const polygon = simplifyPolygon(points);
  if (polygon.length < 3) return null;
  if (samePoint(a, b)) return null;

  const vertexA = vertexIndex(polygon, a);
  const vertexB = vertexIndex(polygon, b);
  const edgeA = vertexA === null ? edgeIndex(polygon, a) : null;
  const edgeB = vertexB === null ? edgeIndex(polygon, b) : null;
  if (vertexA === null && edgeA === null) return null;
  if (vertexB === null && edgeB === null) return null;
  if (edgeA !== null && edgeA === edgeB) return null;
  if (vertexA !== null && vertexB !== null && (vertexA + 1) % polygon.length === vertexB) {
    return null;
  }
  if (vertexA !== null && vertexB !== null && (vertexB + 1) % polygon.length === vertexA) {
    return null;
  }

  const middle = midpoint(a, b);
  if (locatePoint(middle, polygon) !== 'inside') return null;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (!start || !end) continue;
    if (vertexA === null && index === edgeA) continue;
    if (vertexB === null && index === edgeB) continue;
    if (vertexA !== null && index === vertexA) continue;
    if (vertexA !== null && (index + 1) % polygon.length === vertexA) continue;
    if (vertexB !== null && index === vertexB) continue;
    if (vertexB !== null && (index + 1) % polygon.length === vertexB) continue;
    if (segmentsIntersect(a, b, start, end)) return null;
  }

  const first = walkBoundary(polygon, a, b);
  const second = walkBoundary(polygon, b, a);
  if (!first || !second) return null;
  const firstPolygon = simplifyPolygon(first);
  const secondPolygon = simplifyPolygon(second);
  if (firstPolygon.length < 3 || secondPolygon.length < 3) return null;
  if (polygonArea(firstPolygon).isZero() || polygonArea(secondPolygon).isZero()) return null;
  return [firstPolygon, secondPolygon];
}
