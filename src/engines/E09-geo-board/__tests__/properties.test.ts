/**
 * E09 성질 계산 테스트(T101).
 *
 * 카드 결정 4의 대표 사례를 고정한다. 이름은 Observation·이벤트 전용이지만
 * 계산 결과는 여기서 직접 확인한다.
 */
import { describe, expect, it } from 'vitest';
import { gp, makeSurd, Rational, toSPoint } from '../../../core/math';
import type { GPoint, SPoint } from '../../../core/math';
import { figureProperties, propertyKeys, propertiesOfGPolygon } from '../properties';
import type { FigureProps } from '../properties';

function sp(x: number, y: number): SPoint {
  return toSPoint(gp(x, y));
}

function shape(points: readonly SPoint[]): FigureProps {
  const props = figureProperties(points);
  if (!props) throw new Error('성질을 계산하지 못했다');
  return props;
}

function polygon(points: readonly GPoint[]): FigureProps {
  const props = propertiesOfGPolygon(points);
  if (!props) throw new Error('성질을 계산하지 못했다');
  return props;
}

describe('properties: 도형 성질', () => {
  it('직각삼각형은 rightAngles 1이고 right-triangle 이름을 가진다', () => {
    const props = shape([sp(0, 0), sp(3, 0), sp(0, 4)]);
    expect(props.rightAngles).toBe(1);
    expect(props.acuteAngles).toBe(2);
    expect(props.names).toContain('triangle');
    expect(props.names).toContain('right-triangle');
    expect(props.names).toContain('scalene');
    expect(props.names).not.toContain('isosceles');
  });

  it('2×3 직사각형은 equalSides 2·rightAngles 4이고 square가 아니다', () => {
    const props = polygon([gp(0, 0), gp(2, 0), gp(2, 3), gp(0, 3)]);
    expect(props.equalSides).toBe(2);
    expect(props.rightAngles).toBe(4);
    expect(props.parallelPairs).toBe(2);
    expect(props.names).toContain('rectangle');
    expect(props.names).not.toContain('square');
    expect(props.names).toContain('parallelogram');
    expect(props.names).toContain('trapezoid');
  });

  it('기울어진 정사각형은 square·rhombus·rectangle·parallelogram·trapezoid다', () => {
    const props = polygon([gp(0, 0), gp(2, 1), gp(1, 3), gp(-1, 2)]);
    for (const name of ['square', 'rhombus', 'rectangle', 'parallelogram', 'trapezoid']) {
      expect(props.names).toContain(name);
    }
    expect(props.regular).toBe(true);
    expect(props.convex).toBe(true);
    const keys = propertyKeys(props);
    expect(keys).toContain('diagonals-bisect');
    expect(keys).toContain('diagonals-equal');
    expect(keys).toContain('diagonals-perpendicular');
  });

  it('오목 사각형은 reflexAngles 1·convex false다', () => {
    const props = polygon([gp(0, 0), gp(4, 0), gp(2, 1), gp(0, 4)]);
    expect(props.reflexAngles).toBe(1);
    expect(props.convex).toBe(false);
    expect(props.angles).toContain('reflex');
  });

  it('평행사변형은 trapezoid 이름을 포함한다(포함 정의)', () => {
    const props = polygon([gp(0, 0), gp(4, 0), gp(5, 2), gp(1, 2)]);
    expect(props.parallelPairs).toBe(2);
    expect(props.names).toContain('parallelogram');
    expect(props.names).toContain('trapezoid');
  });

  it('정삼각형 SPoint(√3)은 equilateral·isosceles이고 equal-angles-3 키를 가진다', () => {
    const height = makeSurd(Rational.of(0), Rational.of(1), Rational.of(3));
    const props = shape([sp(0, 0), sp(2, 0), { x: toSPoint(gp(1, 0)).x, y: height }]);
    expect(props.equalSides).toBe(3);
    expect(props.equalAngles).toBe(3);
    expect(props.names).toContain('equilateral');
    expect(props.names).toContain('isosceles');
    expect(propertyKeys(props)).toContain('equal-angles-3');
    expect(props.regular).toBe(true);
  });

  it('서로 다른 근호가 섞인 도형은 성질을 알 수 없어 null이다', () => {
    const root2 = makeSurd(Rational.of(0), Rational.of(1), Rational.of(2));
    const root3 = makeSurd(Rational.of(0), Rational.of(1), Rational.of(3));
    const points: SPoint[] = [
      { x: root2, y: toSPoint(gp(0, 0)).y },
      { x: root3, y: toSPoint(gp(0, 0)).y },
      sp(0, 2),
    ];
    expect(figureProperties(points)).toBeNull();
  });

  it('꼭짓점이 3개 미만이거나 넓이가 0이면 null이다', () => {
    expect(figureProperties([sp(0, 0), sp(1, 1)])).toBeNull();
    expect(figureProperties([sp(0, 0), sp(1, 0), sp(2, 0)])).toBeNull();
  });
});
