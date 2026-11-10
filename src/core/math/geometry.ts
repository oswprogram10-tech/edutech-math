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

// ── T101 ──
// 이차 무리수 `a + b√d`와 원·원 교점, 유리 회전. 모두 `Rational`로만 계산한다.

/** `a + b√d`. `b = 0`이면 유리수이고 `d`는 0이다. */
export interface Surd {
  readonly a: Rational;
  readonly b: Rational;
  readonly d: Rational;
}

/** 바닥 정수 제곱근. */
function integerSqrt(value: bigint): bigint {
  if (value <= 0n) return 0n;
  let x = value;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }
  return x;
}

/** `value = root² · rest`로 만들고 `rest`에서 작은 제곱 인수를 모두 뺀다. */
function extractSquare(value: bigint): { readonly root: bigint; readonly rest: bigint } {
  let rest = value;
  let root = 1n;
  for (let factor = 2n; factor * factor <= rest && factor <= 100000n; factor += 1n) {
    const square = factor * factor;
    while (rest % square === 0n) {
      rest /= square;
      root *= factor;
    }
  }
  return { root, rest };
}

/** `√d = coef·√rad`로 바꾼다. `d`가 음수면 null. */
function radicalOf(d: Rational): { readonly coef: Rational; readonly rad: bigint } | null {
  if (d.isNegative()) return null;
  if (d.isZero()) return { coef: Rational.of(0), rad: 1n };
  const { root, rest } = extractSquare(d.n * d.d);
  return { coef: Rational.of(root, d.d), rad: rest };
}

export function surdOf(a: Rational): Surd {
  return { a, b: Rational.of(0), d: Rational.of(0) };
}

/**
 * `a + b√d`. `b = 0`이거나 `d`가 유리수의 제곱이면 유리수로 접는다.
 * `d`는 0 이상이어야 한다(기하 계산에서 음수 근호는 쓰지 않는다).
 */
export function makeSurd(a: Rational, b: Rational, d: Rational): Surd {
  if (b.isZero() || d.isZero()) return surdOf(a);
  const radical = radicalOf(d);
  if (!radical) return surdOf(a);
  const coefficient = b.mul(radical.coef);
  if (coefficient.isZero()) return surdOf(a);
  if (radical.rad === 1n) return surdOf(a.add(coefficient));
  return { a, b: coefficient, d: Rational.of(radical.rad) };
}

/** 분자·분모가 완전제곱일 때만 정확한 제곱근을 돌려준다. */
export function rationalSqrt(r: Rational): Rational | null {
  if (r.isNegative()) return null;
  if (r.isZero()) return Rational.of(0);
  const numerator = integerSqrt(r.n);
  const denominator = integerSqrt(r.d);
  if (numerator * numerator !== r.n || denominator * denominator !== r.d) return null;
  return Rational.of(numerator, denominator);
}

/** 서로 다른 근호가 섞이면 null(하나의 `a + b√d`로 적을 수 없다). */
function combineSurds(terms: readonly Surd[]): Surd | null {
  let rational = Rational.of(0);
  let radicand: bigint | null = null;
  let coefficient = Rational.of(0);
  for (const term of terms) {
    rational = rational.add(term.a);
    if (term.b.isZero()) continue;
    const radical = radicalOf(term.d);
    if (!radical) return null;
    const value = term.b.mul(radical.coef);
    if (value.isZero()) continue;
    if (radical.rad === 1n) {
      rational = rational.add(value);
      continue;
    }
    if (radicand === null) {
      radicand = radical.rad;
      coefficient = value;
      continue;
    }
    if (radicand !== radical.rad) return null;
    coefficient = coefficient.add(value);
  }
  if (radicand === null || coefficient.isZero()) return surdOf(rational);
  return { a: rational, b: coefficient, d: Rational.of(radicand) };
}

export function surdAdd(x: Surd, y: Surd): Surd | null {
  return combineSurds([x, y]);
}

export function surdNeg(x: Surd): Surd {
  return { a: x.a.neg(), b: x.b.neg(), d: x.d };
}

