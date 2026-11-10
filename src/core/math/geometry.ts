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

// ── T105 ──

/** 정사각 격자(`euclid`)와 삼각 격자(`hex`, 축 좌표)의 거리 규칙. */
export type PlaneMetric = 'euclid' | 'hex';

/** 두 점 거리의 제곱. `hex`는 축 좌표 `dx² + dx·dy + dy²`다. */
export function metricDist2(a: GPoint, b: GPoint, metric: PlaneMetric): Rational {
  const dx = a.x.sub(b.x);
  const dy = a.y.sub(b.y);
  const square = dx.mul(dx).add(dy.mul(dy));
  if (metric === 'euclid') return square;
  return square.add(dx.mul(dy));
}

/**
 * `q`가 직선 `ab`에 대한 `p`의 거울상인지.
 *
 * `a`·`b`까지의 거리²가 각각 같고 방향 부호가 반대면 된다. 두 원의 교점은
 * 많아야 둘이고 서로 직선 `ab`의 거울상이므로 이 판정은 정확하다. 둘 다
 * 일직선 위에 있으면 같은 점이어야 한다.
 */
export function isMirrorPair(
  p: GPoint,
  q: GPoint,
  a: GPoint,
  b: GPoint,
  metric: PlaneMetric,
): boolean {
  if (!metricDist2(p, a, metric).equals(metricDist2(q, a, metric))) return false;
  if (!metricDist2(p, b, metric).equals(metricDist2(q, b, metric))) return false;
  const first = orientation(a, b, p);
  const second = orientation(a, b, q);
  if (first === 0 && second === 0) return samePoint(p, q);
  return first === -second;
}

function matchingMap(
  points: readonly GPoint[],
  candidate: (index: number) => number[],
  step: 1 | -1,
): boolean {
  const count = points.length;
  const map = new Array<number>(count).fill(-1);
  const used = new Array<boolean>(count).fill(false);
  const solve = (index: number): boolean => {
    if (index === count) {
      for (let at = 0; at < count; at += 1) {
        const current = map[at];
        const next = map[(at + 1) % count];
        if (current === undefined || next === undefined) return false;
        if (next !== (current + step + count) % count) return false;
      }
      return true;
    }
    for (const target of candidate(index)) {
      if (used[target]) continue;
      used[target] = true;
      map[index] = target;
      if (solve(index + 1)) return true;
      used[target] = false;
      map[index] = -1;
    }
    return false;
  };
  return solve(0);
}

/**
 * 다각형이 직선 `ab`에 대해 선대칭인지. 꼭짓점마다 거울상 꼭짓점을 찾고,
 * 일대일 대응이면서 `map(i+1) ≡ map(i) − 1 (mod n)`(거울은 순서를 뒤집는다)일 때 참이다.
 */
export function polygonMirrorSymmetric(
  points: readonly GPoint[],
  a: GPoint,
  b: GPoint,
  metric: PlaneMetric,
): boolean {
  if (samePoint(a, b)) return false;
  const polygon = simplifyPolygon(points);
  if (polygon.length < 3) return false;
  return matchingMap(
    polygon,
    (index) => {
      const point = polygon[index];
      if (!point) return [];
      const result: number[] = [];
      polygon.forEach((other, candidate) => {
        if (isMirrorPair(point, other, a, b, metric)) result.push(candidate);
      });
      return result;
    },
    -1,
  );
}

/** 점 `center`에 대한 180° 회전(점대칭). `2·center − p`다. */
export function pointReflect(p: GPoint, center: GPoint): GPoint {
  return {
    x: center.x.mul(Rational.of(2)).sub(p.x),
    y: center.y.mul(Rational.of(2)).sub(p.y),
  };
}

/**
 * 다각형이 점 `center`에 대해 점대칭인지. 각 꼭짓점의 점대칭 점이 꼭짓점이고
 * `map(i+1) ≡ map(i) + 1 (mod n)`(180° 회전은 순서를 보존한다)일 때 참이다.
 */
