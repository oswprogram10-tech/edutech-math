/** E14 time-calc 순수 로직 테스트: 설정, 묶기·풀기·빼기, Observation, 오개념 기록, predicates, JSON 왕복. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import definition from '../index';
import { TIMECALC_EVENT_NAMES, emitTimeCalc, timeCalcPredicates } from '../timecalc/events';
import { MIN_HEIGHT, boardHeight, bigRows } from '../timecalc/layout';
import { observeTimeCalc } from '../timecalc/observe';
import { createTimeCalcState, reduceTimeCalc } from '../timecalc/reduce';
import { splitSmall } from '../timecalc/settings';
import type { TimeCalcAction, TimeCalcConfig, TimeCalcState } from '../timecalc/types';

const add: TimeCalcConfig = {
  mode: 'time-calc',
  op: 'add',
  a: { h: 1, m: 45, s: 0 },
  b: { h: 0, m: 30, s: 0 },
  units: ['h', 'm'],
};
const sub: TimeCalcConfig = {
  mode: 'time-calc',
  op: 'sub',
  a: { h: 3, m: 10, s: 0 },
  b: { h: 1, m: 40, s: 0 },
  units: ['h', 'm'],
};
const seconds: TimeCalcConfig = {
  mode: 'time-calc',
  op: 'add',
  a: { m: 1, s: 40 },
  b: { m: 0, s: 50 },
  units: ['m', 's'],
};

function make(config: TimeCalcConfig = add): TimeCalcState {
  return createTimeCalcState(config);
}
function play(state: TimeCalcState, ...actions: TimeCalcAction[]): TimeCalcState {
  return actions.reduce(reduceTimeCalc, state);
}
const bundle: TimeCalcAction = { type: 'bundle' };
const unbundle: TimeCalcAction = { type: 'unbundle' };
const takeAway: TimeCalcAction = { type: 'take-away' };
const reset: TimeCalcAction = { type: 'reset' };
const obs = (state: TimeCalcState) => observeTimeCalc(state);

describe('설정', () => {
  it('설정이 mode뿐이면 샌드박스 기본(1시간 45분 + 30분)을 쓴다', () => {
    const state = make({ mode: 'time-calc' });
    expect(state.error).toBeNull();
    expect(state).toMatchObject({ op: 'add', units: 'hm', big: 1, small: 75 });
  });

  it('add는 두 값을 처음부터 한 줄에 합쳐 놓는다(정규화 전)', () => {
    expect(make()).toMatchObject({ big: 1, small: 75, maxBig: 2 });
    expect(make(seconds)).toMatchObject({ units: 'ms', big: 1, small: 90 });
  });

  it('sub는 a만 놓고 뺄 시간 글을 만든다', () => {
    const state = make(sub);
    expect(state).toMatchObject({ big: 3, small: 10, maxBig: 3, bText: '1시간 40분' });
    expect(make({ ...sub, b: { m: 30 } }).bText).toBe('30분');
    expect(make({ ...sub, b: { h: 2 } }).bText).toBe('2시간');
    expect(make({ ...sub, b: { h: 0, m: 0 } }).bText).toBe('0분');
    expect(
      make({
        mode: 'time-calc',
        op: 'sub',
        a: { m: 5, s: 20 },
        b: { m: 2, s: 30 },
        units: ['m', 's'],
      }).bText,
    ).toBe('2분 30초');
  });

  it.each([
    ['분이 60', { a: { h: 1, m: 60 } }],
    ['초가 60', { b: { m: 10, s: 60 } }],
    ['음수', { a: { h: -1, m: 10 } }],
    ['소수', { a: { h: 1, m: 10.5 } }],
    ['글', { a: { h: '1' as unknown as number, m: 10 } }],
    ['모르는 키', { a: { d: 1 } as never }],
    ['시·분 단위인데 초가 있음', { a: { h: 1, m: 10, s: 5 } }],
    ['분·초 단위인데 시가 있음', { a: { h: 1, m: 10 }, units: ['m', 's'] }],
    ['a가 객체가 아님', { a: 5 as never }],
    ['units가 뒤바뀜', { units: ['m', 'h'] }],
    ['units가 하나', { units: ['h'] }],
    ['units가 없음', { units: undefined }],
    ['op가 모름', { op: 'mul' as never }],
  ] as const)('잘못된 설정(%s)은 오류 상태이고 조작은 거절된다', (_name, partial) => {
    const state = make({ ...add, ...partial } as TimeCalcConfig);
    expect(state.error).not.toBeNull();
    expect(play(state, bundle, unbundle, takeAway)).toBe(state);
    expect(obs(state)).toMatchObject({ error: true, misconceptions: [] });
  });

  it('sub에서 a < b이면 설정 오류, a = b는 허용', () => {
    expect(make({ ...sub, a: { h: 1, m: 30 }, b: { h: 1, m: 40 } }).error).not.toBeNull();
    expect(make({ ...sub, a: { h: 1, m: 40 }, b: { h: 1, m: 40 } }).error).toBeNull();
    expect(make({ ...sub, a: { h: 1, m: 0 }, b: { h: 0, m: 59 } }).error).toBeNull();
  });

  it('경계: 0, 큰 단위 9, 분 59는 허용. 큰 단위가 9칸을 넘을 수 있으면 오류', () => {
    expect(make({ ...add, a: { h: 0, m: 0 }, b: { h: 0, m: 0 } }).error).toBeNull();
    expect(make({ ...sub, a: { h: 9, m: 59 }, b: { h: 0, m: 0 } }).error).toBeNull();
    expect(make({ ...sub, a: { h: 10, m: 0 }, b: { h: 0, m: 0 } }).error).not.toBeNull();
    // 합치면 8시간 118분: 묶으면 9칸이라 허용, 9시간 118분이면 10칸이라 오류.
    expect(make({ ...add, a: { h: 4, m: 59 }, b: { h: 4, m: 59 } }).error).toBeNull();
    expect(make({ ...add, a: { h: 5, m: 59 }, b: { h: 4, m: 59 } }).error).not.toBeNull();
  });
});

describe('묶기·풀기·빼기', () => {
  it('1:45 + 0:30 → 묶기 → 2:15', () => {
    const start = make();
    expect(obs(start)).toMatchObject({ big: 1, small: 75, normalized: false });
    const done = play(start, bundle);
    expect(obs(done)).toMatchObject({ big: 2, small: 15, normalized: true, bundles: 1 });
  });

  it('묶기는 작은 단위가 60 미만이면 거절한다(경계 59)', () => {
    const state = make({ ...add, a: { h: 1, m: 29 }, b: { h: 0, m: 30 } });
    expect(state.small).toBe(59);
    expect(play(state, bundle)).toBe(state);
    const sixty = make({ ...add, a: { h: 1, m: 30 }, b: { h: 0, m: 30 } });
    expect(sixty.small).toBe(60);
    expect(play(sixty, bundle)).toMatchObject({ big: 2, small: 0 });
  });

  it('3:10 − 1:40 → 풀기 → 빼기 → 1:30', () => {
    const start = make(sub);
    // 분이 모자라 먼저는 못 뺀다.
    expect(play(start, takeAway)).toBe(start);
    const unpacked = play(start, unbundle);
    expect(unpacked).toMatchObject({ big: 2, small: 70, unbundles: 1 });
    const done = play(unpacked, takeAway);
    expect(obs(done)).toMatchObject({
      big: 1,
      small: 30,
      tookAway: true,
      unbundles: 1,
      normalized: true,
    });
  });

  it('두 번째 빼기는 거절한다', () => {
    const done = play(make(sub), unbundle, takeAway);
    expect(play(done, takeAway)).toBe(done);
  });

  it('add에서는 빼기를 거절한다', () => {
    const state = make();
    expect(play(state, takeAway)).toBe(state);
  });

  it('풀 큰 블록이 없으면 풀기를 거절한다', () => {
    const state = make({ ...sub, a: { h: 0, m: 50 }, b: { h: 0, m: 20 } });
    expect(play(state, unbundle)).toBe(state);
  });

  it('작은 단위가 이미 60 이상이면 풀기를 거절한다(작은 칸은 119개를 넘지 않는다)', () => {
    const state = make();
    expect(state.small).toBe(75);
    expect(play(state, unbundle)).toBe(state);
  });

  it('풀기 → 묶기를 하면 처음으로 돌아온다', () => {
    const start = make(sub);
    const back = play(start, unbundle, bundle);
    expect(back).toMatchObject({ big: 3, small: 10, bundles: 1, unbundles: 1 });
  });

  it('분·초 단위: 1분 40초 + 50초 → 묶기 → 2분 30초(150초)', () => {
    const start = make(seconds);
    expect(obs(start)).toMatchObject({ units: ['m', 's'], big: 1, small: 90 });
    expect(obs(play(start, bundle))).toMatchObject({ big: 2, small: 30, normalized: true });
  });

  it('두 번 묶기가 필요한 값은 없지만 60 이상이면 몇 번이든 한 번에 60씩 묶는다', () => {
    const state = make({ ...add, a: { h: 0, m: 59 }, b: { h: 0, m: 59 } });
    expect(state.small).toBe(118);
    const once = play(state, bundle);
    expect(once).toMatchObject({ big: 1, small: 58 });
    expect(play(once, bundle)).toBe(once);
  });

  it('reset은 처음으로 되돌리고 횟수도 0으로 한다. 이미 처음이면 거절한다', () => {
    const start = make(sub);
    expect(play(start, reset)).toBe(start);
    const done = play(start, unbundle, takeAway, reset);
    expect(done).toEqual(start);
    expect(obs(done)).toMatchObject({ unbundles: 0, tookAway: false });
  });
});

describe('오개념 기록·Observation', () => {
  it('add에서 작은 단위가 60 이상인 동안 MC-TIME-BASE-100을 기록한다', () => {
    const state = make();
    expect(obs(state)['misconceptions']).toEqual(['MC-TIME-BASE-100']);
    expect(obs(play(state, bundle))['misconceptions']).toEqual([]);
    // 경계 59는 기록하지 않는다.
    expect(obs(make({ ...add, a: { h: 1, m: 29 }, b: { h: 0, m: 30 } }))['misconceptions']).toEqual(
      [],
    );
  });

  it('sub에서는 풀어서 70이 되어도 기록하지 않는다', () => {
    const state = play(make(sub), unbundle);
    expect(state.small).toBe(70);
    expect(obs(state)['misconceptions']).toEqual([]);
  });

  it('Observation은 모드·op·units·값·횟수를 담는다', () => {
    expect(obs(make())).toEqual({
      mode: 'time-calc',
      moves: 0,
      op: 'add',
      units: ['h', 'm'],
      big: 1,
      small: 75,
      normalized: false,
      bundles: 0,
      unbundles: 0,
      tookAway: false,
      misconceptions: ['MC-TIME-BASE-100'],
    });
  });

  it('작은 단위 칸은 10개 막대와 낱개로 나뉜다(경계 0, 9, 10, 60, 119)', () => {
    expect(splitSmall(0)).toEqual({ rods: 0, singles: 0 });
    expect(splitSmall(9)).toEqual({ rods: 0, singles: 9 });
    expect(splitSmall(10)).toEqual({ rods: 1, singles: 0 });
    expect(splitSmall(60)).toEqual({ rods: 6, singles: 0 });
    expect(splitSmall(119)).toEqual({ rods: 11, singles: 9 });
  });
});

describe('predicates·이벤트·JSON·엔진', () => {
  it('valueIs·normalized·bundledAtLeast·unbundledAtLeast·tookAway', () => {
    const p = timeCalcPredicates;
    const start = obs(make(sub));
    const done = obs(play(make(sub), unbundle, takeAway));
    expect(p['valueIs']?.(done, { big: 1, small: 30 })).toBe(true);
    expect(p['valueIs']?.(done, { big: 1, small: 31 })).toBe(false);
    expect(p['valueIs']?.(done, { big: 1 })).toBe(false);
    expect(p['unbundledAtLeast']?.(done, { n: 1 })).toBe(true);
    expect(p['unbundledAtLeast']?.(done, { n: 2 })).toBe(false);
    expect(p['unbundledAtLeast']?.(start, { n: 1 })).toBe(false);
    expect(p['tookAway']?.(done, undefined)).toBe(true);
    expect(p['tookAway']?.(start, undefined)).toBe(false);
    const sum = obs(make());
    expect(p['normalized']?.(sum, undefined)).toBe(false);
    expect(p['normalized']?.(obs(play(make(), bundle)), undefined)).toBe(true);
    expect(p['bundledAtLeast']?.(obs(play(make(), bundle)), { n: 1 })).toBe(true);
    expect(p['bundledAtLeast']?.(sum, { n: 1 })).toBe(false);
    expect(p['bundledAtLeast']?.(sum, {})).toBe(false);
  });

  it('이벤트는 횟수만 싣고, 상태가 바뀔 때만 낸다', () => {
    const a = make();
    expect(emitTimeCalc(a, a)).toEqual([]);
    const b = play(a, bundle);
    expect(emitTimeCalc(a, b)).toEqual([
      { name: 'time-calc-changed', payload: { moved: true } },
      { name: 'bundled', payload: { bundles: 1 } },
    ]);
    const s = make(sub);
    const u = play(s, unbundle);
    expect(emitTimeCalc(s, u).map((e) => e.name)).toEqual(['time-calc-changed', 'unbundled']);
    const t = play(u, takeAway);
    expect(emitTimeCalc(u, t).map((e) => e.name)).toEqual(['time-calc-changed']);
    expect(JSON.stringify(emitTimeCalc(a, b))).not.toMatch(/"(big|small)"/);
    expect(TIMECALC_EVENT_NAMES).toContain('unbundled');
  });

  it('상태와 Observation이 JSON으로 왕복한다', () => {
    const state = play(make(sub), unbundle);
    assertSerializable(state);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    assertSerializable(obs(state));
  });

  it('논리 높이: 큰 블록 줄 수에 맞고 600을 넘지 않으며, 블록이 늘고 줄어도 변하지 않는다', () => {
    expect(bigRows({ maxBig: 3 })).toBe(1);
    expect(bigRows({ maxBig: 4 })).toBe(2);
    expect(bigRows({ maxBig: 9 })).toBe(3);
    const start = make();
    expect(boardHeight(start)).toBe(boardHeight(play(start, bundle)));
    expect(boardHeight(start)).toBeLessThanOrEqual(600);
    // 큰 블록이 3칸 이하면 납작하지 않게 바닥 높이다. 3줄(9칸)이면 바닥을 넘는다.
    expect(boardHeight(start)).toBe(MIN_HEIGHT);
    expect(boardHeight(make({ ...sub, a: { h: 9, m: 0 }, b: { h: 0, m: 0 } }))).toBeGreaterThan(
      MIN_HEIGHT,
    );
    const subState = make(sub);
    expect(boardHeight(subState)).toBe(boardHeight(play(subState, unbundle, takeAway)));
    // 큰 블록이 9칸이어도 600 이하
    expect(boardHeight(make({ ...sub, a: { h: 9, m: 0 }, b: { h: 0, m: 0 } }))).toBeLessThanOrEqual(
      600,
    );
  });

  it('엔진 정의: 모드, 오버레이, 판정, 이벤트', () => {
    expect(definition.modes).toContain('time-calc');
    expect(definition.overlays).toHaveProperty('sixty-overflow');
    expect(definition.predicates).toHaveProperty('bundledAtLeast');
    expect(definition.events).toContain('bundled');
    const state = definition.createInitialState({ mode: 'time-calc' });
    expect(state.mode).toBe('time-calc');
    const next = definition.reduce(state, bundle);
    expect(definition.observe(next, { mode: 'time-calc' })).toMatchObject({ big: 2, small: 15 });
    expect(definition.emit?.(state, next, bundle).map((e) => e.name)).toEqual([
      'time-calc-changed',
      'bundled',
    ]);
  });
});
