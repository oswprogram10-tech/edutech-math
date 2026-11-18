import { describe, expect, it } from 'vitest';
import {
  frameOf,
  markSide,
  minPictureSize,
  minTextPx,
  minTouchScale,
  textSize,
  tickCells,
  touchScale,
} from '../layout';

describe('E18 ○ 칸 최소 크기', () => {
  it('targetSize 64, 7칸 세로: 최소 크기에서 칸 한 변이 64px 이상이다', () => {
    const frame = frameOf('vertical', 3, 7, true);
    const scale = minTouchScale(frame, 64);
    expect(markSide(frame) * scale).toBeGreaterThanOrEqual(64);
    const size = minPictureSize(frame, 64);
    expect(size.height).toBeGreaterThan(600);
    expect((size.height / frame.height) * markSide(frame)).toBeGreaterThanOrEqual(63.9);
  });

  it('가로 그래프와 targetSize 48, 칸이 많거나 범주가 많아도 한 변이 targetSize 이상이다', () => {
    for (const [orientation, count, cells, target] of [
      ['horizontal', 3, 7, 64],
      ['vertical', 3, 7, 48],
      ['vertical', 8, 13, 48],
      ['horizontal', 8, 13, 64],
      ['vertical', 1, 1, 64],
    ] as const) {
      const frame = frameOf(orientation, count, cells, true);
      expect(markSide(frame) * minTouchScale(frame, target)).toBeGreaterThanOrEqual(target - 0.001);
    }
  });

  it('64가 48보다 더 큰 최소 크기를 요구한다', () => {
    const frame = frameOf('vertical', 3, 7, true);
    expect(minPictureSize(frame, 64).height).toBeGreaterThan(minPictureSize(frame, 48).height);
  });

  it('누르는 ○ 그래프의 논리 크기는 범주·칸 수로 정해지고 아이패드 세로 판 폭 740px 안에 들어온다(4범주·7칸·64)', () => {
    const frame = frameOf('vertical', 4, 7, true);
    const size = minPictureSize(frame, 64);
    expect(size.width).toBeLessThanOrEqual(740);
    expect(size.height).toBeGreaterThan(size.width);
    // 범주가 늘면 폭이, 칸이 늘면 높이가 늘고 반대 방향은 그대로다.
    expect(frameOf('vertical', 5, 7, true).width).toBeGreaterThan(frame.width);
    expect(frameOf('vertical', 5, 7, true).height).toBe(frame.height);
    expect(frameOf('vertical', 4, 8, true).height).toBeGreaterThan(frame.height);
    expect(frameOf('vertical', 4, 8, true).width).toBe(frame.width);
    // 주어진 그래프·막대그래프는 1000×700 그대로다.
    expect(frameOf('vertical', 4, 7)).toMatchObject({ width: 1000, height: 700 });
  });
});

describe('T158: 누르는 ○ 그래프 배율과 글자 크기', () => {
  const frame = frameOf('vertical', 4, 6, true);
  const min = minTouchScale(frame, 64);

  it('fitScale이 minTouchScale 이상이면 fitScale, 아니면 minTouchScale이다', () => {
    const fit = min * 1.5;
    expect(
      touchScale(frame, 64, { width: frame.width * fit, height: frame.height * fit }),
    ).toBeCloseTo(fit);
    // 폭만 넓어도 세로가 모자라면 fit은 작은 쪽이고, minTouchScale보다 작으면 minTouchScale이다.
    expect(touchScale(frame, 64, { width: 5000, height: frame.height * min * 0.5 })).toBeCloseTo(
      min,
    );
    // 판 폭을 채우려고 더 키우지 않는다.
    expect(touchScale(frame, 64, { width: 5000, height: frame.height * min })).toBeCloseTo(min);
    // 영역 크기를 모르면 minTouchScale
    expect(touchScale(frame, 64, { width: 0, height: 0 })).toBeCloseTo(min);
  });

  it('글자는 화면 14px(저학년 16px) 이상이 되도록 키우고 기본 크기의 2배를 넘지 않는다', () => {
    expect(minTextPx(48)).toBe(14);
    expect(minTextPx(64)).toBe(16);
    expect(textSize(20, 0.5, 48) * 0.5).toBeGreaterThanOrEqual(14);
    expect(textSize(20, 0.5, 64) * 0.5).toBeGreaterThanOrEqual(16);
    expect(textSize(20, 1, 48)).toBe(20);
    expect(textSize(20, 0.1, 48)).toBe(40);
    expect(textSize(20, 0, 48)).toBe(20);
  });

  it('tickCells는 minEvery칸마다 쓴다', () => {
    expect(tickCells(6)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(tickCells(6, 2)).toEqual([0, 2, 4, 6]);
  });
});
