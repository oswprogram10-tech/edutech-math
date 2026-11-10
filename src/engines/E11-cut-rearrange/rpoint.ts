/**
 * E11의 유리수 점 표현.
 *
 * 상태·Action에는 화면 좌표를 저장하지 않는다. `RPoint`는 `Rational.toJSON()`이
 * 돌려주는 정규 문자열 쌍이고, 수학 계산은 `core/math/geometry`의 `GPoint`로 한다.
 */
import { Rational, gp } from '../../core/math';
import type { GPoint } from '../../core/math';

export type RPoint = readonly [string, string];

export function toG(point: RPoint): GPoint {
  return { x: Rational.parse(point[0]), y: Rational.parse(point[1]) };
}

export function fromG(point: GPoint): RPoint {
  return [point.x.toJSON(), point.y.toJSON()];
}

/** 정수 격자 점 하나. 정수가 아니면 `Rational.of`가 오류를 낸다(개발 중 실수를 잡는다). */
export function rp(x: number, y: number): RPoint {
  return [Rational.of(x).toJSON(), Rational.of(y).toJSON()];
}

export function rpointOf(x: Rational, y: Rational): RPoint {
  return [x.toJSON(), y.toJSON()];
}

/** Action·설정에서 온 값을 정확한 점으로 바꾼다. 형식이 틀리면 null. */
export function parseRPoint(value: unknown): RPoint | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = value[0];
  const y = value[1];
  if (typeof x !== 'string' || typeof y !== 'string') return null;
  try {
    return [Rational.parse(x).toJSON(), Rational.parse(y).toJSON()];
  } catch {
    return null;
  }
}

export function sameRPoint(a: RPoint, b: RPoint): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function pointKey(point: RPoint): string {
  return `${point[0]},${point[1]}`;
}

export function addRPoint(point: RPoint, by: RPoint): RPoint {
  const a = toG(point);
  const b = toG(by);
  return fromG({ x: a.x.add(b.x), y: a.y.add(b.y) });
}

export function averageOfRPoints(points: readonly RPoint[]): GPoint {
  if (points.length === 0) return gp(0, 0);
  let x = Rational.of(0);
  let y = Rational.of(0);
  for (const point of points) {
    const g = toG(point);
    x = x.add(g.x);
    y = y.add(g.y);
  }
  const count = Rational.of(points.length);
  return { x: x.div(count), y: y.div(count) };
}
