import { describe, expect, it } from 'vitest';
import {
  edgesOf,
  isEdgeOf,
  LASER_MAX_STEP,
  PROFILE_EDGES,
  sectionOf,
  snapAngle,
  solidOf,
  type LatheEdge,
  type LatheProfile,
  type LatheSolid,
} from '../lathe/profiles';
import {
  axisChain,
  chainHeight,
  chainRadius,
  convexHull,
  mirroredOutline,
  radiusAt,
  rimRings,
} from '../lathe/render';

describe('E12 lathe 결과 입체 표(도형 × 변)', () => {
  const table: readonly (readonly [LatheProfile, LatheEdge, LatheSolid])[] = [
    ['rectangle', 'long', 'cylinder'],
    ['rectangle', 'short', 'cylinder'],
    ['right-triangle', 'leg-vertical', 'cone'],
    ['right-triangle', 'leg-horizontal', 'cone'],
    ['right-triangle', 'hypotenuse', 'double-cone'],
    ['semicircle', 'diameter', 'sphere'],
  ];

  it.each(table)('%s + %s → %s', (profile, edge, solid) => {
    expect(solidOf(profile, edge)).toBe(solid);
    expect(isEdgeOf(profile, edge)).toBe(true);
  });

  it('붙일 수 없는 변이면 null이다', () => {
    expect(solidOf('rectangle', 'hypotenuse')).toBeNull();
    expect(solidOf('semicircle', 'long')).toBeNull();
    expect(solidOf('right-triangle', 'diameter')).toBeNull();
    expect(isEdgeOf('rectangle', 'bogus')).toBe(false);
  });

  it('도형마다 붙일 수 있는 변의 목록과 순서', () => {
    expect(edgesOf('rectangle')).toEqual(['long', 'short']);
    expect(edgesOf('right-triangle')).toEqual(['leg-vertical', 'leg-horizontal', 'hypotenuse']);
    expect(edgesOf('semicircle')).toEqual(['diameter']);
    expect(Object.keys(PROFILE_EDGES)).toHaveLength(3);
  });
});

describe('E12 lathe 단면 표(입체 × 면 × 높이)', () => {
  it('축을 포함하면 높이와 상관없이 입체마다 정해진 모양이다', () => {
    for (const t of [0, 5, 10]) {
      expect(sectionOf('cylinder', 'through-axis', t)).toBe('rectangle');
      expect(sectionOf('cone', 'through-axis', t)).toBe('isosceles-triangle');
      expect(sectionOf('sphere', 'through-axis', t)).toBe('circle');
      expect(sectionOf('double-cone', 'through-axis', t)).toBe('rhombus');
    }
  });

  it('축에 수직: 원기둥은 끝에서도 원이다', () => {
    for (const t of [0, 1, 5, 9, 10]) {
      expect(sectionOf('cylinder', 'perpendicular', t)).toBe('circle');
    }
  });

  it('축에 수직: 원뿔은 꼭짓점(맨 위)에서만 점이다', () => {
    expect(sectionOf('cone', 'perpendicular', 0)).toBe('circle');
    expect(sectionOf('cone', 'perpendicular', 5)).toBe('circle');
    expect(sectionOf('cone', 'perpendicular', 9)).toBe('circle');
    expect(sectionOf('cone', 'perpendicular', 10)).toBe('point');
  });

  it('축에 수직: 구와 팽이 모양은 양 끝에서 점이고 가운데는 원이다', () => {
    for (const solid of ['sphere', 'double-cone'] as const) {
      expect(sectionOf(solid, 'perpendicular', 0)).toBe('point');
      expect(sectionOf(solid, 'perpendicular', 1)).toBe('circle');
      expect(sectionOf(solid, 'perpendicular', 5)).toBe('circle');
      expect(sectionOf(solid, 'perpendicular', 9)).toBe('circle');
      expect(sectionOf(solid, 'perpendicular', LASER_MAX_STEP)).toBe('point');
    }
  });

  it('수평 레이저의 높이가 정수 0~10이 아니면 null이다', () => {
    expect(sectionOf('cone', 'perpendicular', -1)).toBeNull();
    expect(sectionOf('cone', 'perpendicular', 11)).toBeNull();
    expect(sectionOf('cone', 'perpendicular', 2.5)).toBeNull();
    expect(sectionOf('cone', 'perpendicular', Number.NaN)).toBeNull();
  });
});

