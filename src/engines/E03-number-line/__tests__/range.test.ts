/**
 * T219 range 모드(경계점·방향·게이트)와 rounding 상황 장면의 reduce·Observation·판정 테스트.
 */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { JsonValue } from '../../../core/engine-sdk';
import { complete, gateOpened, hasMisconception, predicates, rangeIs, roundedTo } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import { leftBehindRest } from '../scenario';
import type { NumberLineAction, NumberLineConfig, NumberLineState } from '../types';

const RIDERS = [118, 125, 129, 130, 131, 140, 145, 150, 151, 155];
const BASE: NumberLineConfig = {
  mode: 'range',
  min: 100,
  max: 160,
  unit: 1,
  subdivisions: 10,
  story: 'rollercoaster',
  riders: RIDERS,
};

function run(state: NumberLineState, ...actions: NumberLineAction[]): NumberLineState {
  return actions.reduce((current, action) => reduce(current, action), state);
}

function make(config: NumberLineConfig = BASE): NumberLineState {
  return createInitialState(config);
}

/** 130 경계점을 놓고 속 찬 동그라미 + 오른쪽 방향. */
function at130Closed(config: NumberLineConfig = BASE): NumberLineState {
  return run(
    make(config),
    { type: 'place-bound', value: '130' },
    { type: 'toggle-closed', index: 0 },
    { type: 'set-direction', dir: 'right' },
  );
}

const sorted = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);

