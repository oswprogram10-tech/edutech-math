import { describe, expect, it } from 'vitest';
import { isTapGesture, pathLength, pointInPolygon, selectInside } from '../lasso';

const square = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe('pointInPolygon', () => {
  it('안과 밖을 구분한다', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
    expect(pointInPolygon({ x: -1, y: 50 }, square)).toBe(false);
    expect(pointInPolygon({ x: 101, y: 50 }, square)).toBe(false);
  });

  it('변과 꼭짓점 위의 점도 포함한다', () => {
    expect(pointInPolygon({ x: 0, y: 50 }, square)).toBe(true);
    expect(pointInPolygon({ x: 100, y: 100 }, square)).toBe(true);
    expect(pointInPolygon({ x: 50, y: 0 }, square)).toBe(true);
  });

  it('끝점이 시작점과 겹쳐도 밖의 점을 포함하지 않는다', () => {
    const closed = [...square, { x: 0, y: 0 }];
    expect(pointInPolygon({ x: 700, y: 400 }, closed)).toBe(false);
    expect(pointInPolygon({ x: 0, y: 0 }, closed)).toBe(true);
  });

  it('오목한 폴리곤에서도 판정한다', () => {
    const concave = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(pointInPolygon({ x: 10, y: 50 }, concave)).toBe(true);
    expect(pointInPolygon({ x: 75, y: 50 }, concave)).toBe(false);
  });

  it('점이 세 개 미만이면 아무것도 고르지 않는다', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, square.slice(0, 2))).toBe(false);
    expect(selectInside(square.slice(0, 2), [{ x: 50, y: 50 }], (p) => p)).toEqual([]);
  });
});

describe('selectInside', () => {
  it('중심이 안에 있는 항목을 고른다', () => {
    const counters = [
      { id: 'inside', x: 50, y: 50 },
      { id: 'outside', x: 200, y: 50 },
      { id: 'edge', x: 0, y: 20 },
    ];
    expect(
      selectInside(square, counters, (counter) => counter).map((counter) => counter.id),
    ).toEqual(['inside', 'edge']);
  });
});

describe('isTapGesture', () => {
  it('거의 움직이지 않으면 탭이다', () => {
    expect(isTapGesture([{ x: 10, y: 10 }], 16)).toBe(true);
    expect(
      isTapGesture(
        [
          { x: 10, y: 10 },
          { x: 20, y: 12 },
        ],
        16,
      ),
    ).toBe(true);
  });

  it('멀리 움직였으면 올가미다', () => {
    expect(
      isTapGesture(
        [
          { x: 10, y: 10 },
          { x: 100, y: 10 },
        ],
        16,
      ),
    ).toBe(false);
  });
});

describe('pathLength', () => {
  it('이동 거리를 합한다', () => {
    expect(
      pathLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 3, y: 14 },
      ]),
    ).toBe(15);
  });
});
