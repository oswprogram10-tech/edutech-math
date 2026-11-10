/**
 * `a + b√d` 꼴의 정확한 수. `a`·`b`는 Rational이고 `d`는 2 또는 3이다.
 *
 * 칠교의 45° 회전은 √2, 패턴 블록의 정삼각형·30° 회전은 √3을 만든다.
 * 화면 좌표로 바꿀 때만 `sToNumber`를 쓴다. 판정은 언제나 이 정확한 값으로 한다.
 */
import { Rational } from '../../../core/math';

export type SurdD = 2 | 3;

export interface Surd {
  readonly a: Rational;
  readonly b: Rational;
  readonly d: SurdD;
}

export type SurdJson = readonly [string, string];

export function sOf(a: Rational, b: Rational = Rational.of(0), d: SurdD = 2): Surd {
  return { a, b, d };
}

export function sInt(value: number, d: SurdD = 2): Surd {
  return sOf(Rational.of(value), Rational.of(0), d);
}

export function sZero(d: SurdD = 2): Surd {
  return sInt(0, d);
}

export function sOne(d: SurdD = 2): Surd {
  return sInt(1, d);
}

function sameD(x: Surd, y: Surd): void {
  if (x.d !== y.d) throw new Error(`서로 다른 √${x.d}·√${y.d} 수는 더할 수 없습니다.`);
}

export function sAdd(x: Surd, y: Surd): Surd {
  sameD(x, y);
  return sOf(x.a.add(y.a), x.b.add(y.b), x.d);
}

export function sSub(x: Surd, y: Surd): Surd {
  sameD(x, y);
  return sOf(x.a.sub(y.a), x.b.sub(y.b), x.d);
}

export function sMul(x: Surd, y: Surd): Surd {
  sameD(x, y);
  return sOf(
    x.a.mul(y.a).add(x.b.mul(y.b).mul(Rational.of(x.d))),
    x.a.mul(y.b).add(x.b.mul(y.a)),
    x.d,
  );
}

export function sDiv(x: Surd, y: Surd): Surd {
  sameD(x, y);
  const denominator = y.a.mul(y.a).sub(y.b.mul(y.b).mul(Rational.of(x.d)));
  if (denominator.isZero()) throw new Error('0으로 나눌 수 없습니다.');
  return sOf(
    x.a
      .mul(y.a)
      .sub(x.b.mul(y.b).mul(Rational.of(x.d)))
      .div(denominator),
    x.b.mul(y.a).sub(x.a.mul(y.b)).div(denominator),
    x.d,
  );
}

export function sNeg(x: Surd): Surd {
  return sOf(x.a.neg(), x.b.neg(), x.d);
}

/** `a + b√d`의 부호. 두 항의 부호가 다르면 `a²`와 `d·b²`를 비교한다. */
export function sSign(x: Surd): -1 | 0 | 1 {
  if (x.b.isZero()) return x.a.isZero() ? 0 : x.a.isNegative() ? -1 : 1;
  if (x.a.isZero()) return x.b.isNegative() ? -1 : 1;
  if (x.a.isNegative() === x.b.isNegative()) return x.a.isNegative() ? -1 : 1;
  const a2 = x.a.mul(x.a);
  const db2 = x.b.mul(x.b).mul(Rational.of(x.d));
  const comparison = a2.compareTo(db2);
  return comparison === 0
    ? 0
    : comparison > 0
      ? x.a.isNegative()
        ? -1
        : 1
      : x.b.isNegative()
        ? -1
        : 1;
}

export function sCompare(x: Surd, y: Surd): -1 | 0 | 1 {
  return sSign(sSub(x, y));
}

export function sEquals(x: Surd, y: Surd): boolean {
  return x.d === y.d && x.a.equals(y.a) && x.b.equals(y.b);
}

export function sIsZero(x: Surd): boolean {
  return x.a.isZero() && x.b.isZero();
}

export function sAbs(x: Surd): Surd {
  return sSign(x) < 0 ? sNeg(x) : x;
}

/** 화면 좌표 전용. 수학 판정에는 쓰지 않는다. */
export function sToNumber(x: Surd): number {
  return Number(x.a.n) / Number(x.a.d) + (Number(x.b.n) / Number(x.b.d)) * Math.sqrt(x.d);
}

export function sToJson(x: Surd): SurdJson {
  return [x.a.toString(), x.b.toString()];
}

export function sFromJson(json: SurdJson, d: SurdD): Surd {
  const [a, b] = json;
  return sOf(Rational.parse(a), Rational.parse(b), d);
}

export function sToString(x: Surd): string {
  const a = x.a.toString();
  if (x.b.isZero()) return a;
  return `${a} + ${x.b.toString()}√${x.d}`;
}
