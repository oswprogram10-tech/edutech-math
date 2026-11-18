import { describe, expect, it } from 'vitest';
import { frameOf, markSide, minPictureSize, minTouchScale } from '../layout';

describe('E18 ○ 칸 최소 크기', () => {
  it('targetSize 64, 7칸 세로: 최소 크기에서 칸 한 변이 64px 이상이다', () => {
    const frame = frameOf('vertical', 3, 7);
    const scale = minTouchScale(frame, 64);
    expect(markSide(frame) * scale).toBeGreaterThanOrEqual(64);
    const size = minPictureSize(frame, 64);
    expect(size.height).toBeGreaterThan(640);
    expect((size.height / 700) * markSide(frame)).toBeGreaterThanOrEqual(63.9);
  });

  it('가로 그래프와 targetSize 48, 칸이 많거나 범주가 많아도 한 변이 targetSize 이상이다', () => {
    for (const [orientation, count, cells, target] of [
      ['horizontal', 3, 7, 64],
      ['vertical', 3, 7, 48],
      ['vertical', 8, 13, 48],
      ['horizontal', 8, 13, 64],
      ['vertical', 1, 1, 64],
    ] as const) {
      const frame = frameOf(orientation, count, cells);
      expect(markSide(frame) * minTouchScale(frame, target)).toBeGreaterThanOrEqual(target - 0.001);
    }
  });

  it('64가 48보다 더 큰 최소 크기를 요구한다', () => {
    const frame = frameOf('vertical', 3, 7);
    expect(minPictureSize(frame, 64).height).toBeGreaterThan(minPictureSize(frame, 48).height);
  });
});
