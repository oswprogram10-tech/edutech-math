import { describe, expect, it } from 'vitest';
import {
  angleKind,
  collinear,
  congruentPolygons,
  cross,
  dist2,
  dot,
  gp,
  isMirrorPair,
  isRightAngle,
  isSimplePolygon,
  lineKey,
  metricDist2,
  orientation,
  pointOnLine,
  pointOnRay,
  pointOnSegment,
  pointReflect,
  polygonArea,
  polygonMirrorSymmetric,
  polygonPointSymmetric,
  reflectPoint,
  samePolygon,
  segmentsIntersect,
  simplifyPolygon,
  vsub,
} from '../geometry';
import type { GPoint } from '../geometry';
import { Rational } from '../rational';

function points(coords: readonly (readonly [number, number])[]): GPoint[] {
  return coords.map(([x, y]) => gp(x, y));
}

function areaOf(coords: readonly (readonly [number, number])[]): string {
  return polygonArea(points(coords)).toString();
}

describe('geometry 기본 연산', () => {
  it('점·벡터·내적·외적·길이 제곱이 정확하다', () => {
    const a = gp(1, 2);
    const b = gp(4, 6);
    expect(a.x.equals(Rational.of(1))).toBe(true);
    expect(vsub(b, a)).toEqual({ x: Rational.of(3), y: Rational.of(4) });
    expect(dot(gp(2, 3), gp(-1, 5)).toString()).toBe('13');
    expect(cross(gp(2, 3), gp(-1, 5)).toString()).toBe('13');
    expect(dist2(a, b).toString()).toBe('25');
  });

  it('길이 0인 변이 있어도 터지지 않는다', () => {
    const a = gp(2, 2);
    expect(dist2(a, a).isZero()).toBe(true);
    expect(pointOnSegment(a, a, a)).toBe(true);
    expect(pointOnSegment(gp(2, 3), a, a)).toBe(false);
    expect(pointOnLine(gp(5, 5), a, a)).toBe(false);
  });
});

describe('geometry 방향·선분', () => {
  it('orientation은 반시계 1, 일직선 0, 시계 -1이다', () => {
    expect(orientation(gp(0, 0), gp(1, 0), gp(0, 1))).toBe(1);
    expect(orientation(gp(0, 0), gp(1, 0), gp(0, -1))).toBe(-1);
    expect(orientation(gp(0, 0), gp(1, 0), gp(2, 0))).toBe(0);
    expect(collinear(gp(0, 0), gp(2, 2), gp(5, 5))).toBe(true);
  });

  it('선분·반직선·직선 위 판정이 끝점과 방향을 맞게 본다', () => {
    const origin = gp(1, 1);
    const through = gp(3, 2);
    expect(pointOnSegment(origin, origin, through)).toBe(true);
    expect(pointOnSegment(through, origin, through)).toBe(true);
    expect(pointOnSegment(gp(5, 3), origin, through)).toBe(false);
    expect(pointOnRay(gp(5, 3), origin, through)).toBe(true);
    expect(pointOnRay(gp(-1, 0), origin, through)).toBe(false);
    expect(pointOnLine(gp(5, 3), origin, through)).toBe(true);
    expect(pointOnLine(gp(5, 4), origin, through)).toBe(false);
  });

  it('선분 교차는 끝점이 닿는 경우와 겹치는 경우도 true다', () => {
    expect(segmentsIntersect(gp(0, 0), gp(2, 2), gp(0, 2), gp(2, 0))).toBe(true);
    expect(segmentsIntersect(gp(0, 0), gp(1, 0), gp(1, 0), gp(2, 0))).toBe(true);
    expect(segmentsIntersect(gp(0, 0), gp(3, 0), gp(1, 0), gp(2, 0))).toBe(true);
    expect(segmentsIntersect(gp(0, 0), gp(1, 0), gp(0, 1), gp(1, 1))).toBe(false);
  });
});

