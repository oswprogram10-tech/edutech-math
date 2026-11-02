import { describe, expect, it } from 'vitest';
import { emit, hasPointAt, cardsCorrect, jumpTotalIs, predicates, samePoint } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { NumberLineConfig, NumberLineState } from '../types';

function fraction(overrides: NumberLineConfig = {}): NumberLineState {
  return createInitialState({
    mode: 'fraction',
    min: '0',
    max: '1',
    subdivisions: 4,
    ...overrides,
  });
}

describe('E03 emit', () => {
  it('점을 찍으면 point-placed와 value-changed를 낸다', () => {
    const prev = fraction();
    const next = reduce(prev, { type: 'place-point', value: '3/4' });
    expect(emit(prev, next, { type: 'place-point', value: '3/4' })).toEqual([
      { name: 'point-placed', payload: { id: 'p1', value: '3/4' } },
      { name: 'value-changed', payload: { value: '3/4' } },
    ]);
  });

  it('점을 옮기면 point-moved와 value-changed를 낸다', () => {
    const start = reduce(fraction(), { type: 'place-point', value: '3/4' });
    const next = reduce(start, { type: 'move-point', id: 'p1', value: '1/2' });
    expect(emit(start, next, { type: 'move-point', id: 'p1', value: '1/2' })).toEqual([
      { name: 'point-moved', payload: { id: 'p1', value: '1/2' } },
      { name: 'value-changed', payload: { value: '1/2' } },
    ]);
  });

  it('점프는 jumped 하나만 낸다', () => {
    const prev = fraction();
    const next = reduce(prev, { type: 'add-jump', from: '1/4', to: '3/4' });
    expect(emit(prev, next, { type: 'add-jump', from: '1/4', to: '3/4' })).toEqual([
      { name: 'jumped', payload: { from: '1/4', to: '3/4', size: '1/2' } },
    ]);
  });

  it('카드를 꽂으면 카드 값으로 value-changed를 낸다', () => {
    const config: NumberLineConfig = {
      mode: 'fraction',
      min: '0',
      max: '3',
      subdivisions: 4,
      cards: ['1 1/4'],
    };
    const prev = createInitialState(config);
    const next = reduce(prev, { type: 'place-card', card: '1 1/4', value: '5/4' });
    expect(emit(prev, next, { type: 'place-card', card: '1 1/4', value: '5/4' })).toEqual([
      { name: 'card-placed', payload: { card: '1 1/4', value: '5/4' } },
      { name: 'value-changed', payload: { value: '5/4' } },
    ]);
  });

  it('줌은 zoomed에 단계와 눈금을 담는다', () => {
    const prev = createInitialState({ mode: 'decimal', min: '0', max: '1' });
    const next = reduce(prev, { type: 'zoom', level: 2, center: '1/2' });
    expect(emit(prev, next, { type: 'zoom', level: 2, center: '1/2' })).toEqual([
      { name: 'zoomed', payload: { level: 2, tick: '1/100' } },
    ]);
  });

  it('바뀐 것이 없으면 이벤트를 내지 않는다', () => {
    const state = fraction();
    expect(emit(state, state, { type: 'zoom', level: 1, center: '0' })).toEqual([]);
  });
});

describe('E03 predicates', () => {
  it('hasPointAt은 3/4과 0.75를 같은 점으로 본다', () => {
    const state = reduce(fraction(), { type: 'place-point', value: '3/4' });
    const observed = observe(state);
    expect(hasPointAt(observed, { value: '0.75' })).toBe(true);
    expect(hasPointAt(observed, { value: '1/2' })).toBe(false);
    expect(predicates['hasPointAt']?.(observed, { value: '6/8' })).toBe(true);
  });

  it('samePoint와 jumpTotalIs를 판정한다', () => {
    const observed = observe(fraction());
    expect(samePoint(observed, { a: '3/4', b: '0.75' })).toBe(true);
    expect(samePoint(observed, { a: '3/4', b: '2/3' })).toBe(false);
    expect(jumpTotalIs(observed, { value: '0' })).toBe(true);
    expect(predicates['samePoint']?.(observed, { a: '1 1/4', b: '5/4' })).toBe(true);
  });

  it('cardsCorrect는 모든 카드가 자기 값 위치에 있을 때만 참이다', () => {
    const config: NumberLineConfig = {
      mode: 'fraction',
      min: '0',
      max: '3',
      subdivisions: 4,
      cards: ['1 1/4', '5/4'],
    };
    let state = createInitialState(config);
    expect(cardsCorrect(observe(state), undefined)).toBe(false);
    state = reduce(state, { type: 'place-card', card: '1 1/4', value: '5/4' });
    expect(cardsCorrect(observe(state), undefined)).toBe(false);
    state = reduce(state, { type: 'place-card', card: '5/4', value: '5/4' });
    expect(cardsCorrect(observe(state), undefined)).toBe(true);
  });
});
