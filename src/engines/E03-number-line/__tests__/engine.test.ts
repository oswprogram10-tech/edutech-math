import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { receive } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce, snapValue } from '../reduce';
import { pinchLevel, sameValue, zoomDeltaForPinch } from '../ticks';
import type { NumberLineAction, NumberLineConfig, NumberLineState } from '../types';

function make(config: NumberLineConfig = {}): NumberLineState {
  return createInitialState(config);
}

function fraction(overrides: NumberLineConfig = {}): NumberLineState {
  return make({ mode: 'fraction', min: '0', max: '1', subdivisions: 4, ...overrides });
}

function decimal(overrides: NumberLineConfig = {}): NumberLineState {
  return make({ mode: 'decimal', min: '0', max: '1', ...overrides });
}

describe('E03 눈금 스냅', () => {
  it('정수 눈금은 unit 간격이고 범위 밖은 min·max로 자른다', () => {
    const state = make({ mode: 'integer', min: '0', max: '9', unit: '1' });
    expect(snapValue(state, '-5')?.toJSON()).toBe('0');
    expect(snapValue(state, '99')?.toJSON()).toBe('9');
    expect(snapValue(state, '2.6')?.toJSON()).toBe('3');
  });

  it('fraction은 1/subdivisions 간격으로 스냅한다', () => {
    const state = fraction();
    expect(snapValue(state, '0.37')?.toJSON()).toBe('1/4');
    // 1/4과 1/2의 정중앙(3/8)은 큰 쪽 눈금으로 보낸다.
    expect(snapValue(state, '3/8')?.toJSON()).toBe('1/2');
    expect(snapValue(state, '0.99')?.toJSON()).toBe('1');
  });

  it('max가 눈금에 딱 맞지 않아도 마지막 눈금을 넘지 않는다', () => {
    const state = make({ mode: 'fraction', min: '0', max: '1', subdivisions: 3 });
    expect(snapValue(state, '10')?.toJSON()).toBe('1');
  });

  it('줄이 여럿이면 y에 가까운 줄의 눈금을 쓴다', () => {
    const state = make({
      mode: 'fraction',
      min: '0',
      max: '1',
      subdivisions: [3, 5],
    });
    const observed = observe(state);
    expect(observed['rows']).toEqual([
      { subdivisions: 3, tick: '1/3' },
      { subdivisions: 5, tick: '1/5' },
    ]);
    expect(observed['tick']).toBe('1/3');
  });
});

describe('E03 점과 카드', () => {
  it('점을 찍으면 Rational 문자열로 저장하고 오름차순으로 관찰한다', () => {
    let state = fraction();
    state = reduce(state, { type: 'place-point', value: '3/4' });
    state = reduce(state, { type: 'place-point', value: '1/4' });
    const observed = observe(state);
    expect(observed['points']).toEqual([{ value: '1/4' }, { value: '3/4' }]);
    expect(observed['pointPlaced']).toBe(2);
    expect(observed['valueChanged']).toBe(2);
  });

  it('3/4과 0.75는 같은 점으로 기록된다', () => {
    let state = fraction();
    state = reduce(state, { type: 'place-point', value: '3/4' });
    const afterFraction = state;
    state = reduce(state, { type: 'place-point', value: '0.75' });
    expect(afterFraction.points[0]?.value).toBe('3/4');
    expect(state.points[0]?.value).toBe('3/4');
    expect(state.points[1]?.value).toBe('3/4');
    expect(sameValue('3/4', '0.75')).toBe(true);
    expect(observe(state)['hasSamePoint']).toBe(true);
  });

  it('대분수 카드를 자기 자리에 꽂으면 cardsCorrect가 참이 된다', () => {
    let state = make({
      mode: 'fraction',
      min: '0',
      max: '3',
      subdivisions: 4,
      cards: ['1 1/4', '5/4'],
    });
    state = reduce(state, {
      type: 'place-card',
      card: '1 1/4',
      value: '5/4',
    });
    state = reduce(state, {
      type: 'place-card',
      card: '5/4',
      value: '1 1/4',
    });
    const observed = observe(state);
    expect(observed['cards']).toEqual({ '1 1/4': '5/4', '5/4': '5/4' });
    expect(observed['cardsCorrect']).toBe(true);
    expect(observed['samePointGroups']).toEqual([
      { value: '5/4', sources: ['card:1 1/4', 'card:5/4'] },
    ]);
  });

  it('카드를 엉뚱한 자리에 꽂으면 cardsCorrect가 거짓이다', () => {
    let state = make({
      mode: 'fraction',
      min: '0',
      max: '1',
      subdivisions: 4,
      cards: ['3/4'],
    });
    state = reduce(state, { type: 'place-card', card: '3/4', value: '1/2' });
    expect(observe(state)['cardsCorrect']).toBe(false);
  });
});

