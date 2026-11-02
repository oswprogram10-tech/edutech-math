import { describe, expect, it } from 'vitest';
import { minTouchRadius, screenPixelsToLogical, svgScaleFactor } from '../sizing';

const logical = { width: 1000, height: 600 };

describe('svgScaleFactor', () => {
  it('가로·세로 배율 중 작은 쪽을 쓴다', () => {
    expect(svgScaleFactor({ width: 800, height: 480 }, logical)).toBe(0.8);
    expect(svgScaleFactor({ width: 800, height: 1000 }, logical)).toBe(0.8);
    expect(svgScaleFactor({ width: 500, height: 300 }, logical)).toBe(0.5);
  });

  it('크기를 아직 모르면 0이다', () => {
    expect(svgScaleFactor({ width: 0, height: 0 }, logical)).toBe(0);
    expect(svgScaleFactor({ width: 800, height: 480 }, { width: 0, height: 600 })).toBe(0);
  });
});

describe('screenPixelsToLogical', () => {
  it('화면 px를 논리 길이로 바꾼다', () => {
    expect(screenPixelsToLogical(48, { width: 800, height: 480 }, logical)).toBe(60);
    expect(screenPixelsToLogical(64, { width: 400, height: 240 }, logical)).toBe(160);
  });
});

describe('minTouchRadius', () => {
  it('지름이 48px·64px 이상이 되는 반지름을 구한다', () => {
    expect(minTouchRadius(48, { width: 800, height: 480 }, logical)).toBe(30);
    expect(minTouchRadius(64, { width: 800, height: 480 }, logical)).toBe(40);
  });

  it('좁은 화면에서는 더 큰 논리 반지름이 필요하다', () => {
    expect(minTouchRadius(48, { width: 400, height: 240 }, logical)).toBe(60);
    expect(minTouchRadius(48, { width: 320, height: 192 }, logical)).toBe(75);
  });

  it('아직 측정 전이면 0을 돌려준다', () => {
    expect(minTouchRadius(48, { width: 0, height: 0 }, logical)).toBe(0);
  });
});
