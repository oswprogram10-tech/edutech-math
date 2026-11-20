/** E13 capacity 순수 로직 테스트: 설정, cup-count 붓기, puzzle 도달 순서, 거절 경계, predicates, JSON 왕복. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { capacityPredicates } from '../capacity/events';
import { observeCapacity } from '../capacity/observe';
import { createCapacityState, reduceCapacity } from '../capacity/reduce';
import { boardHeight, containerGeo } from '../capacity/layout';
import type { CapacityAction, CapacityConfig, CapacityState } from '../capacity/types';
import definition from '../index';

const cups: CapacityConfig = {
  mode: 'capacity',
  variant: 'cup-count',
  containers: [
    { id: 'bottle', kind: 'bottle', shape: 'tall', capacityMl: 600 },
    { id: 'bowl', kind: 'bowl', shape: 'wide', capacityMl: 500 },
  ],
  cupMl: 100,
};
const puzzle: CapacityConfig = {
  mode: 'capacity',
  variant: 'puzzle',
  containers: [
    { id: 'b300', capacityMl: 300, marks: false },
    { id: 'b500', capacityMl: 500, marks: false },
  ],
  source: 'infinite',
  targetMl: 100,
};

function play(state: CapacityState, ...actions: CapacityAction[]): CapacityState {
  return actions.reduce(reduceCapacity, state);
}
const make = (config: CapacityConfig) => createCapacityState(config);
const obs = (state: CapacityState) => observeCapacity(state);
const pour = (from: string, to: string): CapacityAction => ({ type: 'pour', from, to });
const fill = (id: string): CapacityAction => ({ type: 'fill', id });
const empty = (id: string): CapacityAction => ({ type: 'empty', id });
const cup = (id: string): CapacityAction => ({ type: 'pour-cup', id });

describe('설정', () => {
  it('설정이 mode뿐이면 cup-count 샌드박스 기본, variant만 puzzle이면 puzzle 기본', () => {
    const a = make({ mode: 'capacity' });
    expect(a.error).toBeNull();
    expect(a.variant).toBe('cup-count');
    expect(a.containers.map((c) => c.label)).toEqual(['병', '그릇']);
    const b = make({ mode: 'capacity', variant: 'puzzle' });
    expect(b.error).toBeNull();
    expect(b.containers.map((c) => c.label)).toEqual(['비커 가', '비커 나']);
    expect(b.targetMl).toBe('100');
  });

  it('cupMl 기본은 100이고, 들이는 정수 mL 문자열로 저장된다', () => {
    const state = make({ ...cups, cupMl: undefined });
    expect(state.cupMl).toBe('100');
    expect(state.containers.map((c) => c.capacityMl)).toEqual(['600', '500']);
  });

  it('정수 문자열 들이도 받는다', () => {
    const state = make({
      ...cups,
      containers: [{ id: 'a', capacityMl: '300', kind: 'beaker', shape: 'tall' }],
      cupMl: '100',
    });
    expect(state.error).toBeNull();
  });

  it.each([
    ['들이가 컵의 배수가 아님', { containers: [{ id: 'a', capacityMl: 250 }] }],
    ['그릇이 없음', { containers: [] }],
    ['그릇이 셋', { containers: [1, 2, 3].map((n) => ({ id: `c${n}`, capacityMl: 100 })) }],
    [
      'id가 같음',
      {
        containers: [
          { id: 'a', capacityMl: 100 },
          { id: 'a', capacityMl: 200 },
        ],
      },
    ],
    ['들이 0', { containers: [{ id: 'a', capacityMl: 0 }] }],
    ['들이가 소수', { containers: [{ id: 'a', capacityMl: 150.5 }] }],
    ['들이가 음수', { containers: [{ id: 'a', capacityMl: -100 }] }],
    ['들이가 너무 큼', { containers: [{ id: 'a', capacityMl: 100000 }], cupMl: 100 }],
    ['모르는 그릇 종류', { containers: [{ id: 'a', capacityMl: 100, kind: 'jar' as never }] }],
    ['모르는 모양', { containers: [{ id: 'a', capacityMl: 100, shape: 'round' as never }] }],
    ['cupMl 0', { cupMl: 0 }],
    [
      '같은 이름',
      {
        containers: [
          { id: 'a', capacityMl: 100, label: '병' },
          { id: 'b', capacityMl: 200, label: '병' },
        ],
      },
    ],
    ['모르는 variant', { variant: 'free' as never }],
  ] as const)('잘못된 cup-count 설정(%s)은 오류 상태이고 조작은 거절된다', (_n, partial) => {
    const state = make({ ...cups, ...partial } as CapacityConfig);
    expect(state.error).not.toBeNull();
    expect(play(state, cup('bottle'))).toBe(state);
    expect(obs(state)).toMatchObject({ error: true, misconceptions: [] });
  });

  it.each([
    ['그릇이 하나', { containers: [{ id: 'a', capacityMl: 300 }] }],
    ['그릇이 셋', { containers: [1, 2, 3].map((n) => ({ id: `c${n}`, capacityMl: 300 })) }],
    [
      '눈금 있음',
      {
        containers: [
          { id: 'a', capacityMl: 300, marks: true as never },
          { id: 'b', capacityMl: 500 },
        ],
      },
    ],
    ['targetMl 없음', { targetMl: undefined }],
    ['targetMl이 가장 큰 그릇보다 큼', { targetMl: 501 }],
    ['source가 무한이 아님', { source: 'finite' as never }],
  ] as const)('잘못된 puzzle 설정(%s)은 오류 상태', (_n, partial) => {
    expect(make({ ...puzzle, ...partial } as CapacityConfig).error).not.toBeNull();
  });

  it('경계: targetMl이 가장 큰 그릇과 같아도, 1이어도 허용', () => {
    expect(make({ ...puzzle, targetMl: 500 }).error).toBeNull();
    expect(make({ ...puzzle, targetMl: 1 }).error).toBeNull();
  });
});

describe('cup-count', () => {
  it('컵 하나씩 붓고, 컵 횟수는 정수로 센다', () => {
    const state = play(make(cups), cup('bottle'), cup('bottle'), cup('bowl'));
    expect(state.amounts).toEqual({ bottle: '200', bowl: '100' });
    expect(obs(state)).toMatchObject({
      cups: { bottle: 2, bowl: 1 },
      full: { bottle: false, bowl: false },
      allFull: false,
    });
  });

  it('가득 차면 더 붓기를 거절한다(병은 6번, 그릇은 5번)', () => {
    let state = make(cups);
    for (let i = 0; i < 6; i += 1) state = play(state, cup('bottle'));
    expect(obs(state)).toMatchObject({ cups: { bottle: 6 }, full: { bottle: true } });
    expect(play(state, cup('bottle'))).toBe(state);
    for (let i = 0; i < 5; i += 1) state = play(state, cup('bowl'));
    expect(obs(state)).toMatchObject({ allFull: true });
    expect(play(state, cup('bowl'))).toBe(state);
  });

  it('[비우기]는 그 그릇만 0으로 되돌리고, 이미 비었으면 거절한다', () => {
    const state = play(make(cups), cup('bottle'), cup('bowl'), empty('bottle'));
    expect(state.amounts).toEqual({ bottle: '0', bowl: '100' });
    expect(play(state, empty('bottle'))).toBe(state);
  });

  it('puzzle 전용 Action(fill·pour)은 거절된다', () => {
    const state = make(cups);
    expect(play(state, fill('bottle'))).toBe(state);
    expect(play(state, pour('bottle', 'bowl'))).toBe(state);
  });

  it('모르는 그릇은 거절된다', () => {
    const state = make(cups);
    expect(play(state, cup('jar'))).toBe(state);
  });

  it('moreId는 들이가 큰 그릇, 같으면 빈 문자열, 그릇이 하나여도 빈 문자열', () => {
    expect(obs(make(cups))['moreId']).toBe('bottle');
    const same = make({
      ...cups,
      containers: [
        { id: 'a', kind: 'bottle', shape: 'tall', capacityMl: 400 },
        { id: 'b', kind: 'bowl', shape: 'wide', capacityMl: 400 },
      ],
    });
    expect(obs(same)['moreId']).toBe('');
    const one = make({ ...cups, containers: [{ id: 'a', capacityMl: 300 }] });
    expect(obs(one)['moreId']).toBe('');
  });

  it('같은 종류가 둘이면 가·나를 붙인다', () => {
    const state = make({
      ...cups,
      containers: [
        { id: 'a', kind: 'bottle', capacityMl: 400 },
        { id: 'b', kind: 'bottle', capacityMl: 600 },
      ],
    });
    expect(state.containers.map((c) => c.label)).toEqual(['병 가', '병 나']);
  });

  it('[처음으로]는 모두 비우고, 이미 처음이면 거절한다', () => {
    const state = play(make(cups), cup('bottle'), cup('bowl'));
    const reset = play(state, { type: 'reset' });
    expect(reset.amounts).toEqual({ bottle: '0', bowl: '0' });
    expect(play(reset, { type: 'reset' })).toBe(reset);
  });

  it('Predicates: allFull, full, cupsIs', () => {
    let state = make({
      ...cups,
      containers: [
        { id: 'a', capacityMl: 200 },
        { id: 'b', capacityMl: 300 },
      ],
    });
    state = play(state, cup('a'), cup('a'), cup('b'));
    const o = obs(state);
    expect(capacityPredicates['full']?.(o, { id: 'a' })).toBe(true);
    expect(capacityPredicates['full']?.(o, { id: 'b' })).toBe(false);
    expect(capacityPredicates['allFull']?.(o, undefined)).toBe(false);
    expect(capacityPredicates['cupsIs']?.(o, { id: 'a', n: 2 })).toBe(true);
    expect(capacityPredicates['cupsIs']?.(o, { id: 'b', n: 2 })).toBe(false);
    expect(capacityPredicates['cupsIs']?.(o, { id: 'b', n: 0 })).toBe(false);
    state = play(state, cup('b'), cup('b'));
    expect(capacityPredicates['allFull']?.(obs(state), undefined)).toBe(true);
  });
});

describe('puzzle', () => {
  it('채우기는 가득, 이미 가득이면 거절된다', () => {
    const state = play(make(puzzle), fill('b300'));
    expect(state.amounts['b300']).toBe('300');
    expect(play(state, fill('b300'))).toBe(state);
  });

  it('붓기는 받는 쪽이 가득 차거나 주는 쪽이 빌 때까지다', () => {
    let state = play(make(puzzle), fill('b300'), pour('b300', 'b500'));
    expect(state.amounts).toEqual({ b300: '0', b500: '300' });
    state = play(state, fill('b300'), pour('b300', 'b500'));
    expect(state.amounts).toEqual({ b300: '100', b500: '500' });
  });

  it('100mL: 300 채움 → 500에 부음 → 300 채움 → 500에 부음(500 가득, 300에 100)', () => {
    const state = play(
      make(puzzle),
      fill('b300'),
      pour('b300', 'b500'),
      fill('b300'),
      pour('b300', 'b500'),
    );
    expect(state.amounts).toEqual({ b300: '100', b500: '500' });
    expect(state.steps).toBe(4);
    expect(obs(state)).toMatchObject({ reached: true, reachedIn: 'b300', steps: 4 });
  });

  it('400mL은 두 비커 합으로는 못 만들고(최대 500), "어느 비커에 400"으로 만든다', () => {
    const target400 = { ...puzzle, targetMl: 400 } as CapacityConfig;
    // 500 채움 → 300에 부음(200) → 300 비움 → 200 옮김 → 500 채움 → 300에 100 부음 → 500에 400
    const state = play(
      make(target400),
      fill('b500'),
      pour('b500', 'b300'),
      empty('b300'),
      pour('b500', 'b300'),
      fill('b500'),
      pour('b500', 'b300'),
    );
    expect(state.amounts).toEqual({ b300: '300', b500: '400' });
    expect(state.steps).toBe(6);
    expect(obs(state)).toMatchObject({ reached: true, reachedIn: 'b500' });
  });

  it('도달 전에는 reached가 false이고 reachedIn은 null이다', () => {
    const state = play(make(puzzle), fill('b300'));
    expect(obs(state)).toMatchObject({ reached: false, reachedIn: null });
    expect(obs(make(puzzle))).toMatchObject({ amounts: { b300: '0', b500: '0' }, steps: 0 });
  });

  it('거절 경계: 이미 빔·이미 가득·빈 비커에서 붓기·가득 찬 비커로 붓기·같은 비커로 붓기', () => {
    const start = make(puzzle);
    expect(play(start, empty('b300'))).toBe(start);
    expect(play(start, pour('b300', 'b500'))).toBe(start);
    expect(play(start, pour('b300', 'b300'))).toBe(start);
    const full = play(start, fill('b500'), fill('b300'));
    expect(play(full, pour('b300', 'b500'))).toBe(full);
    expect(play(full, fill('b500'))).toBe(full);
    expect(play(full, pour('b300', 'jar'))).toBe(full);
    expect(play(full, cup('b300'))).toBe(full);
  });

  it('[처음으로]는 모두 비우고 steps를 0으로, 이미 처음이면 거절한다', () => {
    const state = play(make(puzzle), fill('b300'));
    const reset = play(state, { type: 'reset' });
    expect(reset.amounts).toEqual({ b300: '0', b500: '0' });
    expect(reset.steps).toBe(0);
    expect(play(reset, { type: 'reset' })).toBe(reset);
  });

  it('Predicates: reached, amountIs, stepsAtMost', () => {
    const state = play(
      make(puzzle),
      fill('b300'),
      pour('b300', 'b500'),
      fill('b300'),
      pour('b300', 'b500'),
    );
    const o = obs(state);
    expect(capacityPredicates['reached']?.(o, undefined)).toBe(true);
    expect(capacityPredicates['amountIs']?.(o, { id: 'b300', ml: 100 })).toBe(true);
    expect(capacityPredicates['amountIs']?.(o, { id: 'b500', ml: 500 })).toBe(true);
    expect(capacityPredicates['amountIs']?.(o, { id: 'b500', ml: 100 })).toBe(false);
    expect(capacityPredicates['amountIs']?.(o, { id: 'b500', ml: 0 })).toBe(false);
    expect(capacityPredicates['stepsAtMost']?.(o, { n: 4 })).toBe(true);
    expect(capacityPredicates['stepsAtMost']?.(o, { n: 3 })).toBe(false);
    expect(capacityPredicates['reached']?.(obs(make(puzzle)), undefined)).toBe(false);
  });
});

describe('JSON·엔진 정의·판 높이', () => {
  it('상태와 Observation은 JSON 직렬화가 되고 왕복해도 같다', () => {
    const state = play(make(puzzle), fill('b300'), pour('b300', 'b500'));
    assertSerializable(state);
    assertSerializable(obs(state));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    const cupState = play(make(cups), cup('bottle'));
    assertSerializable(cupState);
    expect(JSON.parse(JSON.stringify(cupState))).toEqual(cupState);
  });

  it('엔진 정의가 capacity 모드와 새 predicates·오버레이를 갖는다', () => {
    expect(definition.modes).toContain('capacity');
    for (const name of ['allFull', 'full', 'cupsIs', 'reached', 'amountIs', 'stepsAtMost']) {
      expect(definition.predicates?.[name]).toBeTypeOf('function');
    }
    for (const name of ['same-beaker', 'liter-cups', 'ml-merge']) {
      expect(definition.overlays?.[name]).toBeTypeOf('function');
    }
  });

  it('논리 높이는 변형마다 일정하고 600 이하다(그릇 바닥 + 점선 비커 자리)', () => {
    expect(boardHeight(make(cups))).toBe(520);
    expect(boardHeight(make(puzzle))).toBe(580);
    expect(boardHeight(make({ mode: 'capacity' }))).toBe(520);
  });

  it('puzzle 비커는 들이에 비례해 높고(눈금은 없다) 판 안에 들어온다', () => {
    const state = make(puzzle);
    const small = containerGeo(state, 0);
    const big = containerGeo(state, 1);
    expect(big.h).toBeGreaterThan(small.h);
    expect(big.h).toBe(280);
    expect(big.base - big.h).toBeGreaterThanOrEqual(0);
  });

  it('hasMisconception predicate는 observation의 misconceptions를 본다(기존 모드에도 작동)', () => {
    const predicate = definition.predicates?.['hasMisconception'];
    expect(predicate?.({ misconceptions: ['MC-X'] }, { code: 'MC-X' })).toBe(true);
    expect(predicate?.({ misconceptions: ['MC-X'] }, { code: 'MC-Y' })).toBe(false);
    expect(predicate?.({ misconceptions: [] }, { code: 'MC-X' })).toBe(false);
    expect(predicate?.({}, { code: 'MC-X' })).toBe(false);
    expect(predicate?.({ misconceptions: ['MC-X'] }, undefined)).toBe(false);
  });
});
