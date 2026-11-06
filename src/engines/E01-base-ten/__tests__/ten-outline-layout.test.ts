import { describe, expect, it } from 'vitest';
import { blockRect, tenOutlineRects } from '../layout';
import { createInitialState, reduce } from '../reduce';
import type { BaseTenState } from '../types';
import { LOGICAL_WIDTH } from '../types';

function withOnes(count: number, y = 200): BaseTenState {
  let state = createInitialState({ mode: 'count' });
  for (let index = 0; index < count; index += 1) {
    state = reduce(state, { type: 'add', value: 1, x: 120 + index * 40, y });
  }
  return state;
}

describe('E01 ten-outline 배치(tenOutlineRects)', () => {
  it('블록이 없으면 판 가운데에 5×2 격자 열 자리를 그린다', () => {
    const rects = tenOutlineRects(createInitialState({ mode: 'count' }), 1);
    expect(rects).toHaveLength(10);
    const xs = new Set(rects.map((rect) => rect.x));
    const ys = new Set(rects.map((rect) => rect.y));
    expect(xs.size).toBe(5);
    expect(ys.size).toBe(2);
  });

  it('블록이 열 개보다 적으면 실제 블록 자리 뒤에 같은 간격으로 빈 자리를 잇는다', () => {
    const state = withOnes(3);
    const rects = tenOutlineRects(state, 1);
    expect(rects).toHaveLength(10);
    const actual = state.blocks.map((block) => blockRect(block));
    expect(rects.slice(0, 3)).toEqual(actual);
    // 이어 그린 자리는 같은 줄 간격(40)을 따른다.
    expect((rects[3]?.x ?? 0) - (rects[2]?.x ?? 0)).toBe(40);
    for (const rect of rects) {
      expect(rect.x + rect.width).toBeLessThanOrEqual(LOGICAL_WIDTH);
    }
  });

  it('블록이 열 개를 넘으면 위·왼쪽 순 첫 열 개 블록 자리만 쓴다', () => {
    let state = withOnes(10, 150);
    for (let index = 0; index < 5; index += 1) {
      state = reduce(state, { type: 'add', value: 1, x: 120 + index * 40, y: 300 });
    }
    const rects = tenOutlineRects(state, 1);
    expect(rects).toHaveLength(10);
    const topRow = state.blocks.filter((block) => block.y === 150).map((block) => blockRect(block));
    expect(rects).toEqual(topRow);
  });
});