describe('geometry 다각형', () => {
  it('일직선 세 점의 넓이는 0이고 단순 다각형이 아니다', () => {
    const line = points([
      [0, 0],
      [2, 0],
      [5, 0],
    ]);
    expect(
      areaOf([
        [0, 0],
        [2, 0],
        [5, 0],
      ]),
    ).toBe('0');
    expect(isSimplePolygon(line)).toBe(false);
  });

  it('기울어진 정사각형 (0,0)(2,1)(1,3)(−1,2)의 넓이는 5이고 네 각이 직각이다', () => {
    const square = points([
      [0, 0],
      [2, 1],
      [1, 3],
      [-1, 2],
    ]);
    expect(
      areaOf([
        [0, 0],
        [2, 1],
        [1, 3],
        [-1, 2],
      ]),
    ).toBe('5');
    for (let index = 0; index < 4; index += 1) {
      const previous = square[(index + 3) % 4];
      const current = square[index];
      const next = square[(index + 1) % 4];
      if (!previous || !current || !next) throw new Error('정사각형 점이 없습니다.');
      expect(isRightAngle(previous, current, next)).toBe(true);
      expect(angleKind(previous, current, next)).toBe('right');
    }
    expect(isSimplePolygon(square)).toBe(true);
    expect(simplifyPolygon(square)).toHaveLength(4);
  });

  it('일직선 위 점이 섞인 사각형을 단순화하면 꼭짓점 4개다', () => {
    const shape = points([
      [0, 0],
      [2, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ]);
    expect(shape).toHaveLength(5);
    const simplified = simplifyPolygon(shape);
    expect(simplified).toHaveLength(4);
    expect(
      areaOf([
        [0, 0],
        [2, 0],
        [4, 0],
        [4, 3],
        [0, 3],
      ]),
    ).toBe('12');
  });

  it('첫 점과 끝 점이 같으면 하나로 보고, 이어진 같은 점도 지운다', () => {
    const simplified = simplifyPolygon(
      points([
        [0, 0],
        [2, 0],
        [2, 0],
        [2, 2],
        [0, 2],
        [0, 0],
      ]),
    );
    expect(simplified).toHaveLength(4);
  });

  it('꼬인 사각형(나비 모양)은 단순 다각형이 아니다', () => {
    const bowtie = points([
      [0, 0],
      [2, 2],
      [0, 2],
      [2, 0],
    ]);
    expect(isSimplePolygon(bowtie)).toBe(false);
  });

  it('좌표 10⁹ 큰 수에서도 넓이와 단순성을 정확히 본다', () => {
    const big = 1_000_000_000;
    const square = points([
      [big, big],
      [big + 3, big],
      [big + 3, big + 3],
      [big, big + 3],
    ]);
    expect(polygonArea(square).toString()).toBe('9');
    expect(isSimplePolygon(square)).toBe(true);
    expect(dist2(gp(big, big), gp(big + 3, big + 4)).toString()).toBe('25');
  });
});

describe('geometry 합동', () => {
  it('거울상 L자는 합동이다', () => {
    const left = points([
      [0, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [1, 2],
      [0, 2],
    ]);
    const right = points([
      [0, 0],
      [-2, 0],
      [-2, 1],
      [-1, 1],
      [-1, 2],
      [0, 2],
    ]);
    expect(congruentPolygons(left, right)).toBe(true);
  });

  it('시작점을 돌려도 합동이고, 넓이가 같아도 모양이 다르면 합동이 아니다', () => {
    const square = points([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ]);
    const rotated = points([
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ]);
    expect(congruentPolygons(square, rotated)).toBe(true);

    const rectangle = points([
      [0, 0],
      [4, 0],
      [4, 1],
      [0, 1],
    ]);
    expect(polygonArea(square).equals(polygonArea(rectangle))).toBe(true);
    expect(congruentPolygons(square, rectangle)).toBe(false);
  });

  it('일직선 위 점이 섞여도 단순화한 뒤 합동을 본다', () => {
    const plain = points([
      [0, 0],
      [3, 0],
      [3, 2],
      [0, 2],
    ]);
    const extra = points([
      [0, 0],
      [1, 0],
      [3, 0],
      [3, 2],
      [0, 2],
    ]);
    expect(congruentPolygons(plain, extra)).toBe(true);
  });
});

describe('geometry 각', () => {
  it('직각·예각·둔각·평각을 구분한다', () => {
    expect(angleKind(gp(1, 0), gp(0, 0), gp(0, 1))).toBe('right');
    expect(angleKind(gp(1, 0), gp(0, 0), gp(1, 1))).toBe('acute');
    expect(angleKind(gp(1, 0), gp(0, 0), gp(-1, 1))).toBe('obtuse');
    expect(angleKind(gp(1, 0), gp(0, 0), gp(-1, 0))).toBe('straight');
    expect(angleKind(gp(1, 0), gp(0, 0), gp(2, 0))).toBe('acute');
  });
});

describe('geometry T105 선대칭·점대칭', () => {
  const rectangle = points([
    [2, 3],
    [6, 3],
    [6, 5],
    [2, 5],
  ]);

  it('직사각형은 x=4, y=4 축에 선대칭이고 대각선에는 아니다', () => {
    expect(polygonMirrorSymmetric(rectangle, gp(4, 0), gp(4, 1), 'euclid')).toBe(true);
    expect(polygonMirrorSymmetric(rectangle, gp(0, 4), gp(1, 4), 'euclid')).toBe(true);
    expect(polygonMirrorSymmetric(rectangle, gp(2, 3), gp(6, 5), 'euclid')).toBe(false);
    // 같은 축을 다른 두 점으로 그어도 결과가 같다.
    expect(polygonMirrorSymmetric(rectangle, gp(4, 7), gp(4, 9), 'euclid')).toBe(true);
  });

  it('평행사변형은 선대칭이 아니고 중심 (4, 9/2)에 점대칭이다', () => {
    const parallelogram = points([
      [3, 3],
      [7, 3],
      [5, 6],
      [1, 6],
    ]);
    expect(polygonMirrorSymmetric(parallelogram, gp(4, 0), gp(4, 1), 'euclid')).toBe(false);
    expect(polygonMirrorSymmetric(parallelogram, gp(2, 3), gp(6, 6), 'euclid')).toBe(false);
    const center = { x: Rational.of(4), y: Rational.of(9, 2) };
    expect(polygonPointSymmetric(parallelogram, center)).toBe(true);
    expect(polygonPointSymmetric(parallelogram, gp(4, 4))).toBe(false);
  });

  it('삼각 격자 정육각형은 축 6개 모두 참이고 다른 선은 거짓이다', () => {
    const hexagon = points([
      [6, 3],
      [4, 5],
      [2, 5],
      [2, 3],
      [4, 1],
      [6, 1],
    ]);
    const directions: readonly (readonly [number, number])[] = [
      [1, 0],
      [0, 1],
      [-1, 1],
      [1, 1],
      [-1, 2],
      [-2, 1],
    ];
    for (const [dx, dy] of directions) {
      expect(polygonMirrorSymmetric(hexagon, gp(4, 3), gp(4 + dx, 3 + dy), 'hex')).toBe(true);
    }
    expect(polygonMirrorSymmetric(hexagon, gp(6, 3), gp(5, 4), 'hex')).toBe(false);
  });

  it('isMirrorPair와 pointReflect가 정확히 짝을 찾는다', () => {
    expect(isMirrorPair(gp(1, 4), gp(7, 4), gp(4, 0), gp(4, 1), 'euclid')).toBe(true);
    expect(isMirrorPair(gp(1, 4), gp(6, 4), gp(4, 0), gp(4, 1), 'euclid')).toBe(false);
    expect(isMirrorPair(gp(0, 2), gp(0, 2), gp(0, 0), gp(0, 1), 'euclid')).toBe(true);
    expect(pointReflect(gp(1, 2), gp(4, 5))).toEqual(gp(7, 8));
  });

  it('metricDist2가 두 격자 규칙을 구분한다', () => {
    expect(metricDist2(gp(0, 0), gp(3, 4), 'euclid').toString()).toBe('25');
    expect(metricDist2(gp(0, 0), gp(1, 1), 'hex').toString()).toBe('3');
  });

  it('lineKey는 같은 직선을 같은 키로 만든다', () => {
    expect(lineKey(gp(0, 0), gp(2, 2))).toBe(lineKey(gp(1, 1), gp(3, 3)));
    expect(lineKey(gp(0, 0), gp(2, 0))).not.toBe(lineKey(gp(0, 0), gp(0, 2)));
    expect(lineKey(gp(2, 3), gp(6, 5))).toBe(lineKey(gp(6, 5), gp(2, 3)));
  });

  it('reflectPoint는 유클리드 직선에 대한 거울상이다', () => {
    expect(reflectPoint(gp(1, 4), gp(4, 0), gp(4, 1))).toEqual(gp(7, 4));
    expect(reflectPoint(gp(1, 1), gp(0, 0), gp(1, 1))).toEqual(gp(1, 1));
  });

  it('samePolygon은 시작점 회전과 역순을 허용하고 한 점이 다르면 거짓이다', () => {
    const square = points([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ]);
    const rotated = points([
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ]);
    const reversed = points([
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 0],
    ]);
    const different = points([
      [0, 0],
      [2, 0],
      [2, 2],
      [1, 2],
    ]);
    expect(samePolygon(square, rotated)).toBe(true);
    expect(samePolygon(square, reversed)).toBe(true);
    expect(samePolygon(square, different)).toBe(false);
  });

  it('좌표 10⁹와 넓이 0 다각형에서도 예외 없이 판정한다', () => {
    const big = 1_000_000_000;
    const square = points([
      [big, big],
      [big + 4, big],
      [big + 4, big + 4],
      [big, big + 4],
    ]);
    expect(polygonMirrorSymmetric(square, gp(big + 2, 0), gp(big + 2, 1), 'euclid')).toBe(true);
    expect(metricDist2(gp(big, big), gp(big + 3, big + 4), 'euclid').toString()).toBe('25');
    const line = points([
      [0, 0],
      [2, 0],
      [5, 0],
    ]);
    expect(polygonMirrorSymmetric(line, gp(0, 1), gp(1, 1), 'euclid')).toBe(false);
    expect(polygonPointSymmetric(line, gp(0, 0))).toBe(false);
  });
});
