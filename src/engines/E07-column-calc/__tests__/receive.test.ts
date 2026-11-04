import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { EngineEvent } from '../../../core/engine-sdk';
import { receive, receivers } from '../receive';
import { createInitialState, reduce } from '../reduce';
import type { ColumnCalcAction, ColumnCalcConfig, ColumnCalcState } from '../types';

function stateOf(config: ColumnCalcConfig): ColumnCalcState {
  return createInitialState(config);
}

function apply(state: ColumnCalcState, action: ColumnCalcAction | null): ColumnCalcState {
  if (action === null) return state;
  const next = reduce(state, action);
  assertSerializable(next);
  return next;
}

function event(name: string, payload: unknown): EngineEvent {
  return { name, payload: payload as EngineEvent['payload'] };
}

describe('E07 receive 연결', () => {
  it('grouped + auto는 받아올림 칸에 1을 쓴다', () => {
    let state = stateOf({ mode: 'add', a: 38, b: 25, linkMarks: 'auto' });
    const action = receive(state, event('grouped', { from: 1, to: 10, column: 0 }), {
      mode: 'add',
      a: 38,
      b: 25,
      linkMarks: 'auto',
    });
    expect(action).toEqual({
      type: 'link-mark',
      marks: [],
      fill: [{ kind: 'carry', column: 1, digit: '1' }],
      crosses: [],
      tens: [],
    });
    state = apply(state, action);
    expect(state.carries).toEqual({ '1': '1' });
    // 이미 적힌 받아올림은 덮어쓰지 않는다.
    const again = apply(state, receive(state, event('grouped', { column: 0 })));
    expect(again.carries).toEqual({ '1': '1' });
  });

  it('grouped + hint는 그 칸을 강조만 한다', () => {
    let state = stateOf({ mode: 'add', a: 38, b: 25 });
    state = apply(state, receive(state, event('grouped', { from: 1, to: 10, column: 0 })));
    expect(state.carries).toEqual({});
    expect(state.linkHighlights).toEqual(['carry:1']);
  });

  it('broken + auto는 403−158을 두 번 받아 3·9와 10 표시를 남긴다', () => {
    const config: ColumnCalcConfig = { mode: 'sub', a: 403, b: 158, linkMarks: 'auto' };
    let state = stateOf(config);
    state = apply(state, receive(state, event('broken', { from: 100, to: 10, column: 2 }), config));
    expect(state.regroups).toEqual({ '2': '3' });
    expect(state.tens).toEqual([1]);
    expect(state.crosses).toEqual([2]);

    state = apply(state, receive(state, event('broken', { from: 10, to: 1, column: 1 }), config));
    expect(state.regroups).toEqual({ '2': '3', '1': '9' });
    expect(state.tens).toEqual([0, 1]);
    expect(state.crosses).toEqual([1, 2]);
  });

  it('broken + hint는 줄·고친 수·10 표시 세 칸을 강조한다', () => {
    const state = stateOf({ mode: 'sub', a: 403, b: 158 });
    const hint = apply(state, receive(state, event('broken', { column: 2 })));
    expect(hint.carries).toEqual({});
    expect(hint.regroups).toEqual({});
    expect(hint.linkHighlights).toEqual(['cross:2', 'regroup:2', 'ten:1']);
  });

  it('partial-product-changed는 순서가 바뀌어도 값으로 줄을 맞춘다', () => {
    let state = stateOf({ mode: 'mul', a: 46, b: 5, style: 'partial-products' });
    const action = receive(
      state,
      event('partial-product-changed', {
        parts: [
          { a: 5, b: 6, product: 30, colorIndex: 2 },
          { a: 5, b: 40, product: 200, colorIndex: 1 },
        ],
      }),
    );
    expect(action).toEqual({ type: 'link-colors', colors: { '0': 2, '1': 1 } });
    state = apply(state, action);
    expect(state.rowColors).toEqual({ '0': 2, '1': 1 });
  });

  it('해당 없는 모드나 이벤트는 null이다', () => {
    const add = stateOf({ mode: 'add', a: 38, b: 25 });
    const mul = stateOf({ mode: 'mul', a: 46, b: 27 });
    expect(receive(add, event('broken', { column: 1 }))).toBeNull();
    expect(receive(add, event('partial-product-changed', { parts: [] }))).toBeNull();
    expect(receive(mul, event('grouped', { column: 0 }))).toBeNull();
    expect(receive(mul, event('unknown-event', {}))).toBeNull();
  });

  it('receivers 표는 이벤트 이름으로 찾는다(T047이 div를 더할 자리)', () => {
    expect(Object.keys(receivers).sort()).toEqual(['broken', 'grouped', 'partial-product-changed']);
  });
});
