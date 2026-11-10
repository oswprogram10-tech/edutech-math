import { describe, expect, it } from 'vitest';
import {
  angleKind,
  circleCircleIntersections,
  collinear,
  congruentPolygons,
  cross,
  dist2,
  dot,
  gp,
  isRightAngle,
  isSimplePolygon,
  lineLineIntersection,
  makeSurd,
  orientation,
  pointOnLine,
  pointOnRay,
  pointOnSegment,
  polygonArea,
  rationalRotate,
  rationalSqrt,
  sSignedCos2,
  segmentsIntersect,
  simplifyPolygon,
  surdAdd,
  surdEquals,
  surdMul,
  surdSign,
  surdSub,
  surdOf,
  toSPoint,
  vsub,
  isMirrorPair,
  lineKey,
  metricDist2,
  pointReflect,
  polygonMirrorSymmetric,
  polygonPointSymmetric,
  reflectPoint,
  samePolygon,
  clipConvexPolygon,
  convexHull,
  isConvexPolygon,
  locatePoint,
  midpoint,
  rotate90About,
  splitPolygonByChord,
  angleKindScaled,
  compareAngles,
  dist2Scaled,
  dotScaled,
  parallel,
} from '../geometry';
import type { GPoint, SPoint } from '../geometry';
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