export function surdSub(x: Surd, y: Surd): Surd | null {
  return combineSurds([x, surdNeg(y)]);
}

export function surdMul(x: Surd, y: Surd): Surd | null {
  const terms: Surd[] = [surdOf(x.a.mul(y.a))];
  if (!x.b.isZero()) terms.push(makeSurd(Rational.of(0), x.b.mul(y.a), x.d));
  if (!y.b.isZero()) terms.push(makeSurd(Rational.of(0), x.a.mul(y.b), y.d));
  if (!x.b.isZero() && !y.b.isZero()) {
    terms.push(makeSurd(Rational.of(0), x.b.mul(y.b), x.d.mul(y.d)));
  }
  return combineSurds(terms);
}

export function surdDiv(x: Surd, y: Surd): Surd | null {
  const denominator = y.a.mul(y.a).sub(y.b.mul(y.b).mul(y.d));
  if (denominator.isZero()) return null;
  const conjugate: Surd = { a: y.a, b: y.b.neg(), d: y.d };
  const numerator = surdMul(x, conjugate);
  if (!numerator) return null;
  return {
    a: numerator.a.div(denominator),
    b: numerator.b.div(denominator),
    d: numerator.d,
  };
}

/** `a + b√d`의 부호. 근호가 맞지 않아도 `a²`와 `b²d`를 비교해 정확히 정한다. */
export function surdSign(x: Surd): -1 | 0 | 1 {
  if (x.b.isZero()) return x.a.isZero() ? 0 : x.a.isNegative() ? -1 : 1;
  if (x.a.isZero()) return x.b.isNegative() ? -1 : 1;
  const aNegative = x.a.isNegative();
  const bNegative = x.b.isNegative();
  if (aNegative === bNegative) return aNegative ? -1 : 1;
  const compare = x.a.mul(x.a).compareTo(x.b.mul(x.b).mul(x.d));
  if (compare === 0) return 0;
  // a > 0, b < 0이면 a²와 b²d를 그대로 비교한다. a < 0, b > 0이면 부호가 뒤집힌다.
  if (!aNegative) return compare;
  return compare === 1 ? -1 : 1;
}

export function surdEquals(x: Surd, y: Surd): boolean {
  const first = combineSurds([x]);
  const second = combineSurds([y]);
  if (!first || !second) return false;
  return first.a.equals(second.a) && first.b.equals(second.b) && first.d.equals(second.d);
}

/** 무리수 좌표를 가질 수 있는 점. */
export interface SPoint {
  readonly x: Surd;
  readonly y: Surd;
}

export function toSPoint(p: GPoint): SPoint {
  return { x: surdOf(p.x), y: surdOf(p.y) };
}

export function sSub(p: SPoint, q: SPoint): SPoint | null {
  const x = surdSub(p.x, q.x);
  const y = surdSub(p.y, q.y);
  if (!x || !y) return null;
  return { x, y };
}

export function sDot(u: SPoint, v: SPoint): Surd | null {
  const first = surdMul(u.x, v.x);
  const second = surdMul(u.y, v.y);
  if (!first || !second) return null;
  return surdAdd(first, second);
}

export function sCross(u: SPoint, v: SPoint): Surd | null {
  const first = surdMul(u.x, v.y);
  const second = surdMul(u.y, v.x);
  if (!first || !second) return null;
  return surdSub(first, second);
}

export function sDist2(p: SPoint, q: SPoint): Surd | null {
  const difference = sSub(p, q);
  if (!difference) return null;
  return sDot(difference, difference);
}

/**
 * 두 원의 교점. `r1sq`·`r2sq`는 반지름의 제곱이다.
 * 0·1·2개이고 0번이 `+√s`, 1번이 `−√s`다. 중심이 같으면 [].
 */
