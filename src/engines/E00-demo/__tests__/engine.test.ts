import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { DemoAction, DemoState } from '../types';

function withCounters(count: number): DemoState {
  let state = createInitialState({});
  for (let i = 0; i < count; i += 1) {
    state = reduce(state, { type: 'add', x: 100 * (i + 1), y: 200 });
  }
  return state;
}

describe('E00-demo reduce', () => {
  it('빈 곳에 셈돌을 놓으면 순서대로 ID가 붙는다', () => {
    const state = withCounters(2);
    expect(state.counters).toEqual([
      { id: 'c1', x: 100, y: 200 },
      { id: 'c2', x: 200, y: 200 },
    ]);
    expect(observe(state, {})).toEqual({ count: 2, groups: [] });
  });

  it('좌표를 논리 범위 안으로 자른다', () => {
    const state = reduce(createInitialState({}), {
      type: 'add',
      x: 5000,
      y: -100,
    });
    expect(state.counters[0]).toMatchObject({ x: 1000, y: 0 });
  });

  it('셈돌을 옮긴다', () => {
    const state = reduce(withCounters(1), { type: 'move', id: 'c1', x: 300, y: 400 });
    expect(state.counters[0]).toMatchObject({ x: 300, y: 400 });
  });

  it('없는 셈돌을 옮기면 상태를 바꾸지 않는다', () => {
    const state = withCounters(1);
    expect(reduce(state, { type: 'move', id: 'c9', x: 0, y: 0 })).toBe(state);
  });

  it('올가미로 두 개 이상을 묶고, 다시 묶으면 새 묶음으로 옮긴다', () => {
    const state = withCounters(3);
    const grouped = reduce(state, { type: 'group', ids: ['c1', 'c2'] });
    expect(observe(grouped, {})).toEqual({ count: 3, groups: [2] });

    const regrouped = reduce(grouped, { type: 'group', ids: ['c2', 'c3'] });
    expect(regrouped.groups).toHaveLength(1);
    expect(regrouped.groups[0]?.counterIds).toEqual(['c2', 'c3']);
  });

  it('한 개짜리 묶음은 만들지 않고, 없는 ID는 무시한다', () => {
    const state = withCounters(2);
    expect(reduce(state, { type: 'group', ids: ['c1'] })).toBe(state);
    expect(reduce(state, { type: 'group', ids: ['c1', 'nope'] })).toBe(state);
  });

  it('묶음을 풀어도 셈돌은 그대로 남는다', () => {
    const grouped = reduce(withCounters(2), { type: 'group', ids: ['c1', 'c2'] });
    const groupId = grouped.groups[0]?.id ?? '';
    const ungrouped = reduce(grouped, { type: 'ungroup', groupId });
    expect(observe(ungrouped, {})).toEqual({ count: 2, groups: [] });
    expect(ungrouped.counters).toHaveLength(2);
  });

  it('모든 Action 뒤 상태가 JSON으로 직렬화된다', () => {
    const actions: DemoAction[] = [
      { type: 'add', x: 100, y: 100 },
      { type: 'add', x: 200, y: 100 },
      { type: 'add', x: 300, y: 100 },
      { type: 'move', id: 'c1', x: 150, y: 150 },
      { type: 'group', ids: ['c1', 'c2'] },
      { type: 'group', ids: ['c2', 'c3'] },
      { type: 'ungroup', groupId: 'g2' },
    ];
    let state = createInitialState({});
    assertSerializable(state);
    for (const action of actions) {
      state = reduce(state, action);
      assertSerializable(state);
    }
    expect(state.groups).toEqual([]);
    expect(observe(state, {})).toEqual({ count: 3, groups: [] });
  });
});
