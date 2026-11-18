import { describe, expect, it } from 'vitest';
import { frameOf, markSide, minPictureSize, minTouchScale } from '../layout';

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