export function circleCircleIntersections(
  c1: GPoint,
  r1sq: Rational,
  c2: GPoint,
  r2sq: Rational,
): SPoint[] {
  if (r1sq.isNegative() || r2sq.isNegative()) return [];
  const d2 = dist2(c1, c2);
  if (d2.isZero()) return [];
  const k = r1sq.sub(r2sq).add(d2).div(Rational.of(2).mul(d2));
  const s = r1sq.div(d2).sub(k.mul(k));
  if (s.isNegative() || s.isZero()) return [];
  const dx = c2.x.sub(c1.x);
  const dy = c2.y.sub(c1.y);
  const baseX = surdOf(c1.x.add(k.mul(dx)));
  const baseY = surdOf(c1.y.add(k.mul(dy)));
  const root: Surd = makeSurd(Rational.of(0), Rational.of(1), s);
  const offsetX = surdMul(root, surdOf(dy.neg()));
  const offsetY = surdMul(root, surdOf(dx));
  if (!offsetX || !offsetY) return [];
  const plusX = surdAdd(baseX, offsetX);
  const plusY = surdAdd(baseY, offsetY);
  const minusX = surdSub(baseX, offsetX);
  const minusY = surdSub(baseY, offsetY);
  if (!plusX || !plusY || !minusX || !minusY) return [];
  const plus: SPoint = { x: plusX, y: plusY };
  const minus: SPoint = { x: minusX, y: minusY };
  return [plus, minus];
}

/** 두 직선(두 점으로 정한다)의 교점. 평행하거나 퇴화하면 null. */
export function lineLineIntersection(
  p1: GPoint,
  p2: GPoint,
  q1: GPoint,
  q2: GPoint,
): GPoint | null {
  const u = vsub(p2, p1);
  const v = vsub(q2, q1);
  if ((u.x.isZero() && u.y.isZero()) || (v.x.isZero() && v.y.isZero())) return null;
  const denominator = cross(u, v);
  if (denominator.isZero()) return null;
  const t = cross(vsub(q1, p1), v).div(denominator);
  return { x: p1.x.add(t.mul(u.x)), y: p1.y.add(t.mul(u.y)) };
}

/** 각 `2·atan(t)`만큼 수학 방향(반시계)으로 회전한다. 길이²가 정확히 보존된다. */
export function rationalRotate(v: GPoint, t: Rational): GPoint {
  const t2 = t.mul(t);
  const denominator = Rational.of(1).add(t2);
  return {
    x: Rational.of(1).sub(t2).mul(v.x).sub(Rational.of(2).mul(t).mul(v.y)).div(denominator),
    y: Rational.of(2).mul(t).mul(v.x).add(Rational.of(1).sub(t2).mul(v.y)).div(denominator),
  };
}

/**
 * `dot·|dot| / (|u|²|w|²)`. 두 각(0°~180°)이 같은 것과 이 값이 같은 것은 동치다.
 * 퇴화한 각(변의 길이 0)은 0을 돌려준다.
 */
export function signedCos2(a: GPoint, vertex: GPoint, b: GPoint): Rational {
  const u = vsub(a, vertex);
  const w = vsub(b, vertex);
  const denominator = dot(u, u).mul(dot(w, w));
  if (denominator.isZero()) return Rational.of(0);
  const value = dot(u, w);
  return value.mul(value.abs()).div(denominator);
}

export function sSignedCos2(a: SPoint, vertex: SPoint, b: SPoint): Surd | null {
  const first = sSub(a, vertex);
  const second = sSub(b, vertex);
  if (!first || !second) return null;
  const value = sDot(first, second);
  if (!value) return null;
  const lengthFirst = sDot(first, first);
  const lengthSecond = sDot(second, second);
  if (!lengthFirst || !lengthSecond) return null;
  if (surdSign(lengthFirst) === 0 || surdSign(lengthSecond) === 0) return surdOf(Rational.of(0));
  const signed = surdSign(value) < 0 ? surdNeg(value) : value;
  const numerator = surdMul(value, signed);
  if (!numerator) return null;
  const step = surdDiv(numerator, lengthFirst);
  if (!step) return null;
  return surdDiv(step, lengthSecond);
}
