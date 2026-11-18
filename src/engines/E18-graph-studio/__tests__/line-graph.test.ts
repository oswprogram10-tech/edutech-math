/** T163: E18 line-graph 모드의 설정·reduce·observe·predicate·이벤트 단위 테스트. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { GraphAction, GraphConfig, GraphState, LineGraphState } from '../types';

const POINTS = [
  { x: '1일', y: '36.5' },
  { x: '2일', y: '36.8' },
  { x: '3일', y: '37.2' },
  { x: '4일', y: '36.6' },
];

function make(extra: Record<string, unknown> = {}): LineGraphState {
  const state = createInitialState({
    mode: 'line-graph',
    points: POINTS,
    yStep: '0.5',
    plotStep: '0.1',
    graph: 'student',
    ...extra,
  } as GraphConfig);
  if (state.mode !== 'line-graph') throw new Error('line-graph 상태가 아님');
  return state;
}

function run(state: GraphState, ...actions: GraphAction[]): LineGraphState {
  const next = actions.reduce(reduce, state);
  if (next.mode !== 'line-graph') throw new Error('line-graph 상태가 아님');
  return next;
}

const set = (x: string, y: string): GraphAction => ({ type: 'set-point', x, y });

describe('line-graph 설정 정규화', () => {
  it('세로 값은 Rational 문자열이고 소수 문자열을 받는다', () => {
    const line = make().settings.line;
    expect(line?.xs).toEqual(['1일', '2일', '3일', '4일']);
    expect(line?.values).toEqual(['73/2', '184/5', '186/5', '183/5']);
    expect(line?.yStep).toBe('1/2');
    expect(line?.plotStep).toBe('1/10');
  });

  it('기본 yMax는 최댓값을 yStep 배수로 올리고 한 칸을 더한 값이다', () => {
    // 37.2 -> 37.5, +0.5 = 38
    expect(make().settings.line?.yMax).toBe('38');
    // 정확히 배수면 올림 없이 한 칸만 더한다: 37 -> 37.5
    const exact = make({ points: [{ x: 'a', y: '37' }] });
    expect(exact.settings.line?.yMax).toBe('75/2');
  });

  it('plotStep 기본값은 yStep, yFrom 기본값은 0, 잘못된 값은 기본값으로 돌아간다', () => {
    const state = make({ plotStep: undefined, yStep: 'abc', yFrom: '-3' });
    const line = state.settings.line;
    expect(line?.yStep).toBe('1');
    expect(line?.plotStep).toBe('1');
    expect(line?.yFrom).toBe('0');
    expect(state.yFrom).toBe('0');
  });

  it('값이 잘못된 점과 같은 이름의 점은 뺀다', () => {
    const state = make({
      points: [
        { x: 'a', y: '1' },
        { x: 'a', y: '2' },
        { x: 'b', y: 'x' },
        { x: 'c', y: '-1' },
        { x: 'd', y: '.5' },
        { x: 'e', y: '1/2' },
      ],
    });
    expect(state.settings.line?.xs).toEqual(['a', 'e']);
  });

  it('yFromOptions는 정렬·중복 제거하고 yMax보다 작은 것만 남긴다', () => {
    const line = make({ yFromOptions: ['36', '0', '36.0'] }).settings.line;
    expect(line?.yFromOptions).toEqual(['0', '36']);
  });

  it('yMax가 시작값 후보보다 작으면 기본값을 쓴다', () => {
    const line = make({ yMax: '30', yFromOptions: ['0', '36'] }).settings.line;
    expect(Number(line?.yMax.length)).toBeGreaterThan(0);
    expect(line?.yMax).toBe('38');
  });

  it('predict:true면 처음 단계가 predict, 아니면 actual이다', () => {
    expect(make({ predict: true }).phase).toBe('predict');
    expect(make().phase).toBe('actual');
  });

  it('일반 모드 설정은 line이 null이다', () => {
    const state = createInitialState({ data: { 가: 1 } });
    expect(state.settings.line).toBeNull();
  });
});

describe('set-point', () => {
  it('plotStep에 맞춰 반올림한다(절반은 올림)', () => {
    expect(run(make(), set('1일', '36.54')).points['1일']).toBe('73/2');
    expect(run(make(), set('1일', '36.55')).points['1일']).toBe('183/5');
  });

  it('[yFrom, yMax]로 자른다', () => {
    const state = make({ yFrom: '36', yFromOptions: ['0', '36'] });
    expect(run(state, set('1일', '10')).points['1일']).toBe('36');
    expect(run(state, set('1일', '99')).points['1일']).toBe('38');
  });

  it('yMax가 plotStep 배수가 아니면 한 칸 안쪽으로 당긴다', () => {
    const state = make({ yMax: '38.05' });
    expect(run(state, set('1일', '38')).points['1일']).toBe('38');
    expect(run(state, set('1일', '99')).points['1일']).toBe('38');
  });

  it('없는 가로축 이름·읽을 수 없는 값은 무시한다', () => {
    const state = make();
    expect(reduce(state, set('9일', '36.5'))).toBe(state);
    expect(reduce(state, set('1일', 'abc'))).toBe(state);
  });

  it('같은 값을 다시 찍으면 같은 상태다', () => {
    const once = run(make(), set('1일', '36.5'));
    expect(reduce(once, set('1일', '36.5'))).toBe(once);
  });

  it('graph:given이면 실제 단계에서는 점을 찍을 수 없다', () => {
    const state = make({ graph: 'given' });
    expect(reduce(state, set('1일', '36.5'))).toBe(state);
  });

  it('clear-point는 점을 지우고 선분도 함께 지운다', () => {
    const state = run(make(), set('1일', '36.5'), set('2일', '36.8'));
    expect(state.segments).toEqual([[0, 1]]);
    const cleared = run(state, { type: 'clear-point', x: '1일' });
    expect(cleared.points['1일']).toBeNull();
    expect(cleared.segments).toEqual([]);
  });
});

describe('잇기와 순서', () => {
  it('connect:auto는 이웃한 두 점이 있으면 저절로 잇는다', () => {
    const state = run(make(), set('1일', '36.5'), set('3일', '37'), set('2일', '36.8'));
    expect(state.segments).toEqual([
      [0, 1],
      [1, 2],
    ]);
  });

  it('connect:auto에서는 connect Action이 무시된다', () => {
    const state = run(make(), set('1일', '36.5'), set('2일', '36.8'));
    expect(reduce(state, { type: 'connect', a: 0, b: 1 })).toBe(state);
  });

  it('connect:student: 아무 두 점이나 이을 수 있고 같은 쌍과 점 없는 쌍은 무시한다', () => {
    const base = make({ connect: 'student' });
    const placed = run(base, set('1일', '36.5'), set('3일', '37'));
    expect(placed.segments).toEqual([]);
    const linked = run(placed, { type: 'connect', a: 2, b: 0 });
    expect(linked.segments).toEqual([[0, 2]]);
    expect(reduce(linked, { type: 'connect', a: 0, b: 2 })).toBe(linked);
    expect(reduce(linked, { type: 'connect', a: 0, b: 1 })).toBe(linked);
    expect(reduce(linked, { type: 'connect', a: 1, b: 1 })).toBe(linked);
    expect(reduce(linked, { type: 'connect', a: 0, b: 9 })).toBe(linked);
    expect(run(linked, { type: 'disconnect', a: 2, b: 0 }).segments).toEqual([]);
  });

  it('segmentsInOrder: 이웃한 쌍이 모두 있고 다른 쌍이 없을 때만 참이다', () => {
    const xs = ['1일', '2일', '3일', '4일'];
    let state = make({ connect: 'student' });
    for (const [index, x] of xs.entries()) state = run(state, set(x, `${36 + index / 10}`));
    const order = (s: LineGraphState) => observe(s)['segmentsInOrder'];
    expect(order(state)).toBe(false);
    state = run(state, { type: 'connect', a: 0, b: 1 }, { type: 'connect', a: 1, b: 2 });
    expect(order(state)).toBe(false); // 빠짐
    state = run(state, { type: 'connect', a: 2, b: 3 });
    expect(order(state)).toBe(true);
    const skipped = run(state, { type: 'connect', a: 0, b: 3 });
    expect(order(skipped)).toBe(false); // 건너뜀이 더해짐
    const swapped = run(
      run(make({ connect: 'student' }), ...xs.map((x) => set(x, '36.5'))),
      { type: 'connect', a: 0, b: 1 },
      { type: 'connect', a: 1, b: 3 },
      { type: 'connect', a: 2, b: 3 },
    );
    expect(order(swapped)).toBe(false); // 쌍 수는 같지만 이웃이 아님
  });

  it('주어진 그래프는 늘 순서대로 이어져 있다', () => {
    const observation = observe(make({ graph: 'given' }));
    expect(observation['segmentsInOrder']).toBe(true);
    expect(observation['pointsMatchData']).toBe(true);
    expect(observation['linePoints']).toEqual({
      '1일': '73/2',
      '2일': '184/5',
      '3일': '186/5',
      '4일': '183/5',
    });
  });
});

describe('set-y-from', () => {
  const config = { yFromOptions: ['0', '36'] };

  it('목록 안의 값만 받는다', () => {
    const state = make(config);
    expect(reduce(state, { type: 'set-y-from', value: '35' })).toBe(state);
    expect(reduce(state, { type: 'set-y-from', value: 'abc' })).toBe(state);
    expect(run(state, { type: 'set-y-from', value: '36.0' }).yFrom).toBe('36');
  });

  it('새 시작값보다 낮은 점은 지우고 선분도 정리한다', () => {
    const state = run(make(config), set('1일', '30'), set('2일', '37'), set('3일', '36.8'));
    expect(state.segments).toEqual([
      [0, 1],
      [1, 2],
    ]);
    const next = run(state, { type: 'set-y-from', value: '36' });
    expect(next.points['1일']).toBeNull();
    expect(next.points['2일']).toBe('37');
    expect(next.yFrom).toBe('36');
    expect(next.segments).toEqual([[1, 2]]);
    const lower = run(make(config), set('1일', '30'), set('2일', '31'));
    expect(run(lower, { type: 'set-y-from', value: '36' }).segments).toEqual([]);
  });

  it('wavyShown과 yFromAtLeast', () => {
    const state = make(config);
    expect(observe(state)['wavyShown']).toBe(false);
    const wavy = run(state, { type: 'set-y-from', value: '36' });
    const observation = observe(wavy);
    expect(observation['wavyShown']).toBe(true);
    expect(predicates['wavyShown']?.(observation, undefined)).toBe(true);
    expect(predicates['yFromAtLeast']?.(observation, { value: '35.5' })).toBe(true);
    expect(predicates['yFromAtLeast']?.(observation, { value: '36' })).toBe(true);
    expect(predicates['yFromAtLeast']?.(observation, { value: '36.1' })).toBe(false);
  });
});

describe('예측 단계', () => {
  it('predict 단계에서는 prediction에 쓰고 finish-predict로 실제 단계가 된다', () => {
    const start = make({ predict: true, graph: 'given' });
    expect(reduce(start, { type: 'finish-predict' })).toBe(start); // 예측 점 없음
    const drawn = run(start, set('1일', '36.5'), set('2일', '37'));
    expect(drawn.prediction['1일']).toBe('73/2');
    expect(drawn.points['1일']).toBeNull();
    expect(observe(drawn)['predictionCount']).toBe(2);
    expect(observe(drawn)['predictionDone']).toBe(false);
    const done = run(drawn, { type: 'finish-predict' });
    expect(done.phase).toBe('actual');
    expect(observe(done)['predictionDone']).toBe(true);
    expect(predicates['predictionDone']?.(observe(done), undefined)).toBe(true);
    // 예측은 더 바꿀 수 없다(graph:given이라 실제 단계에서 점도 못 찍는다).
    expect(reduce(done, set('3일', '37'))).toBe(done);
    expect(reduce(done, { type: 'finish-predict' })).toBe(done);
  });

  it('graph:student + predict면 예측 뒤 학생 점은 points에 쓴다', () => {
    const done = run(make({ predict: true }), set('1일', '36'), { type: 'finish-predict' });
    const next = run(done, set('2일', '37'));
    expect(next.points['2일']).toBe('37');
    expect(next.prediction['2일']).toBeNull();
  });

  it('predict가 아니면 predictionDone은 false다', () => {
    expect(observe(make())['predictionDone']).toBe(false);
  });

  it('reset-graph는 지금 단계의 점만 지운다', () => {
    const state = run(make({ predict: true }), set('1일', '36'));
    expect(run(state, { type: 'reset-graph' }).prediction['1일']).toBeNull();
  });
});

describe('Observation·직렬화', () => {
  it('학생 점 관찰 값', () => {
    let state = make();
    for (const point of POINTS) state = run(state, set(point.x, point.y));
    const observation = observe(state);
    expect(observation['pointsComplete']).toBe(true);
    expect(observation['pointsMatchData']).toBe(true);
    expect(observation['segmentsInOrder']).toBe(true);
    expect(observation['lineX']).toEqual(['1일', '2일', '3일', '4일']);
    expect(observation['phase']).toBe('actual');
    expect(observation['misconceptions']).toEqual([]);
    expect(predicates['pointsMatch']?.(observation, { source: 'data' })).toBe(true);
    const moved = run(state, set('2일', '37.5'));
    expect(observe(moved)['pointsMatchData']).toBe(false);
  });

  it('상태·관찰 값은 JSON으로 직렬화되고 되돌려도 같다', () => {
    const state = run(make({ predict: true }), set('1일', '36.5'), { type: 'finish-predict' });
    assertSerializable(state);
    assertSerializable(observe(state));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('이벤트: 점·선분·시작값·예측 끝', () => {
    const base = make({ yFromOptions: ['0', '36'], predict: true });
    const names = (prev: LineGraphState, action: GraphAction) =>
      emit(prev, reduce(prev, action), action).map((event) => event.name);
    expect(names(base, set('1일', '36.5'))).toEqual(['point-changed']);
    const predicted = run(base, set('1일', '36.5'));
    expect(names(predicted, { type: 'finish-predict' })).toEqual(['prediction-finished']);
    const actual = run(predicted, { type: 'finish-predict' });
    expect(names(actual, { type: 'set-y-from', value: '36' })).toEqual(['y-from-changed']);
    const student = run(make({ connect: 'student' }), set('1일', '36.5'), set('2일', '36.8'));
    expect(names(student, { type: 'connect', a: 0, b: 1 })).toEqual(['segment-changed']);
    expect(names(student, { type: 'connect', a: 0, b: 0 })).toEqual([]);
    expect(names(make(), set('1일', '36.5'))).toEqual(['point-changed']);
    expect(names(student, set('3일', '37'))).toEqual(['point-changed']);
    const auto = run(make(), set('1일', '36.5'));
    expect(names(auto, set('2일', '36.8'))).toEqual(['point-changed', 'segment-changed']);
  });
});

describe('responseCompare', () => {
  const observation = (value: unknown) => ({ response: { answer: { value } } });
  const compare = (value: unknown, op: string, wanted: string) =>
    predicates['responseCompare']?.(observation(value) as never, {
      field: 'answer',
      op,
      value: wanted,
    });

  it('다섯 op', () => {
    expect(compare('36', 'lt', '36.6')).toBe(true);
    expect(compare('36.6', 'lt', '36.6')).toBe(false);
    expect(compare('183/5', 'le', '36.6')).toBe(true);
    expect(compare('183/5', 'eq', '36.6')).toBe(true);
    expect(compare('37', 'eq', '36.6')).toBe(false);
    expect(compare('37', 'ge', '36.6')).toBe(true);
    expect(compare('36', 'ge', '36.6')).toBe(false);
    expect(compare('37', 'gt', '36.6')).toBe(true);
    expect(compare('183/5', 'gt', '36.6')).toBe(false);
  });

  it('분수·0·정수 number 경계', () => {
    expect(compare('1/3', 'lt', '1/2')).toBe(true);
    expect(compare('0', 'eq', '0.0')).toBe(true);
    expect(compare('7', 'gt', '6.99')).toBe(true);
    expect(compare(3, 'eq', '3')).toBe(true);
  });

  it('값이 없거나 읽을 수 없으면 false다', () => {
    expect(compare(undefined, 'lt', '1')).toBe(false);
    expect(compare('abc', 'lt', '1')).toBe(false);
    expect(compare('1', 'lt', 'abc')).toBe(false);
    expect(compare('1', 'lt', '.5')).toBe(false);
    expect(compare(1.5, 'lt', '2')).toBe(false);
    expect(compare('1', 'neq', '2')).toBe(false);
    expect(predicates['responseCompare']?.({}, { field: 'answer', op: 'lt', value: '1' })).toBe(
      false,
    );
    expect(
      predicates['responseCompare']?.(observation('1') as never, { op: 'lt', value: '2' }),
    ).toBe(false);
  });
});