describe('geometry T101 무리수·교점·회전', () => {
  const r = (n: number, d = 1) => Rational.of(n, d);

  it('1 − √2 < 0이고 √3·√3 = 3이다', () => {
    const root2 = makeSurd(r(0), r(1), r(2));
    const value = surdSub(surdOf(r(1)), root2);
    expect(value).not.toBeNull();
    if (!value) return;
    expect(surdSign(value)).toBe(-1);
    const root3 = makeSurd(r(0), r(1), r(3));
    expect(surdMul(root3, root3)?.a.toString()).toBe('3');
    expect(surdSign(surdMul(root3, root3) ?? surdOf(r(0)))).toBe(1);
  });

  it('√8과 2√2를 같은 근호로 맞춘다', () => {
    const root8 = makeSurd(r(0), r(1), r(8));
    const twiceRoot2 = makeSurd(r(0), r(2), r(2));
    expect(surdEquals(root8, twiceRoot2)).toBe(true);
    expect(root8.d.toString()).toBe('2');
    expect(root8.b.toString()).toBe('2');
  });

  it('√2 + √3은 하나의 근호로 적을 수 없어 null이다', () => {
    const root2 = makeSurd(r(0), r(1), r(2));
    const root3 = makeSurd(r(0), r(1), r(3));
    expect(surdAdd(root2, root3)).toBeNull();
    expect(surdEquals(root2, root3)).toBe(false);
  });

  it('두 원의 교점 (1, ±√3)과 접함·떨어짐·같은 중심을 정확히 센다', () => {
    const points = circleCircleIntersections(gp(0, 0), r(4), gp(2, 0), r(4));
    expect(points).toHaveLength(2);
    const [plus, minus] = points;
    expect(plus?.x.a.toString()).toBe('1');
    expect(plus?.y.a.toString()).toBe('0');
    expect(plus?.y.b.toString()).toBe('1');
    expect(plus?.y.d.toString()).toBe('3');
    expect(minus?.y.b.toString()).toBe('-1');

    const touching = circleCircleIntersections(gp(0, 0), r(1), gp(2, 0), r(1));
    expect(touching).toEqual([]);

    expect(circleCircleIntersections(gp(0, 0), r(1), gp(5, 0), r(1))).toEqual([]);
    expect(circleCircleIntersections(gp(1, 1), r(1), gp(1, 1), r(4))).toEqual([]);
  });

  it('rationalRotate((1,0), 1) = (0,1)이고 큰 수에서도 길이²가 보존된다', () => {
    const turned = rationalRotate(gp(1, 0), r(1));
    expect(turned.x.toString()).toBe('0');
    expect(turned.y.toString()).toBe('1');

    const big = gp(1_000_000_000, -1_000_000_000);
    const rotated = rationalRotate(big, r(3, 4));
    expect(dist2(big, gp(0, 0)).equals(dist2(rotated, gp(0, 0)))).toBe(true);
  });

  it('평행선 교점은 null이고, 정삼각형 두 각의 sSignedCos2가 같다', () => {
    expect(lineLineIntersection(gp(0, 0), gp(2, 0), gp(0, 1), gp(2, 1))).toBeNull();
    const crossing = lineLineIntersection(gp(0, 0), gp(2, 0), gp(1, -1), gp(1, 1));
    expect(crossing?.x.toString()).toBe('1');
    expect(crossing?.y.toString()).toBe('0');

    // 한 변이 2인 정삼각형: (0,0), (2,0), (1, √3).
    const base = toSPoint(gp(0, 0));
    const other = toSPoint(gp(2, 0));
    const top = toSPoint(gp(1, 0));
    const apex: SPoint = { x: top.x, y: makeSurd(r(0), r(1), r(3)) };
    const first = sSignedCos2(base, other, apex);
    const second = sSignedCos2(other, apex, base);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first && second ? surdEquals(first, second) : false).toBe(true);
  });

  it('분모가 완전제곱일 때만 rationalSqrt가 값을 준다', () => {
    expect(rationalSqrt(r(9, 16))?.toString()).toBe('3/4');
    expect(rationalSqrt(r(8))).toBeNull();
    expect(rationalSqrt(r(-4))).toBeNull();
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

// ── T106 ──
describe('T106 기하 도우미', () => {
  it('locatePoint가 안·변·꼭짓점·밖을 구분한다', () => {
    const square = points([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ]);
    expect(locatePoint(gp(1, 1), square)).toBe('inside');
    expect(locatePoint(gp(1, 0), square)).toBe('boundary');
    expect(locatePoint(gp(0, 0), square)).toBe('boundary');
    expect(locatePoint(gp(3, 1), square)).toBe('outside');
    expect(locatePoint(gp(-1, -1), square)).toBe('outside');
  });

  it('isConvexPolygon은 정사각형은 true, L자는 false, 일직선 점이 섞여도 true다', () => {
    const square = points([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ]);
    const withExtra = points([
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ]);
    const lShape = points([
      [0, 0],
      [3, 0],
      [3, 1],
      [1, 1],
      [1, 3],
      [0, 3],
    ]);
    expect(isConvexPolygon(square)).toBe(true);
    expect(isConvexPolygon(withExtra)).toBe(true);
    expect(isConvexPolygon(lShape)).toBe(false);
  });

  it('convexHull은 안쪽 점과 일직선 점을 빼고, 모두 일직선이면 점 3개 미만이다', () => {
    const hull = convexHull(
      points([
        [1, 1],
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
        [1, 0],
      ]),
    );
    expect(hull).toHaveLength(4);
    const line = convexHull(
      points([
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 3],
      ]),
    );
    expect(line.length).toBeLessThan(3);
  });

  it('clipConvexPolygon은 겹친 두 정사각형 넓이 1, 변만 닿으면 []다', () => {
    const first = points([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ]);
    const second = points([
      [1, 1],
      [3, 1],
      [3, 3],
      [1, 3],
    ]);
    const overlap = clipConvexPolygon(first, second);
    expect(overlap.length).toBeGreaterThanOrEqual(3);
    expect(polygonArea(overlap).toString()).toBe('1');

    const touching = points([
      [2, 0],
      [4, 0],
      [4, 2],
      [2, 2],
    ]);
    expect(clipConvexPolygon(first, touching)).toEqual([]);
  });

  it('splitPolygonByChord는 평행사변형 높이선을 넓이 4와 20으로 자른다', () => {
    const parallelogram = points([
      [4, 2],
      [10, 2],
      [8, 6],
      [2, 6],
    ]);
    const split = splitPolygonByChord(parallelogram, gp(4, 2), gp(4, 6));
    expect(split).not.toBeNull();
    if (!split) return;
    const areas = split.map((piece) => polygonArea(piece).toString()).sort();
    expect(areas).toEqual(['20', '4']);
  });

  it('splitPolygonByChord는 변을 따라가는 현·a=b·L자 밖으로 나가는 현을 거절한다', () => {
    const square = points([
      [0, 0],
      [3, 0],
      [3, 3],
      [0, 3],
    ]);
    expect(splitPolygonByChord(square, gp(0, 0), gp(3, 0))).toBeNull();
    expect(splitPolygonByChord(square, gp(1, 0), gp(1, 0))).toBeNull();
    const lShape = points([
      [0, 0],
      [3, 0],
      [3, 1],
      [1, 1],
      [1, 3],
      [0, 3],
    ]);
    expect(splitPolygonByChord(lShape, gp(0, 0), gp(3, 3))).toBeNull();
  });

  it('7/3 좌표가 생기는 자르기도 넓이 합이 정확하다', () => {
    const square = points([
      [0, 0],
      [3, 0],
      [3, 3],
      [0, 3],
    ]);
    const split = splitPolygonByChord(
      square,
      { x: Rational.of(7, 3), y: Rational.of(0) },
      { x: Rational.of(7, 3), y: Rational.of(3) },
    );
    expect(split).not.toBeNull();
    if (!split) return;
    const total = split.reduce((sum, piece) => sum.add(polygonArea(piece)), Rational.of(0));
    expect(total.toString()).toBe('9');
    const areas = split.map((piece) => polygonArea(piece).toString()).sort();
    expect(areas).toEqual(['2', '7']);
  });

  it('rotate90About 4번과 pointReflect 2번은 제자리이고, 10^9 좌표도 정확하다', () => {
    const point = gp(1_000_000_000, -999_999_999);
    const center = gp(-1_000_000_000, 999_999_999);
    const turned = rotate90About(
      rotate90About(rotate90About(rotate90About(point, center, 1), center, 1), center, 1),
      center,
      1,
    );
    expect(turned).toEqual(point);
    expect(pointReflect(pointReflect(point, center), center)).toEqual(point);
    expect(rotate90About(gp(1, 0), gp(0, 0), 1)).toEqual(gp(0, 1));
    expect(midpoint(gp(0, 0), gp(1, 0))).toEqual({ x: Rational.of(1, 2), y: Rational.of(0) });
  });
});

// ── T108 ──
describe('geometry T108 y 배율 기하', () => {
  it('parallel은 길이 0 선분을 평행으로 보지 않고 기울어진 평행은 true다', () => {
    expect(parallel(gp(0, 0), gp(0, 0), gp(0, 1), gp(2, 3))).toBe(false);
    expect(parallel(gp(0, 0), gp(2, 2), gp(0, 0), gp(0, 0))).toBe(false);
    expect(parallel(gp(0, 0), gp(4, 2), gp(1, 3), gp(5, 5))).toBe(true);
    expect(parallel(gp(0, 0), gp(4, 2), gp(1, 3), gp(5, 6))).toBe(false);
  });

  it('k=3 정삼각형 t04의 세 변의 길이 제곱이 모두 16이다', () => {
    const k = Rational.of(3);
    const a = gp(0, 0);
    const b = gp(4, 0);
    const c = gp(2, 2);
    expect(dist2Scaled(a, b, k).toString()).toBe('16');
    expect(dist2Scaled(b, c, k).toString()).toBe('16');
    expect(dist2Scaled(c, a, k).toString()).toBe('16');
  });

  it('k=3 정삼각형의 세 각은 모두 예각이다', () => {
    const k = Rational.of(3);
    const a = gp(0, 0);
    const b = gp(4, 0);
    const c = gp(2, 2);
    expect(angleKindScaled(b, a, c, k)).toBe('acute');
    expect(angleKindScaled(a, b, c, k)).toBe('acute');
    expect(angleKindScaled(a, c, b, k)).toBe('acute');
  });

  it('compareAngles는 같은 각 0, 예각 대 둔각 -1, 둔각끼리는 큰 각 1이다', () => {
    const k = Rational.of(1);
    expect(compareAngles(gp(1, 0), gp(0, 0), gp(0, 1), gp(2, 0), gp(0, 0), gp(0, 2), k)).toBe(0);
    expect(compareAngles(gp(1, 0), gp(0, 0), gp(1, 1), gp(1, 0), gp(0, 0), gp(-1, 1), k)).toBe(-1);
    // 둔각끼리: (−1, 0.5) 쪽이 (−1, 1) 쪽보다 더 벌어져 크다.
    expect(compareAngles(gp(1, 0), gp(0, 0), gp(-2, 1), gp(1, 0), gp(0, 0), gp(-1, 1), k)).toBe(1);
    expect(compareAngles(gp(1, 0), gp(0, 0), gp(-1, 1), gp(1, 0), gp(0, 0), gp(-2, 1), k)).toBe(-1);
  });

  it('compareAngles는 좌표 10⁹에서도 정확하고 길이 0이면 0이다', () => {
    const big = 1_000_000_000;
    const k = Rational.of(1);
    expect(
      compareAngles(
        gp(big + 1, big),
        gp(big, big),
        gp(big, big + 1),
        gp(1, 0),
        gp(0, 0),
        gp(0, 1),
        k,
      ),
    ).toBe(0);
    expect(compareAngles(gp(0, 0), gp(0, 0), gp(1, 1), gp(1, 0), gp(0, 0), gp(0, 1), k)).toBe(0);
  });

  it('k=1이면 dot·dist2·angleKind와 같은 값이다', () => {
    const pairs = [
      [gp(2, 3), gp(-1, 5)],
      [gp(-4, 1), gp(2, -7)],
    ] as const;
    const one = Rational.of(1);
    for (const [u, v] of pairs) {
      expect(dotScaled(u, v, one).equals(dot(u, v))).toBe(true);
    }
    expect(dist2Scaled(gp(1, 2), gp(4, 6), one).equals(dist2(gp(1, 2), gp(4, 6)))).toBe(true);
    expect(angleKindScaled(gp(1, 0), gp(0, 0), gp(-1, 1), one)).toBe(
      angleKind(gp(1, 0), gp(0, 0), gp(-1, 1)),
    );
    expect(angleKindScaled(gp(1, 0), gp(0, 0), gp(0, 1), one)).toBe('right');
  });
});