describe('E12 lathe 각도 맞추기', () => {
  it('0~360을 30 단위로 맞춘다', () => {
    expect(snapAngle(0)).toBe(0);
    expect(snapAngle(14)).toBe(0);
    expect(snapAngle(15)).toBe(30);
    expect(snapAngle(44)).toBe(30);
    expect(snapAngle(345)).toBe(360);
    expect(snapAngle(360)).toBe(360);
  });

  it('범위 밖은 자르고, 수가 아니면 null이다', () => {
    expect(snapAngle(-50)).toBe(0);
    expect(snapAngle(999)).toBe(360);
    expect(snapAngle(Number.NaN)).toBeNull();
    expect(snapAngle(Number.POSITIVE_INFINITY)).toBeNull();
    expect(snapAngle('90')).toBeNull();
  });
});

describe('E12 lathe 그림 좌표(그림용 실수)', () => {
  it('붙인 변은 축 위(r=0)에서 시작해 축 위에서 끝난다', () => {
    for (const [profile, edges] of Object.entries(PROFILE_EDGES) as [
      LatheProfile,
      readonly LatheEdge[],
    ][]) {
      for (const edge of edges) {
        const chain = axisChain(profile, edge);
        expect(chain, `${profile}/${edge}`).not.toBeNull();
        if (!chain) continue;
        expect(chain[0]?.r).toBe(0);
        expect(chain[chain.length - 1]?.r).toBeCloseTo(0, 9);
        expect(chain.every((p) => p.r >= 0)).toBe(true);
      }
    }
    expect(axisChain('rectangle', 'hypotenuse')).toBeNull();
  });

  it('직사각형: 세로 변이 축이면 높이 4·반지름 2, 가로 변이면 높이 2·반지름 4', () => {
    const tall = axisChain('rectangle', 'long');
    const wide = axisChain('rectangle', 'short');
    if (!tall || !wide) throw new Error('chain');
    expect([chainHeight(tall), chainRadius(tall)]).toEqual([4, 2]);
    expect([chainHeight(wide), chainRadius(wide)]).toEqual([2, 4]);
    expect(radiusAt(tall, 0)).toBe(2);
    expect(radiusAt(tall, 4)).toBe(2);
    expect(radiusAt(tall, 2)).toBe(2);
  });

  it('원뿔 모양: 맨 위에서 반지름 0, 아래로 갈수록 커진다', () => {
    const chain = axisChain('right-triangle', 'leg-vertical');
    if (!chain) throw new Error('chain');
    expect(radiusAt(chain, 4)).toBeCloseTo(0, 9);
    expect(radiusAt(chain, 2)).toBeCloseTo(1, 9);
    expect(radiusAt(chain, 0)).toBe(2);
    expect(radiusAt(chain, 5)).toBe(0);
  });

  it('빗변이 축이면 양 끝이 점이고 가운데 근처가 가장 넓다', () => {
    const chain = axisChain('right-triangle', 'hypotenuse');
    if (!chain) throw new Error('chain');
    const H = chainHeight(chain);
    expect(radiusAt(chain, 0)).toBeCloseTo(0, 9);
    expect(radiusAt(chain, H)).toBeCloseTo(0, 9);
    expect(radiusAt(chain, H / 2)).toBeGreaterThan(0);
    expect(rimRings('right-triangle', 'hypotenuse')).toHaveLength(1);
  });

  it('반원은 지름 가운데에서 반지름 2, 양 끝에서 0이다', () => {
    const chain = axisChain('semicircle', 'diameter');
    if (!chain) throw new Error('chain');
    expect(chainHeight(chain)).toBeCloseTo(4, 9);
    expect(radiusAt(chain, 2)).toBeCloseTo(2, 9);
    expect(radiusAt(chain, 0)).toBeCloseTo(0, 9);
    expect(rimRings('semicircle', 'diameter')).toEqual([{ r: 2, h: 2, cap: null }]);
  });

  it('축을 포함한 단면 윤곽은 좌우가 거울이다', () => {
    const chain = axisChain('right-triangle', 'leg-vertical');
    if (!chain) throw new Error('chain');
    const outline = mirroredOutline(chain);
    expect(outline).toHaveLength(chain.length + chain.length - 2);
    expect(Math.min(...outline.map((p) => p.r))).toBe(-2);
    expect(Math.max(...outline.map((p) => p.r))).toBe(2);
  });

  it('볼록 껍질은 안쪽 점을 버린다', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
      { x: 2, y: 2 },
    ]);
    expect(hull).toHaveLength(4);
  });
});