describe('E03 점프', () => {
  it('점프 크기와 합계를 Rational로 낸다', () => {
    let state = fraction();
    state = reduce(state, { type: 'add-jump', from: '1/4', to: '3/4' });
    state = reduce(state, { type: 'add-jump', from: '0', to: '1/4' });
    const observed = observe(state);
    expect(observed['jumps']).toEqual([
      { from: '1/4', to: '3/4', size: '1/2' },
      { from: '0', to: '1/4', size: '1/4' },
    ]);
    expect(observed['jumpTotal']).toBe('3/4');
  });

  it('같은 곳으로 가는 점프는 만들지 않는다', () => {
    const state = fraction();
    expect(reduce(state, { type: 'add-jump', from: '1/2', to: '2/4' })).toBe(state);
  });
});

describe('E03 줌', () => {
  it('decimal은 1 → 1/10 → 1/100 → 1/1000 단계로 간다', () => {
    let state = decimal({ zoom: { from: '1', to: '1/1000' } });
    expect(observe(state)['tick']).toBe('1');
    state = reduce(state, { type: 'zoom', level: 1 });
    expect(observe(state)['tick']).toBe('1/10');
    state = reduce(state, { type: 'zoom', level: 2 });
    expect(observe(state)['tick']).toBe('1/100');
    state = reduce(state, { type: 'zoom', level: 3 });
    expect(observe(state)['tick']).toBe('1/1000');
  });

  it('줌 범위를 넘으면 경계에서 멈춘다', () => {
    const state = decimal({ zoom: { from: '1', to: '1/100' } });
    const high = reduce(state, { type: 'zoom', level: 99 });
    expect(high.zoomLevel).toBe(2);
    expect(observe(high)['tick']).toBe('1/100');
    const low = reduce(high, { type: 'zoom', level: -99 });
    expect(low.zoomLevel).toBe(0);
    expect(observe(low)['tick']).toBe('1');
  });

  it('핀치 배율을 눈금 단계로 바꾸고 범위를 지킨다', () => {
    expect(zoomDeltaForPinch(1, 1, 0.25)).toBe(0);
    expect(zoomDeltaForPinch(1, 1.1, 0.25)).toBe(0);
    expect(zoomDeltaForPinch(1, 1.5, 0.25)).toBe(2);
    expect(zoomDeltaForPinch(1.5, 1, 0.25)).toBe(-2);
    expect(pinchLevel(0, 1, 1.5, 0, 3, 0.25)).toBe(2);
    expect(pinchLevel(2, 1, 1.5, 0, 3, 0.25)).toBe(3);
    expect(pinchLevel(0, 1, 0.5, 0, 3, 0.25)).toBe(0);
  });
});

describe('E03 연결 점', () => {
  it('value-changed를 받으면 학생 점을 만들지 않고 연결 점만 표시한다', () => {
    const state = fraction();
    const action = receive(state, { name: 'value-changed', payload: { value: '0.75' } });
    expect(action).toEqual({ type: 'set-linked', value: '3/4' });
    const next = reduce(state, action as NumberLineAction);
    expect(next.linkedValue).toBe('3/4');
    expect(next.points).toEqual([]);
    expect(observe(next)['linkedValue']).toBe('3/4');
  });

  it('다른 이벤트와 잘못된 payload는 무시한다', () => {
    const state = fraction();
    expect(receive(state, { name: 'zoomed', payload: { level: 1 } })).toBeNull();
    expect(receive(state, { name: 'value-changed', payload: { value: 'x' } })).toBeNull();
  });
});

describe('E03 직렬화', () => {
  it('모든 Action 뒤 상태가 JSON으로 직렬화된다', () => {
    const actions: NumberLineAction[] = [
      { type: 'place-point', value: '3/4' },
      { type: 'move-point', id: 'p1', value: '1/2' },
      { type: 'select-point', id: 'p1' },
      { type: 'add-jump', from: '0', to: '3/4' },
      { type: 'zoom', level: 1 },
      { type: 'zoom', level: 0 },
      { type: 'remove-point', id: 'p1' },
    ];
    let state = decimal();
    assertSerializable(state);
    for (const action of actions) {
      state = reduce(state, action);
      assertSerializable(state);
    }
  });

  it('카드가 있는 상태도 직렬화된다', () => {
    const state = make({
      mode: 'fraction',
      min: '0',
      max: '3',
      subdivisions: [3, 4],
      cards: ['1 1/4', '5/4'],
      laser: true,
      showJumps: true,
    });
    assertSerializable(state);
    assertSerializable(observe(state));
  });
});
