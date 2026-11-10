/**
 * T107 `a + b√d` 정확 계산 테스트.
 *
 * 45°는 √2, 30°는 √3을 만들므로 부동소수 대신 이 타입으로만 판정한다.
 */
import { describe, expect, it } from 'vitest';
import { Rational } from '../../../core/math';
import { kindDefinition, orientedBase } from '../tangram/pieces';
import { sPolygonArea, sRotate } from '../tangram/surd-geometry';
import {
  sAdd,
  sCompare,
  sDiv,
  sEquals,
  sFromJson,
  sInt,
  sMul,
  sOf,
  sSign,
  sSub,
  sToJson,
} from '../tangram/surd';
import type { SPoint } from '../tangram/surd-geometry';

const root2 = sOf(Rational.of(0), Rational.of(1), 2);
const root3 = sOf(Rational.of(0), Rational.of(1), 3);

describe('Surd 부호와 사칙연산', () => {
  it('sSign(1 − √2) = −1', () => {
    expect(sSign(sSub(sInt(1), root2))).toBe(-1);
  });

  it('sSign(3 − 2√2) = 1', () => {
    expect(sSign(sSub(sInt(3), sMul(sInt(2), root2)))).toBe(1);
  });

  it('(1 + √2)(1 − √2) = −1', () => {
    const product = sMul(sAdd(sInt(1), root2), sSub(sInt(1), root2));
    expect(sEquals(product, sInt(-1))).toBe(true);
  });

  it('나누기 뒤 곱하면 제자리', () => {
    const x = sAdd(sInt(1), root2);
    const y = sSub(sInt(3), root2);
    const back = sMul(sDiv(x, y), y);
    expect(sEquals(back, x)).toBe(true);
  });

  it('JSON으로 왕복해도 같은 수', () => {
    const x = sAdd(sOf(Rational.of(1, 3), Rational.of(-2, 5), 2), root2);
    const restored = sFromJson(sToJson(x), 2);
    expect(sEquals(restored, x)).toBe(true);
  });

  it('√3/2는 Rational 433/500보다 크다', () => {
    const half = sDiv(root3, sInt(2, 3));
    expect(sCompare(half, sOf(Rational.of(433, 500), Rational.of(0), 3))).toBe(1);
  });
});

describe('Surd 회전은 제자리로 돌아온다', () => {
  it('45°로 8번 돌리면 제자리', () => {
    const start: SPoint = { x: sInt(1, 2), y: sInt(2, 2) };
    let point = start;
    for (let index = 0; index < 8; index += 1) point = sRotate(point, 1, 45);
    expect(sEquals(point.x, start.x)).toBe(true);
    expect(sEquals(point.y, start.y)).toBe(true);
  });

  it('30°로 12번 돌리면 제자리', () => {
    const start: SPoint = { x: sInt(1, 3), y: sInt(2, 3) };
    let point = start;
    for (let index = 0; index < 12; index += 1) point = sRotate(point, 1, 30);
    expect(sEquals(point.x, start.x)).toBe(true);
    expect(sEquals(point.y, start.y)).toBe(true);
  });

  it('45° 돌린 작은 세모의 넓이는 1', () => {
    const def = kindDefinition('tangram', 'small-triangle');
    expect(def).not.toBeNull();
    if (!def) return;
    const rotated = orientedBase(def, 1, false, 45);
    expect(sEquals(sPolygonArea(rotated), sInt(1))).toBe(true);
  });
});
