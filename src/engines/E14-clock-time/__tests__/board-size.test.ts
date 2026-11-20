import { describe, expect, it } from 'vitest';
import { CLOCK, CLOCK_ONLY_HEIGHT, boardSize } from '../layout';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

describe('clock 판 논리 크기', () => {
  it('펼치지 않으면 시계만 담고, 펼치면 띠 자리를 더한다', () => {
    expect(boardSize(false)).toEqual({ width: LOGICAL_WIDTH, height: CLOCK_ONLY_HEIGHT });
    expect(boardSize(true)).toEqual({ width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT });
    expect(CLOCK_ONLY_HEIGHT).toBeLessThan(LOGICAL_HEIGHT);
  });

  it('시계 원과 숫자 이름표(12·6)가 줄어든 판 안에 들어온다', () => {
    expect(CLOCK.cy + CLOCK.labelR).toBeLessThanOrEqual(CLOCK_ONLY_HEIGHT);
    expect(CLOCK.cy - CLOCK.labelR).toBeGreaterThanOrEqual(0);
  });
});
