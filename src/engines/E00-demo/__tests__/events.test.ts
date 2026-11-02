import { describe, expect, it } from 'vitest';
import definition from '../index';
import { emit, predicates, receive } from '../events';
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

function apply(state: DemoState, action: DemoAction): { prev: DemoState; next: DemoState } {
  return { prev: state, next: reduce(state, action) };
}

describe('E00-demo 이벤트', () => {
  it('놓기·옮기기·묶기·풀기에서 이름과 payload를 낸다', () => {
    const empty = createInitialState({});
    const afterAdd = apply(empty, { type: 'add', x: 200, y: 300 });
    expect(emit(afterAdd.prev, afterAdd.next, { type: 'add', x: 200, y: 300 })).toEqual([
      { name: 'counter-added', payload: { id: 'c1', x: 200, y: 300 } },
    ]);

    const moved = apply(afterAdd.next, { type: 'move', id: 'c1', x: 300, y: 400 });
    expect(emit(moved.prev, moved.next, { type: 'move', id: 'c1', x: 300, y: 400 })).toEqual([
      { name: 'counter-moved', payload: { id: 'c1', x: 300, y: 400 } },
    ]);

    const two = withCounters(2);
    const grouped = apply(two, { type: 'group', ids: ['c1', 'c2'] });
    expect(emit(grouped.prev, grouped.next, { type: 'group', ids: ['c1', 'c2'] })).toEqual([
      { name: 'grouped', payload: { groupId: 'g1', size: 2 } },
    ]);

    const groupId = grouped.next.groups[0]?.id ?? '';
    const ungrouped = apply(grouped.next, { type: 'ungroup', groupId });
    expect(emit(ungrouped.prev, ungrouped.next, { type: 'ungroup', groupId })).toEqual([
      { name: 'ungrouped', payload: { groupId } },
    ]);
  });

  it('상태가 바뀌지 않으면 이벤트를 내지 않는다', () => {
    const state = withCounters(1);
    const action: DemoAction = { type: 'move', id: 'c9', x: 0, y: 0 };
    expect(emit(state, reduce(state, action), action)).toEqual([]);
  });

  it('counter-added를 받으면 같은 자리에 셈돌을 하나 놓는다', () => {
    const state = createInitialState({});
    const action = receive(state, { name: 'counter-added', payload: { x: 200, y: 300 } }, {});
    expect(action).toEqual({ type: 'add', x: 200, y: 300 });
    expect(receive(state, { name: 'grouped', payload: { size: 2 } }, {})).toBeNull();
    expect(receive(state, { name: 'counter-added' }, {})).toMatchObject({ type: 'add' });
  });

  it('has-group-of는 args의 size인 묶음이 있을 때만 참이다', () => {
    const grouped = reduce(withCounters(3), { type: 'group', ids: ['c1', 'c2', 'c3'] });
    const observation = observe(grouped, {});
    expect(predicates['has-group-of']?.(observation, { size: 3 })).toBe(true);
    expect(predicates['has-group-of']?.(observation, { size: 2 })).toBe(false);
    expect(predicates['has-group-of']?.(observation, { size: '3' })).toBe(false);
    expect(predicates['has-group-of']?.(observation, undefined)).toBe(false);
  });

  it('내는 이벤트 이름은 엔진 events 목록에 있다', () => {
    expect(definition.events).toEqual(
      expect.arrayContaining(['counter-added', 'counter-moved', 'grouped', 'ungrouped']),
    );
    expect(definition.emit).toBe(emit);
    expect(definition.receive).toBe(receive);
    expect(definition.predicates?.['has-group-of']).toBe(predicates['has-group-of']);
  });
});
