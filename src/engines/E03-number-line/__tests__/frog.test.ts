import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { emit, frogAtIs, frogJumpCountIs, frogJumpTotalIs, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { NumberLineConfig, NumberLineState } from '../types';

const CONFIG: NumberLineConfig = {
  mode: 'integer',
  min: 0,
  max: 100,
  unit: 1,
  labels: 'partial',
  jumpButtons: [10, 1, -1, -10],
  jumpStart: 35,
};

function start(overrides: NumberLineConfig = {}): NumberLineState {
  return createInitialState({ ...CONFIG, ...overrides });
}

function jump(state: NumberLineState, sizes: readonly string[]): NumberLineState {
  return sizes.reduce((current, size) => reduce(current, { type: 'frog-jump', size }), state);
}

function frogConfig(): NumberLineState {
  return jump(start(), ['10', '10', '1', '1', '1']);
}

describe('T080 개구리 점프 reduce', () => {
  it('35에서 +10 +10 +1 +1 +1은 위치 58이다', () => {
    const state = frogConfig();
    const observed = observe(state);
    expect(observed['frogStart']).toBe('35');
    expect(observed['frogJumps']).toEqual(['10', '10', '1', '1', '1']);
    expect(observed['frogJumpTotal']).toBe('23');
    expect(observed['frogAt']).toBe('58');
    assertSerializable(state);
    assertSerializable(observed);
  });

  it('max를 넘는 점프는 무시한다', () => {
    const near = jump(start({ jumpStart: 95 }), ['1', '1', '1', '1', '1']);
    expect(observe(near)['frogAt']).toBe('100');
    const blocked = reduce(near, { type: 'frog-jump', size: '10' });
    expect(blocked).toBe(near);
    expect(observe(blocked)['frogJumps']).toEqual(['1', '1', '1', '1', '1']);
  });

  it('min보다 작아지는 점프는 무시한다', () => {
    const state = jump(start({ jumpStart: 3 }), ['-1', '-1', '-1']);
    expect(observe(state)['frogAt']).toBe('0');
    expect(reduce(state, { type: 'frog-jump', size: '-10' })).toBe(state);
  });

  it('목록에 없는 크기는 무시한다', () => {
    const state = start();
    expect(reduce(state, { type: 'frog-jump', size: '5' })).toBe(state);
    expect(reduce(state, { type: 'frog-jump', size: '0' })).toBe(state);
    expect(reduce(state, { type: 'frog-jump', size: 'x' })).toBe(state);
  });

  it('되돌리기는 마지막 점프 하나만 지우고, 처음부터는 모두 지운다', () => {
    const state = frogConfig();
    const undone = reduce(state, { type: 'frog-undo' });
    expect(observe(undone)['frogJumps']).toEqual(['10', '10', '1', '1']);
    expect(observe(undone)['frogAt']).toBe('57');

    const reset = reduce(state, { type: 'frog-reset' });
    expect(observe(reset)['frogJumps']).toEqual([]);
    expect(observe(reset)['frogAt']).toBe('35');
    expect(reduce(reset, { type: 'frog-undo' })).toBe(reset);
    expect(reduce(reset, { type: 'frog-reset' })).toBe(reset);
  });

  it('jumpStart가 없으면 min에서 시작한다', () => {
    const state = createInitialState({
      mode: 'integer',
      min: 4,
      max: 20,
      jumpButtons: [1],
    });
    expect(observe(state)['frogStart']).toBe('4');
    expect(observe(state)['frogAt']).toBe('4');
  });

  it('jumpButtons가 없거나 integer가 아니면 개구리를 만들지 않는다', () => {
    const plain = createInitialState({ mode: 'integer', min: 0, max: 9 });
    expect(observe(plain)['frogAt']).toBeNull();
    expect(observe(plain)['frogJumps']).toBeNull();

    const fraction = createInitialState({
      mode: 'fraction',
      min: 0,
      max: 1,
      jumpButtons: [1],
    });
    expect(observe(fraction)['frogAt']).toBeNull();
    expect(reduce(fraction, { type: 'frog-jump', size: '1' })).toBe(fraction);
  });
});

describe('T080 개구리 점프 이벤트', () => {
  it('점프마다 jumped와 value-changed를 낸다', () => {
    const prev = start();
    const next = reduce(prev, { type: 'frog-jump', size: '10' });
    expect(emit(prev, next, { type: 'frog-jump', size: '10' })).toEqual([
      { name: 'jumped', payload: { from: '35', to: '45', size: '10' } },
      { name: 'value-changed', payload: { value: '45' } },
    ]);
  });

  it('무시된 점프는 이벤트를 내지 않는다', () => {
    const prev = jump(start({ jumpStart: 95 }), ['1', '1', '1', '1', '1']);
    const next = reduce(prev, { type: 'frog-jump', size: '10' });
    expect(emit(prev, next, { type: 'frog-jump', size: '10' })).toEqual([]);
  });
});

describe('T080 개구리 점프 predicates', () => {
  it('frogAtIs·frogJumpCountIs·frogJumpTotalIs를 판정한다', () => {
    const state = frogConfig();
    const observed = observe(state);
    expect(frogAtIs(observed, { value: '58' })).toBe(true);
    expect(frogAtIs(observed, { value: '57' })).toBe(false);
    expect(frogJumpCountIs(observed, { size: '10', count: 2 })).toBe(true);
    expect(frogJumpCountIs(observed, { size: '10', count: 3 })).toBe(false);
    expect(predicates['frogJumpCountIs']?.(observed, { size: '1', count: 3 })).toBe(true);
  });

  it('frogJumpTotalIs는 음수 합도 판정한다', () => {
    const state = jump(start(), ['-10', '-10', '-10', '-1', '-1', '-1', '-1']);
    const observed = observe(state);
    expect(observed['frogJumpTotal']).toBe('-34');
    expect(frogJumpTotalIs(observed, { value: '-34' })).toBe(true);
    expect(observe(start())['frogJumpTotal']).toBe('0');
    expect(frogJumpTotalIs(observe(start()), { value: '0' })).toBe(true);
  });
});
