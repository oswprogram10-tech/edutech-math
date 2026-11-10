/**
 * `Surd` 좌표용 기하 도우미. `src/core/math/geometry.ts`의 알고리즘을 그대로
 * 옮기되 부동소수를 쓰지 않는다. 화면으로 보낼 때만 `sToNumber`를 쓴다.
 */
import { Rational } from '../../../core/math';
import type { Surd, SurdD } from './surd';
import {
  sAbs,
  sAdd,
  sCompare,
  sDiv,
  sEquals,
  sInt,
  sIsZero,
  sMul,
  sNeg,
  sOf,
  sSign,
  sSub,
  sZero,
} from './surd';

export interface SPoint {
  readonly x: Surd;
  readonly y: Surd;
}

export function sp(x: Surd, y: Surd): SPoint {
  return { x, y };
}

export function sameSPoint(a: SPoint, b: SPoint): boolean {
  return sEquals(a.x, b.x) && sEquals(a.y, b.y);
}

export function sVSub(a: SPoint, b: SPoint): SPoint {
  return { x: sSub(a.x, b.x), y: sSub(a.y, b.y) };
}

export function sDot(u: SPoint, v: SPoint): Surd {
  return sAdd(sMul(u.x, v.x), sMul(u.y, v.y));
}

export function sCross(u: SPoint, v: SPoint): Surd {
  return sSub(sMul(u.x, v.y), sMul(u.y, v.x));
}

export function sOrientation(a: SPoint, b: SPoint, c: SPoint): -1 | 0 | 1 {
  return sSign(sCross(sVSub(b, a), sVSub(c, a)));
}

function sSignedDoubleArea(points: readonly SPoint[]): Surd {
  if (points.length === 0) return sZero();
  const d = points[0]?.x.d ?? 2;
  let total = sZero(d);
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) continue;
    total = sAdd(total, sSub(sMul(current.x, next.y), sMul(current.y, next.x)));
  }
  return total;
}

export function sPolygonArea(points: readonly SPoint[]): Surd {
  return sAbs(sDiv(sSignedDoubleArea(points), sInt(2, points[0]?.x.d ?? 2)));
}

function rotationCosSin(k: number, step: number, d: SurdD): { readonly c: Surd; readonly s: Surd } {
  if (step === 45) {
    const half2 = sOf(Rational.of(0), Rational.of(1, 2), d);
    const index = ((Math.trunc(k) % 8) + 8) % 8;
    switch (index) {
      case 0:
        return { c: sInt(1, d), s: sZero(d) };
      case 1:
        return { c: half2, s: half2 };
      case 2:
        return { c: sZero(d), s: sInt(1, d) };
      case 3:
        return { c: sNeg(half2), s: half2 };
      case 4:
        return { c: sInt(-1, d), s: sZero(d) };
      case 5:
        return { c: sNeg(half2), s: sNeg(half2) };
      case 6:
        return { c: sZero(d), s: sInt(-1, d) };
      default:
        return { c: half2, s: sNeg(half2) };
    }
  }
  if (step === 30) {
    const half3 = sOf(sZero(d).a, Rational.of(1, 2), d);
    const half = sOf(Rational.of(1, 2), Rational.of(0), d);
    const halfNeg = sOf(Rational.of(-1, 2), Rational.of(0), d);
    const index = ((Math.trunc(k) % 12) + 12) % 12;
    switch (index) {
      case 0:
        return { c: sInt(1, d), s: sZero(d) };
      case 1:
        return { c: half3, s: half };
      case 2:
        return { c: half, s: half3 };
      case 3:
        return { c: sZero(d), s: sInt(1, d) };
      case 4:
        return { c: halfNeg, s: half3 };
      case 5:
        return { c: sNeg(half3), s: half };
      case 6:
        return { c: sInt(-1, d), s: sZero(d) };
      case 7:
        return { c: sNeg(half3), s: sNeg(half) };
      case 8:
        return { c: halfNeg, s: sNeg(half3) };
      case 9:
        return { c: sZero(d), s: sInt(-1, d) };
      case 10:
        return { c: half, s: sNeg(half3) };
      default:
        return { c: half3, s: sNeg(half) };
    }
  }
  if (step === 60) {
    // 60° 표는 30° 표에서 두 칸씩 읽는다.
    return rotationCosSin(k * 2, 30, d);
  }
  const index = ((Math.trunc(k) % 4) + 4) % 4;
  switch (index) {
    case 0:
      return { c: sInt(1, d), s: sZero(d) };
    case 1:
      return { c: sZero(d), s: sInt(1, d) };
    case 2:
      return { c: sInt(-1, d), s: sZero(d) };
    default:
      return { c: sZero(d), s: sInt(-1, d) };
  }
}

/** 원점 기준으로 `k·step`도 돌린다. y가 아래쪽이라 화면에서는 시계 방향이다. */
export function sRotate(p: SPoint, k: number, step: number, d: SurdD = p.x.d): SPoint {
  const { c, s } = rotationCosSin(k, step, d);
  return {
    x: sSub(sMul(p.x, c), sMul(p.y, s)),
    y: sAdd(sMul(p.x, s), sMul(p.y, c)),
  };
}