export function polygonPointSymmetric(points: readonly GPoint[], center: GPoint): boolean {
  const polygon = simplifyPolygon(points);
  if (polygon.length < 3) return false;
  return matchingMap(
    polygon,
    (index) => {
      const point = polygon[index];
      if (!point) return [];
      const reflected = pointReflect(point, center);
      const result: number[] = [];
      polygon.forEach((other, candidate) => {
        if (samePoint(reflected, other)) result.push(candidate);
      });
      return result;
    },
    1,
  );
}

/** 두 꼭짓점 열이 시작점 회전·역순까지 같으면 같은 다각형이다. */
export function samePolygon(p: readonly GPoint[], q: readonly GPoint[]): boolean {
  const first = simplifyPolygon(p);
  const second = simplifyPolygon(q);
  if (first.length < 3 || second.length < 3) return false;
  if (first.length !== second.length) return false;
  const count = first.length;
  const matches = (candidate: readonly GPoint[]): boolean => {
    for (let offset = 0; offset < count; offset += 1) {
      let same = true;
      for (let index = 0; index < count; index += 1) {
        const a = first[index];
        const b = candidate[(index + offset) % count];
        if (!a || !b || !samePoint(a, b)) {
          same = false;
          break;
        }
      }
      if (same) return true;
    }
    return false;
  };
  return matches(second) || matches([...second].reverse());
}

/** 유클리드 직선 `ab`에 대한 거울상. 두 점이 같으면 그 점을 그대로 돌려준다. */
export function reflectPoint(p: GPoint, a: GPoint, b: GPoint): GPoint {
  const direction = vsub(b, a);
  const squared = dot(direction, direction);
  if (squared.isZero()) return p;
  const projection = dot(vsub(p, a), direction).div(squared);
  const foot = {
    x: a.x.add(direction.x.mul(projection)),
    y: a.y.add(direction.y.mul(projection)),
  };
  return {
    x: foot.x.mul(Rational.of(2)).sub(p.x),
    y: foot.y.mul(Rational.of(2)).sub(p.y),
  };
}

function bigAbs(value: bigint): bigint {
  return value < BigInt(0) ? -value : value;
}

function bigGcd(a: bigint, b: bigint): bigint {
  let left = bigAbs(a);
  let right = bigAbs(b);
  while (right !== BigInt(0)) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
}

function bigLcm(a: bigint, b: bigint): bigint {
  if (a === BigInt(0) || b === BigInt(0)) return BigInt(0);
  return bigAbs((a / bigGcd(a, b)) * b);
}

/**
 * 직선 `A·x + B·y = C`의 정수 계수를 최대공약수로 나누고, `A`(0이면 `B`)가
 * 양수가 되게 정규화한 `"A,B,C"` 키. 같은 직선이면 두 점이 달라도 키가 같다.
 */
export function lineKey(a: GPoint, b: GPoint): string {
  const dx = b.x.sub(a.x);
  const dy = b.y.sub(a.y);
  const normalA = dy;
  const normalB = dx.neg();
  const constant = normalA.mul(a.x).add(normalB.mul(a.y));
  if (normalA.isZero() && normalB.isZero()) return '0,0,0';

  const scale = bigLcm(bigLcm(normalA.d, normalB.d), constant.d);
  let intA = normalA.n * (scale / normalA.d);
  let intB = normalB.n * (scale / normalB.d);
  let intC = constant.n * (scale / constant.d);
  const divisor = bigGcd(bigGcd(intA, intB), intC);
  if (divisor !== BigInt(1) && divisor !== BigInt(0)) {
    intA /= divisor;
    intB /= divisor;
    intC /= divisor;
  }
  if (intA < BigInt(0) || (intA === BigInt(0) && intB < BigInt(0))) {
    intA = -intA;
    intB = -intB;
    intC = -intC;
  }
  return `${intA.toString()},${intB.toString()},${intC.toString()}`;
}
