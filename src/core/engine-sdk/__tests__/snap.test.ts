import { describe, expect, it } from 'vitest';
import { distance, clientToLogical } from '../coordinates';
import { nearestPointOnRect, snapPoint } from '../snap';

describe('coordinates', () => {
  it('화면 좌표를 논리 좌표로 바꾼다', () => {
    const point = clientToLogical(
      250,
      150,
      { left: 100, top: 50, width: 500, height: 300 },
      { width: 1000, height: 600 },
    );
    expect(point).toEqual({ x: 300, y: 200 });
  });

  it('범위를 벗어나면 논리 좌표 안으로 자른다', () => {
    const point = clientToLogical(
      0,
      0,
      { left: 100, top: 50, width: 500, height: 300 },
      { width: 1000, height: 600 },
    );
    expect(point).toEqual({ x: 0, y: 0 });
  });

  it('거리를 계산한다', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('snapPoint', () => {
  it('격자에 붙인다', () => {
    const result = snapPoint({ x: 51, y: 149 }, { grid: { size: 50 } });
    expect(result.kind).toBe('grid');
    expect(result.point).toEqual({ x: 50, y: 150 });
  });

  it('목표점이 격자보다 우선한다', () => {
    const result = snapPoint(
      { x: 49, y: 49 },
      { grid: { size: 50 }, points: [{ x: 80, y: 80 }], threshold: 100 },
    );
    expect(result.kind).toBe('point');
    expect(result.point).toEqual({ x: 80, y: 80 });
  });

  it('다른 객체의 가장자리에 붙인다', () => {
    const result = snapPoint(
      { x: 195, y: 150 },
      { edges: [{ x: 100, y: 100, width: 100, height: 100 }] },
    );
    expect(result.kind).toBe('edge');
    expect(result.point).toEqual({ x: 200, y: 150 });
  });

  it('사각형 안에서는 가장 가까운 변으로 붙인다', () => {
    expect(
      nearestPointOnRect({ x: 190, y: 150 }, { x: 100, y: 100, width: 100, height: 100 }),
    ).toEqual({ x: 200, y: 150 });
    expect(
      nearestPointOnRect({ x: 150, y: 105 }, { x: 100, y: 100, width: 100, height: 100 }),
    ).toEqual({ x: 150, y: 100 });
  });

  it('문턱 밖이면 원래 점을 둔다', () => {
    const point = { x: 504, y: 504 };
    const result = snapPoint(point, {
      grid: { size: 50 },
      points: [{ x: 0, y: 0 }],
      edges: [{ x: 100, y: 100, width: 10, height: 10 }],
      threshold: 5,
    });
    expect(result.kind).toBe('none');
    expect(result.point).toBe(point);
  });

  it('종류별 문턱을 따로 줄 수 있다', () => {
    const result = snapPoint(
      { x: 49, y: 49 },
      { grid: { size: 50 }, points: [{ x: 80, y: 80 }], pointThreshold: 10 },
    );
    expect(result.kind).toBe('grid');
  });
});