describe('T219 range 경계점', () => {
  it('시작은 경계점 없음, 완성 아님, 게이트 닫힘', () => {
    const observation = observe(make());
    expect(observation['mode']).toBe('range');
    expect(observation['lower']).toBeNull();
    expect(observation['upper']).toBeNull();
    expect(observation['complete']).toBe(false);
    expect(observation['gateOpened']).toBe(false);
    expect(observation['passed']).toEqual([]);
    expect(observation['blocked']).toEqual([]);
    expect(observation['misconceptions']).toEqual([]);
  });

  it('경계점은 가장 가까운 unit 눈금에 맞고 빈 동그라미로 놓인다', () => {
    const state = run(make({ ...BASE, unit: 5 }), { type: 'place-bound', value: '132' });
    expect(state.range?.bounds).toEqual([{ value: '130', closed: false }]);
    const half = run(make({ ...BASE, unit: 5 }), { type: 'place-bound', value: '133' });
    expect(half.range?.bounds[0]?.value).toBe('135');
  });

  it('범위 밖 값은 끝 눈금으로 맞춘다', () => {
    expect(run(make(), { type: 'place-bound', value: '500' }).range?.bounds[0]?.value).toBe('160');
    expect(run(make(), { type: 'place-bound', value: '-5' }).range?.bounds[0]?.value).toBe('100');
  });

  it('속 찬 ↔ 빈 동그라미가 바뀐다', () => {
    let state = run(make(), { type: 'place-bound', value: '130' });
    state = run(state, { type: 'toggle-closed', index: 0 });
    expect(state.range?.bounds[0]?.closed).toBe(true);
    state = run(state, { type: 'toggle-closed', index: 0 });
    expect(state.range?.bounds[0]?.closed).toBe(false);
    expect(run(state, { type: 'toggle-closed', index: 3 })).toBe(state);
  });

  it('경계 하나는 방향을 정해야 완성되고 lower/upper로 정규화된다', () => {
    const point = run(make(), { type: 'place-bound', value: '130' });
    expect(observe(point)['complete']).toBe(false);
    expect(observe(point)['lower']).toBeNull();

    const right = run(
      point,
      { type: 'toggle-closed', index: 0 },
      { type: 'set-direction', dir: 'right' },
    );
    const observation = observe(right);
    expect(observation['complete']).toBe(true);
    expect(observation['lower']).toEqual({ value: '130', closed: true });
    expect(observation['upper']).toBeNull();

    const left = run(right, { type: 'set-direction', dir: 'left' });
    expect(observe(left)['lower']).toBeNull();
    expect(observe(left)['upper']).toEqual({ value: '130', closed: true });
  });

  it('같은 방향을 다시 누르거나 경계가 하나가 아니면 바뀌지 않는다', () => {
    const state = at130Closed();
    expect(run(state, { type: 'set-direction', dir: 'right' })).toBe(state);
    const empty = make();
    expect(run(empty, { type: 'set-direction', dir: 'left' })).toBe(empty);
    const two = run(
      make({ ...BASE, maxBounds: 2 }),
      { type: 'place-bound', value: '130' },
      { type: 'place-bound', value: '150' },
    );
    expect(run(two, { type: 'set-direction', dir: 'left' })).toBe(two);
  });

  it('둘째 경계(maxBounds 2)는 작은 쪽이 lower로 정렬된다', () => {
    const config = { ...BASE, maxBounds: 2 as const };
    let state = run(
      make(config),
      { type: 'place-bound', value: '150' },
      { type: 'place-bound', value: '130' },
    );
    expect(state.range?.bounds.map((bound) => bound.value)).toEqual(['130', '150']);
    state = run(state, { type: 'toggle-closed', index: 0 });
    const observation = observe(state);
    expect(observation['complete']).toBe(true);
    expect(observation['lower']).toEqual({ value: '130', closed: true });
    expect(observation['upper']).toEqual({ value: '150', closed: false });
  });

  it('maxBounds를 넘는 경계 놓기와 같은 눈금 겹침은 거절한다', () => {
    const one = run(make(), { type: 'place-bound', value: '130' });
    expect(run(one, { type: 'place-bound', value: '140' })).toBe(one);
    const two = run(make({ ...BASE, maxBounds: 2 }), { type: 'place-bound', value: '130' });
    expect(run(two, { type: 'place-bound', value: '130' })).toBe(two);
  });

  it('경계점을 끌어 옮기고, 넘으면 정렬이 바뀐다', () => {
    const config = { ...BASE, maxBounds: 2 as const };
    let state = run(
      make(config),
      { type: 'place-bound', value: '130' },
      { type: 'place-bound', value: '150' },
    );
    state = run(
      state,
      { type: 'toggle-closed', index: 0 },
      { type: 'move-bound', index: 0, value: '120' },
    );
    expect(state.range?.bounds).toEqual([
      { value: '120', closed: true },
      { value: '150', closed: false },
    ]);
    state = run(state, { type: 'move-bound', index: 0, value: '155' });
    expect(state.range?.bounds).toEqual([
      { value: '150', closed: false },
      { value: '155', closed: true },
    ]);
    // 다른 경계가 있는 눈금으로는 옮기지 않는다.
    expect(run(state, { type: 'move-bound', index: 0, value: '155' })).toBe(state);
  });

  it('하나 지우기·처음으로', () => {
    const config = { ...BASE, maxBounds: 2 as const };
    let state = run(
      make(config),
      { type: 'place-bound', value: '130' },
      { type: 'place-bound', value: '150' },
    );
    state = run(state, { type: 'remove-bound' });
    expect(state.range?.bounds.map((bound) => bound.value)).toEqual(['130']);
    expect(state.range?.direction).toBeNull();
    state = run(state, { type: 'place-bound', value: '110' }, { type: 'remove-bound', index: 1 });
    expect(state.range?.bounds.map((bound) => bound.value)).toEqual(['110']);
    state = run(state, { type: 'reset' });
    expect(state.range?.bounds).toEqual([]);
    expect(run(state, { type: 'reset' })).toBe(state);
    expect(run(state, { type: 'remove-bound' })).toBe(state);
  });

  it('readOnly면 preset 그대로 두고 조작을 거절한다(게이트 열기는 된다)', () => {
    const config: NumberLineConfig = {
      ...BASE,
      readOnly: true,
      preset: { lower: { value: 130, closed: true }, upper: { value: 150, closed: false } },
    };
    const state = make(config);
    expect(state.range?.bounds).toEqual([
      { value: '130', closed: true },
      { value: '150', closed: false },
    ]);
    expect(observe(state)['complete']).toBe(true);
    expect(run(state, { type: 'toggle-closed', index: 0 })).toBe(state);
    expect(run(state, { type: 'move-bound', index: 0, value: '120' })).toBe(state);
    expect(run(state, { type: 'remove-bound' })).toBe(state);
    expect(run(state, { type: 'reset' })).toBe(state);
    const opened = run(state, { type: 'open-gate' });
    expect(observe(opened)['gateOpened']).toBe(true);
  });

  it('preset 하나만 주면 방향이 정해진다', () => {
    const lowerOnly = make({ ...BASE, preset: { lower: { value: 130, closed: true } } });
    expect(observe(lowerOnly)['lower']).toEqual({ value: '130', closed: true });
    expect(observe(lowerOnly)['upper']).toBeNull();
    const upperOnly = make({ ...BASE, preset: { upper: { value: 150, closed: false } } });
    expect(observe(upperOnly)['upper']).toEqual({ value: '150', closed: false });
    expect(observe(upperOnly)['lower']).toBeNull();
  });

  it('riders는 min~max 안 정수만, 10명까지 받는다', () => {
    const state = make({
      ...BASE,
      riders: [90, 120, 120.5, 130, 170, 101, 102, 103, 104, 105, 106, 107, 108],
    });
    expect(state.range?.riders).toEqual([120, 130, 101, 102, 103, 104, 105, 106, 107, 108]);
  });

  it('경계가 하나일 때 어떤 설정이든 JSON 왕복이 된다', () => {
    const state = at130Closed();
    expect(() => assertSerializable(state)).not.toThrow();
    expect(() => assertSerializable(observe(state))).not.toThrow();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('T219 range 게이트', () => {
  it('경계가 없거나 방향이 없으면 열 수 없다', () => {
    const empty = make();
    expect(run(empty, { type: 'open-gate' })).toBe(empty);
    const point = run(make(), { type: 'place-bound', value: '130' });
    expect(run(point, { type: 'open-gate' })).toBe(point);
  });

  it('story가 none이면 게이트가 없다', () => {
    const state = at130Closed({ ...BASE, story: 'none' });
    expect(run(state, { type: 'open-gate' })).toBe(state);
  });

  it('130 이상: 130 통과·129 막힘', () => {
    const observation = observe(run(at130Closed(), { type: 'open-gate' }));
    expect(observation['gateOpened']).toBe(true);
    expect(observation['passed']).toEqual([130, 131, 140, 145, 150, 151, 155]);
    expect(observation['blocked']).toEqual([118, 125, 129]);
  });

  it('130 초과(빈 동그라미): 130 막힘', () => {
    const state = run(
      make(),
      { type: 'place-bound', value: '130' },
      { type: 'set-direction', dir: 'right' },
      { type: 'open-gate' },
    );
    const observation = observe(state);
    expect(observation['blocked']).toContain(130);
    expect(observation['blocked']).not.toContain(131);
    expect(sorted(observation['passed'] as number[])).toEqual([131, 140, 145, 150, 151, 155]);
  });

  it('130 이상 150 미만: 150 막힘', () => {
    const config = { ...BASE, maxBounds: 2 as const };
    const state = run(
      make(config),
      { type: 'place-bound', value: '130' },
      { type: 'place-bound', value: '150' },
      { type: 'toggle-closed', index: 0 },
      { type: 'open-gate' },
    );
    const observation = observe(state);
    expect(observation['passed']).toEqual([130, 131, 140, 145]);
    expect(observation['blocked']).toEqual([118, 125, 129, 150, 151, 155]);
  });

  it('150 이하(왼쪽 방향, 속 찬): 150 통과', () => {
    const state = run(
      make(),
      { type: 'place-bound', value: '150' },
      { type: 'toggle-closed', index: 0 },
      { type: 'set-direction', dir: 'left' },
      { type: 'open-gate' },
    );
    const observation = observe(state);
    expect(observation['passed']).toContain(150);
    expect(observation['blocked']).toEqual([151, 155]);
  });

  it('범위를 바꾸면 게이트가 닫히고 결과가 빈 배열이 된다', () => {
    const opened = run(at130Closed(), { type: 'open-gate' });
    const changed = run(opened, { type: 'toggle-closed', index: 0 });
    expect(observe(changed)['gateOpened']).toBe(false);
    expect(observe(changed)['passed']).toEqual([]);
    expect(observe(changed)['blocked']).toEqual([]);
  });

  it('게이트를 연 뒤에만 passed·blocked가 채워진다', () => {
    const observation = observe(at130Closed());
    expect(observation['passed']).toEqual([]);
    expect(observation['blocked']).toEqual([]);
  });
});

describe('T219 range predicates', () => {
  const closedRight = (): Record<string, JsonValue> => observe(at130Closed());

  it('rangeIs: 주지 않은 쪽은 null이어야 한다', () => {
    const observation = closedRight();
    expect(rangeIs(observation, { lower: { value: '130', closed: true } })).toBe(true);
    expect(rangeIs(observation, { lower: { value: '130', closed: false } })).toBe(false);
    expect(rangeIs(observation, { lower: { value: '131', closed: true } })).toBe(false);
    expect(rangeIs(observation, { upper: { value: '130', closed: true } })).toBe(false);
    expect(
      rangeIs(observation, {
        lower: { value: '130', closed: true },
        upper: { value: '150', closed: false },
      }),
    ).toBe(false);
  });

  it('rangeIs: 두 경계와 완성 전', () => {
    const config = { ...BASE, maxBounds: 2 as const };
    const two = observe(
      run(
        make(config),
        { type: 'place-bound', value: '130' },
        { type: 'place-bound', value: '150' },
        { type: 'toggle-closed', index: 0 },
      ),
    );
    expect(
      rangeIs(two, {
        lower: { value: '130', closed: true },
        upper: { value: '150', closed: false },
      }),
    ).toBe(true);
    expect(rangeIs(two, { lower: { value: '130', closed: true } })).toBe(false);
    const incomplete = observe(run(make(), { type: 'place-bound', value: '130' }));
    expect(rangeIs(incomplete, {})).toBe(false);
    expect(rangeIs(two, undefined)).toBe(false);
    expect(rangeIs(two, { lower: { value: 'abc', closed: true } })).toBe(false);
  });

  it('gateOpened·complete·등록 이름', () => {
    expect(gateOpened(closedRight(), undefined)).toBe(false);
    expect(gateOpened(observe(run(at130Closed(), { type: 'open-gate' })), undefined)).toBe(true);
    expect(complete(closedRight(), undefined)).toBe(true);
    expect(complete(observe(make()), undefined)).toBe(false);
    for (const name of ['rangeIs', 'gateOpened', 'complete', 'hasMisconception']) {
      expect(predicates[name]).toBeTypeOf('function');
    }
  });

  it('hasMisconception은 Observation의 misconceptions 목록을 본다', () => {
    expect(hasMisconception({ misconceptions: ['MC-X'] }, { code: 'MC-X' })).toBe(true);
    expect(hasMisconception({ misconceptions: [] }, { code: 'MC-X' })).toBe(false);
    expect(hasMisconception(closedRight(), { code: 'MC-RANGE-BOUNDARY-INCLUSION' })).toBe(false);
    expect(hasMisconception({}, { code: 'MC-X' })).toBe(false);
  });
});

describe('T219 rounding scenario', () => {
  const bus: NumberLineConfig = { mode: 'rounding', value: 243, place: 10, scenario: 'bus-seats' };
  const candy: NumberLineConfig = {
    mode: 'rounding',
    value: 243,
    place: 10,
    scenario: 'candy-bags',
  };

  const consequenceOf = (config: NumberLineConfig, method: 'up' | 'down' | 'half-up') =>
    observe(run(createInitialState(config), { type: 'round', item: 0, method }))['consequence'];

  it('고르기 전에는 consequence가 null이다', () => {
    const observation = observe(createInitialState(bus));
    expect(observation['scenario']).toBe('bus-seats');
    expect(observation['consequence']).toBeNull();
    expect(observation['misconceptions']).toEqual([]);
  });

  it('버스: 올림은 모두 탔고 버림·반올림은 못 탄 친구가 있다', () => {
    expect(consequenceOf(bus, 'up')).toBe('all-seated');
    expect(consequenceOf(bus, 'down')).toBe('left-behind');
    expect(consequenceOf(bus, 'half-up')).toBe('left-behind');
  });

  it('사탕: 버림은 남은 사탕, 올림은 덜 찬 봉지', () => {
    expect(consequenceOf(candy, 'down')).toBe('leftover');
    expect(consequenceOf(candy, 'half-up')).toBe('leftover');
    expect(consequenceOf(candy, 'up')).toBe('partial-bag');
  });

  it('나머지가 0이면 세 방법 모두 exact', () => {
    for (const method of ['up', 'down', 'half-up'] as const) {
      expect(consequenceOf({ ...bus, value: 240 }, method)).toBe('exact');
      expect(consequenceOf({ ...candy, value: 240 }, method)).toBe('exact');
    }
  });

  it('반올림이 올림이 되는 경계(245·10)와 height', () => {
    expect(consequenceOf({ ...bus, value: 245 }, 'half-up')).toBe('all-seated');
    const height = observe(
      run(createInitialState({ mode: 'rounding', value: '143.6', place: 1, scenario: 'height' }), {
        type: 'round',
        item: 0,
        method: 'half-up',
      }),
    );
    expect(height['scenario']).toBe('height');
    expect(height['consequence']).toBeNull();
  });

  it('고른 방법은 관찰 경로 rounding.0.method로 읽힌다', () => {
    const observation = observe(
      run(createInitialState(bus), { type: 'round', item: 0, method: 'up' }),
    );
    const items = observation['rounding'] as ReadonlyArray<Record<string, JsonValue>>;
    expect(items[0]).toEqual({ value: '243', marker: '250', method: 'up' });
    expect(roundedTo(observation, { value: '243', result: '250', method: 'up' })).toBe(true);
  });

  it('scenario가 없으면 Observation에 scenario·consequence가 없다(기존 동작)', () => {
    const observation = observe(createInitialState({ mode: 'rounding', value: 243, place: 10 }));
    expect('scenario' in observation).toBe(false);
    expect('consequence' in observation).toBe(false);
  });

  it('값이 여럿이면 설정 오류', () => {
    expect(() =>
      createInitialState({
        mode: 'rounding',
        values: [243, 389],
        place: 10,
        scenario: 'bus-seats',
      }),
    ).toThrow();
    // 여럿이어도 scenario가 없으면 그대로 된다.
    expect(() =>
      createInitialState({ mode: 'rounding', values: [243, 389], place: 10 }),
    ).not.toThrow();
  });

  it('버스·봉지는 자연수와 2~20 묶음 크기만 받는다', () => {
    expect(() => createInitialState({ ...bus, value: '24.5' })).toThrow();
    expect(() => createInitialState({ ...bus, place: 100 })).toThrow();
    expect(() => createInitialState({ ...bus, place: 1 })).toThrow();
  });

  it('JSON 왕복과 showConsequence 기본값', () => {
    const state = run(createInitialState(bus), { type: 'round', item: 0, method: 'down' });
    expect(state.rounding?.showConsequence).toBe(true);
    expect(() => assertSerializable(state)).not.toThrow();
    expect(createInitialState({ ...bus, showConsequence: false }).rounding?.showConsequence).toBe(
      false,
    );
  });

  it('힌트 left-behind 나머지: 243·10이면 3, 240이면 없음, 다른 scenario면 없음', () => {
    expect(leftBehindRest(createInitialState(bus))).toEqual({
      scenario: 'bus-seats',
      size: 10,
      rest: 3,
    });
    expect(leftBehindRest(createInitialState(candy))?.scenario).toBe('candy-bags');
    expect(leftBehindRest(createInitialState({ ...bus, value: 240 }))).toBeNull();
    expect(
      leftBehindRest(createInitialState({ ...bus, scenario: 'height', value: 243 })),
    ).toBeNull();
    expect(
      leftBehindRest(createInitialState({ mode: 'rounding', value: 243, place: 10 })),
    ).toBeNull();
  });
});
