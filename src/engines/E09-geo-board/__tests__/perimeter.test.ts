/** fixed-perimeter 제약 단위 테스트(T103): 정확한 정수 직사각형·기록표를 확인한다. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { GeoboardConfig, GeoboardState, GeoConfig, GeoState } from '../types';

function predicate(
  name: string,
): (observation: ReturnType<typeof observe>, args?: unknown) => boolean {
  const found = predicates[name];
  if (!found) throw new Error(`predicate ${name} 없음`);
  return (observation, args) => found(observation, args as never);
}

function geoboardState(state: GeoState): GeoboardState {
  if (state.mode !== 'geoboard') throw new Error('geoboard 상태가 아님');
  return state;
}

const PERIMETER_20: GeoboardConfig = {
  mode: 'geoboard',
  grid: [12, 12],
  constraint: { type: 'fixed-perimeter', value: 20, shape: 'rectangle' },
};

describe('fixed-perimeter 처음 직사각형', () => {
  it('둘레 20·12×12 격자는 3×7로 시작하고 넓이는 21이다', () => {
    const state = createInitialState(PERIMETER_20);
    expect(geoboardState(state).settings.constraint).toEqual({
      type: 'fixed-perimeter',
      value: 20,
      shape: 'rectangle',
    });
    expect(observe(state).rect).toEqual({ width: 3, height: 7, perimeter: 20, area: 21 });
    assertSerializable(state);
  });

  it('resize-rect {5,5}로 바꾸면 넓이가 25다', () => {
    let state: GeoState = createInitialState(PERIMETER_20);
    state = reduce(state, { type: 'resize-rect', width: 5, height: 5 });
    expect(observe(state).rect).toEqual({ width: 5, height: 5, perimeter: 20, area: 25 });
    expect(predicate('currentRect')(observe(state), { width: 5, height: 5 })).toBe(true);
  });

  it('합이 반둘레가 아니거나 범위 밖이면 거절한다', () => {
    let state: GeoState = createInitialState(PERIMETER_20);
    state = reduce(state, { type: 'resize-rect', width: 4, height: 7 });
    expect(observe(state).rect).toEqual({ width: 3, height: 7, perimeter: 20, area: 21 });
    state = reduce(state, { type: 'resize-rect', width: 0, height: 10 });
    expect(observe(state).rect).toEqual({ width: 3, height: 7, perimeter: 20, area: 21 });
  });

  it('제약이 있으면 move-peg·start-band 같은 고무줄 편집을 무시한다', () => {
    let state: GeoState = createInitialState(PERIMETER_20);
    const before = geoboardState(state).bands;
    state = reduce(state, { type: 'move-peg', band: 'b1', index: 0, peg: [1, 1] });
    state = reduce(state, { type: 'start-band', peg: [2, 2] });
    state = reduce(state, { type: 'add-peg', peg: [4, 4] });
    expect(geoboardState(state).bands).toEqual(before);
  });
});

describe('fixed-perimeter 기록표', () => {
  it('같은 순서쌍은 한 줄이고 (3,7)·(7,3)은 두 줄이다', () => {
    let state: GeoState = createInitialState({ ...PERIMETER_20, log: true });
    state = reduce(state, { type: 'log-rect' });
    state = reduce(state, { type: 'log-rect' });
    expect(observe(state).log).toEqual([{ width: 3, height: 7, area: 21 }]);

    state = reduce(state, { type: 'resize-rect', width: 7, height: 3 });
    state = reduce(state, { type: 'log-rect' });
    expect(observe(state).log).toEqual([
      { width: 3, height: 7, area: 21 },
      { width: 7, height: 3, area: 21 },
    ]);
    expect(predicate('loggedDistinctRects')(observe(state), { count: 2 })).toBe(true);
    assertSerializable(state);
  });

  it('loggedRect는 (가로, 세로) 순서와 상관없이 본다', () => {
    let state: GeoState = createInitialState({ ...PERIMETER_20, log: true });
    state = reduce(state, { type: 'resize-rect', width: 1, height: 9 });
    state = reduce(state, { type: 'log-rect' });
    const observation = observe(state);
    expect(predicate('loggedRect')(observation, { width: 9, height: 1 })).toBe(true);
    expect(predicate('loggedRect')(observation, { width: 2, height: 8 })).toBe(false);
    expect(predicate('loggedDistinctRects')(observation, { count: 1 })).toBe(true);
    expect(predicate('loggedDistinctRects')(observation, { count: 2 })).toBe(false);
  });

  it('log가 꺼져 있으면 기록하지 않는다', () => {
    let state: GeoState = createInitialState(PERIMETER_20);
    state = reduce(state, { type: 'log-rect' });
    expect(observe(state).log).toEqual([]);
  });

  it('state.log가 없어도 빈 기록표로 관찰한다', () => {
    const state = { ...geoboardState(createInitialState(PERIMETER_20)), log: undefined };
    expect(observe(state as unknown as GeoState).log).toEqual([]);
  });
});

describe('fixed-perimeter 설정 검사', () => {
  it('홀수 21이면 제약 없음(일반 geoboard)이다', () => {
    const state = createInitialState({
      mode: 'geoboard',
      grid: [12, 12],
      constraint: { type: 'fixed-perimeter', value: 21, shape: 'rectangle' },
    });
    expect(geoboardState(state).settings.constraint).toBeNull();
    expect(observe(state).constraint).toBeNull();
    expect(observe(state).rect).toBeNull();
  });

  it('격자에 들어가는 직사각형이 없으면 제약 없음이다', () => {
    const state = createInitialState({
      mode: 'geoboard',
      grid: [5, 5],
      constraint: { type: 'fixed-perimeter', value: 30, shape: 'rectangle' },
    });
    expect(geoboardState(state).settings.constraint).toBeNull();
    expect(geoboardState(state).log).toEqual([]);
  });

  it('제약 없는 geoboard는 T100처럼 동작한다', () => {
    const config: GeoConfig = { mode: 'geoboard', grid: [5, 5] };
    const state = createInitialState(config);
    expect(geoboardState(state).settings.constraint).toBeNull();
    expect(geoboardState(state).settings.openShapes).toEqual([]);
    expect(geoboardState(state).log).toEqual([]);
  });
});