function comparePoints(a: SPoint, b: SPoint): number {
  const x = sCompare(a.x, b.x);
  return x !== 0 ? x : sCompare(a.y, b.y);
}

export function sConvexHull(points: readonly SPoint[]): SPoint[] {
  const unique: SPoint[] = [];
  for (const point of points) {
    if (!unique.some((existing) => sameSPoint(existing, point))) unique.push(point);
  }
  unique.sort(comparePoints);
  if (unique.length <= 2) return unique;

  const lower: SPoint[] = [];
  for (const point of unique) {
    while (lower.length >= 2) {
      const first = lower[lower.length - 2];
      const second = lower[lower.length - 1];
      if (!first || !second) break;
      if (sSign(sCross(sVSub(second, first), sVSub(point, first))) > 0) break;
      lower.pop();
    }
    lower.push(point);
  }

  const upper: SPoint[] = [];
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index];
    if (!point) continue;
    while (upper.length >= 2) {
      const first = upper[upper.length - 2];
      const second = upper[upper.length - 1];
      if (!first || !second) break;
      if (sSign(sCross(sVSub(second, first), sVSub(point, first))) > 0) break;
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  const hull = [...lower, ...upper];
  if (hull.length < 3 || sIsZero(sPolygonArea(hull))) {
    return hull.length >= 3 ? hull.slice(0, 2) : hull;
  }
  return hull;
}

function lineSide(a: SPoint, b: SPoint, p: SPoint): Surd {
  return sCross(sVSub(b, a), sVSub(p, a));
}

function segmentLineIntersection(p: SPoint, q: SPoint, a: SPoint, b: SPoint): SPoint {
  const fp = lineSide(a, b, p);
  const fq = lineSide(a, b, q);
  const denominator = sSub(fp, fq);
  if (sIsZero(denominator)) return p;
  const t = sDiv(fp, denominator);
  return {
    x: sAdd(p.x, sMul(t, sSub(q.x, p.x))),
    y: sAdd(p.y, sMul(t, sSub(q.y, p.y))),
  };
}

function cleaned(points: readonly SPoint[]): SPoint[] {
  const result: SPoint[] = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (last && sameSPoint(last, point)) continue;
    result.push(point);
  }
  if (result.length > 1) {
    const first = result[0];
    const last = result[result.length - 1];
    if (first && last && sameSPoint(first, last)) result.pop();
  }
  return result;
}

/** 볼록 다각형 두 개의 교집합(Sutherland–Hodgman). 넓이가 0이면 `[]`. */
export function sClipConvex(subject: readonly SPoint[], clip: readonly SPoint[]): SPoint[] {
  const clipPoints = cleaned(clip);
  const sign = sSign(sSignedDoubleArea(clipPoints));
  if (sign === 0) return [];
  let output = cleaned(subject);
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
      const currentInside = sSign(lineSide(a, b, current)) * sign >= 0;
      const previousInside = sSign(lineSide(a, b, previous)) * sign >= 0;
      if (currentInside) {
        if (!previousInside) output.push(segmentLineIntersection(previous, current, a, b));
        output.push(current);
      } else if (previousInside) {
        output.push(segmentLineIntersection(previous, current, a, b));
      }
    }
    if (output.length === 0) return [];
  }

  const result = cleaned(output);
  if (result.length < 3 || sIsZero(sPolygonArea(result))) return [];
  return result;
}

function pointOnSegment(p: SPoint, a: SPoint, b: SPoint): boolean {
  if (sOrientation(a, b, p) !== 0) return false;
  const withinX =
    (sCompare(p.x, a.x) >= 0 && sCompare(p.x, b.x) <= 0) ||
    (sCompare(p.x, b.x) >= 0 && sCompare(p.x, a.x) <= 0);
  const withinY =
    (sCompare(p.y, a.y) >= 0 && sCompare(p.y, b.y) <= 0) ||
    (sCompare(p.y, b.y) >= 0 && sCompare(p.y, a.y) <= 0);
  return withinX && withinY;
}

/** 점이 다각형의 안쪽·변 위·바깥쪽 중 어디인지. */
export function sLocatePoint(
  p: SPoint,
  polygon: readonly SPoint[],
): 'inside' | 'boundary' | 'outside' {
  const points = cleaned(polygon);
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
    const above = sCompare(a.y, p.y) > 0;
    const below = sCompare(b.y, p.y) > 0;
    if (above === below) continue;
    const t = sDiv(sSub(p.y, a.y), sSub(b.y, a.y));
    const x = sAdd(a.x, sMul(t, sSub(b.x, a.x)));
    if (sCompare(x, p.x) > 0) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}

export function sAverage(points: readonly SPoint[]): SPoint {
  const d = points[0]?.x.d ?? 2;
  if (points.length === 0) return { x: sZero(d), y: sZero(d) };
  let x = sZero(d);
  let y = sZero(d);
  for (const point of points) {
    x = sAdd(x, point.x);
    y = sAdd(y, point.y);
  }
  const count = sInt(points.length, d);
  return { x: sDiv(x, count), y: sDiv(y, count) };
}

export function sDistance2(a: SPoint, b: SPoint): Surd {
  return sDot(sVSub(a, b), sVSub(a, b));
}

export function sNegPoint(point: SPoint): SPoint {
  return { x: sNeg(point.x), y: sNeg(point.y) };
}
