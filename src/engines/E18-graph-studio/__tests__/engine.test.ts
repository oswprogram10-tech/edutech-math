/**
 * E18 reduce·observe·events·predicates 단위 테스트(T155 결정 2~8, 11).
 */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { Observation } from '../../../core/engine-sdk';
import definition from '../index';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { axisCells, createInitialState, normalizeSettings, reduce } from '../reduce';
import type { GraphAction, GraphConfig, GraphState } from '../types';

const SPORTS = { 축구: 12, 피구: 8, 줄넘기: 5, 수영: 10 } as const;

function apply(config: GraphConfig, actions: readonly GraphAction[]): GraphState {
  return actions.reduce<GraphState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

function stringsOf(observation: Observation, key: string): string[] {
  const value = observation[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function recordOf(observation: Observation, key: string): Record<string, unknown> {
  const value = observation[key];
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

describe('E18 정의', () => {
  it('엔진 ID·모드·오버레이 이름이 카드대로다', () => {
    expect(definition.id).toBe('E18');
    expect(definition.modes).toEqual(['table-to-graph', 'scale']);
    expect(definition.layout).toBe('fit');
    expect(Object.keys(definition.overlays ?? {}).sort()).toEqual([
      'gap-compare',
      'length-only',
      'scale-count',
      'table-link',
      'tally-check',
    ]);
  });
});

describe('E18 설정 정규화', () => {
  it('기본값: 표·그래프 given, 막대, 세로, 눈금 1', () => {
    const settings = normalizeSettings({ data: { 가: 3, 나: 5 } }, 'table-to-graph');
    expect(settings).toMatchObject({
      categories: ['가', '나'],
      table: 'given',
      graph: 'given',
      graphType: 'bar',
      orientation: 'vertical',
      orientationFlip: false,
      scale: 1,
      scaleOptions: [],
      showTable: true,
      showGraph: true,
      tooltips: 'auto',
    });
  });

  it('scale 모드는 scaleOptions 기본값이 [1,2,5,10]이다', () => {
    expect(normalizeSettings({}, 'scale').scaleOptions).toEqual([1, 2, 5, 10]);
    expect(
      normalizeSettings({ scaleOptions: [5, 2, 2, 0, -1, 1.5] }, 'scale').scaleOptions,
    ).toEqual([2, 5]);
  });

  it('studentDraw: true는 graph: student, showTable: sync는 table: given과 같다', () => {
    const settings = normalizeSettings(
      { data: { 가: 1 }, studentDraw: true, showTable: 'sync' },
      'scale',
    );
    expect(settings.graph).toBe('student');
    expect(settings.table).toBe('given');
    // 명시한 키가 별칭보다 우선한다.
    expect(normalizeSettings({ graph: 'given', studentDraw: true }, 'scale').graph).toBe('given');
    expect(normalizeSettings({ table: 'hidden', showTable: 'sync' }, 'scale').table).toBe('hidden');
  });

  it('받기만 하는 키(stackFrom·selfTiming·questionSet·dataset)는 무시한다', () => {
    const settings = normalizeSettings(
      {
        data: { 가: 1 },
        stackFrom: 'bottom',
        selfTiming: true,
        questionSet: ['max'],
        dataset: 'x',
      },
      'table-to-graph',
    );
    expect(settings.categories).toEqual(['가']);
  });

  it('정수가 아니거나 0~100 밖인 자료 값은 그 범주를 0으로 본다', () => {
    const settings = normalizeSettings(
      { data: { a: 2.5, b: -1, c: 101, d: 100, e: 0, f: '7' as unknown as number } },
      'table-to-graph',
    );
    expect(settings.data).toEqual({ a: 0, b: 0, c: 0, d: 100, e: 0, f: 0 });
  });

  it('data가 없으면 categories, 그것도 없으면 rawItems의 서로 다른 값이 범주다', () => {
    expect(normalizeSettings({ categories: ['x', 'y', 'x'] }, 'table-to-graph').categories).toEqual(
      ['x', 'y'],
    );
    expect(
      normalizeSettings({ rawItems: ['🍎', '🍌', '🍎'] }, 'table-to-graph').categories,
    ).toEqual(['🍎', '🍌']);
  });

  it('views와 table·graph 값으로 표·그래프 표시가 정해진다', () => {
    expect(normalizeSettings({ views: ['graph'] }, 'table-to-graph').showTable).toBe(false);
    expect(normalizeSettings({ views: ['table'] }, 'table-to-graph').showGraph).toBe(false);
    expect(normalizeSettings({ table: 'hidden' }, 'table-to-graph').showTable).toBe(false);
    expect(normalizeSettings({ graph: 'none' }, 'table-to-graph').showGraph).toBe(false);
  });

  it('눈금 칸 수: 최댓값을 scale 배수로 올린 다음 한 칸을 더한다', () => {
    const settings = normalizeSettings({ data: SPORTS }, 'scale');
    expect(axisCells(settings, 1)).toBe(13); // 12 + 1
    expect(axisCells(settings, 2)).toBe(7); // 12 + 2 = 14 → 7칸
    expect(axisCells(settings, 5)).toBe(4); // 15 + 5 = 20 → 4칸
    expect(axisCells(settings, 10)).toBe(3); // 20 + 10 = 30 → 3칸
    expect(axisCells(normalizeSettings({ data: SPORTS, axisMax: 20 }, 'scale'), 5)).toBe(4);
    expect(axisCells(normalizeSettings({ data: { 가: 0 } }, 'scale'), 1)).toBe(1);
    expect(axisCells(normalizeSettings({ categories: ['a'] }, 'scale'), 1)).toBe(11);
  });
});

describe('E18 표', () => {
  it('table: given이면 data 값이, student면 null이 시작 값이다', () => {
    expect(createInitialState({ data: SPORTS }).table).toEqual(SPORTS);
    expect(createInitialState({ data: SPORTS, table: 'student' }).table).toEqual({
      축구: null,
      피구: null,
      줄넘기: null,
      수영: null,
    });
  });

  it('set-table은 0~100으로 자르고 정수로 만든다', () => {
    const config: GraphConfig = { data: SPORTS, table: 'student' };
    const set = (value: number | null) =>
      reduce(createInitialState(config), { type: 'set-table', cat: '축구', value }).table['축구'];
    expect(set(5)).toBe(5);
    expect(set(-3)).toBe(0);
    expect(set(250)).toBe(100);
    expect(set(0)).toBe(0);
    expect(set(100)).toBe(100);
    expect(set(2.6)).toBe(3);
    expect(set(null)).toBeNull();
  });

  it('table이 student가 아니거나 없는 범주면 set-table은 무시한다', () => {
    const given = createInitialState({ data: SPORTS });
    expect(reduce(given, { type: 'set-table', cat: '축구', value: 1 })).toBe(given);
    const student = createInitialState({ data: SPORTS, table: 'student' });
    expect(reduce(student, { type: 'set-table', cat: '없음', value: 1 })).toBe(student);
    expect(reduce(student, { type: 'set-table', cat: '축구', value: Number.NaN })).toBe(student);
  });

  it('tableMatchesData·tableTotal·tableComplete', () => {
    const config: GraphConfig = { data: { 가: 2, 나: 3 }, table: 'student' };
    const empty = observe(createInitialState(config));
    expect(empty['tableComplete']).toBe(false);
    expect(empty['tableMatchesData']).toBe(false);
    expect(empty['tableTotal']).toBe(0);

    const half = observe(apply(config, [{ type: 'set-table', cat: '가', value: 2 }]));
    expect(half['tableComplete']).toBe(false);
    expect(half['tableTotal']).toBe(2);

    const done = apply(config, [
      { type: 'set-table', cat: '가', value: 2 },
      { type: 'set-table', cat: '나', value: 3 },
    ]);
    const observation = observe(done);
    expect(observation['tableComplete']).toBe(true);
    expect(observation['tableMatchesData']).toBe(true);
    expect(observation['tableTotal']).toBe(5);
    expect(predicates['tableMatchesData']?.(observation, undefined)).toBe(true);
    expect(predicates['tableTotalIs']?.(observation, { total: 5 })).toBe(true);
    expect(predicates['tableTotalIs']?.(observation, { total: 4 })).toBe(false);
  });

  it('data가 없으면 tableMatchesData 키가 없다', () => {
    const observation = observe(createInitialState({ categories: ['a'], table: 'student' }));
    expect('tableMatchesData' in observation).toBe(false);
    expect(predicates['tableMatchesData']?.(observation, undefined)).toBe(false);
  });
});

describe('E18 ○ 그래프', () => {
  const config: GraphConfig = {
    data: { 가: 3, 나: 2 },
    graph: 'student',
    graphType: 'o-mark',
    table: 'given',
  };
  const marks = (cat: string, cells: readonly number[]): GraphAction[] =>
    cells.map((cell) => ({ type: 'toggle-mark', cat, cell }));

  it('칸을 누르면 채우고 다시 누르면 비우며 번호는 정렬된다', () => {
    const state = apply(config, marks('가', [2, 0, 1]));
    expect(state.marks['가']).toEqual([0, 1, 2]);
    expect(apply(config, marks('가', [0, 0])).marks['가']).toEqual([]);
  });

  it('범위 밖 칸·없는 범주·막대 그래프에서는 무시한다', () => {
    const initial = createInitialState(config);
    expect(reduce(initial, { type: 'toggle-mark', cat: '가', cell: -1 })).toBe(initial);
    expect(reduce(initial, { type: 'toggle-mark', cat: '가', cell: 99 })).toBe(initial);
    expect(reduce(initial, { type: 'toggle-mark', cat: '없음', cell: 0 })).toBe(initial);
    const bar = createInitialState({ ...config, graphType: 'bar' });
    expect(reduce(bar, { type: 'toggle-mark', cat: '가', cell: 0 })).toBe(bar);
  });

  it('빈틈 없음: gapCategories가 비고 marksFromBottom이 참이다', () => {
    const observation = observe(apply(config, marks('가', [0, 1, 2])));
    expect(stringsOf(observation, 'gapCategories')).toEqual([]);
    expect(predicates['marksFromBottom']?.(observation, undefined)).toBe(true);
    expect(stringsOf(observation, 'misconceptions')).toEqual([]);
  });

  it('1번 칸만 채움: 0번이 비어 빈틈이다', () => {
    const observation = observe(apply(config, marks('가', [1])));
    expect(stringsOf(observation, 'gapCategories')).toEqual(['가']);
    expect(stringsOf(observation, 'misconceptions')).toContain('MC-GRAPH-GAP-ORDER');
    expect(predicates['marksFromBottom']?.(observation, undefined)).toBe(false);
  });

  it('0번·2번 칸만 채움: 1번이 비어 빈틈이다', () => {
    const observation = observe(apply(config, marks('가', [0, 2])));
    expect(stringsOf(observation, 'gapCategories')).toEqual(['가']);
  });

  it('아무것도 채우지 않으면 빈틈이 아니고 marksFromBottom도 거짓이다', () => {
    const observation = observe(createInitialState(config));
    expect(stringsOf(observation, 'gapCategories')).toEqual([]);
    expect(predicates['marksFromBottom']?.(observation, undefined)).toBe(false);
  });

  it('graphValues는 채운 칸 수 × scale이다', () => {
    const state = apply(config, [...marks('가', [0, 1, 2]), ...marks('나', [0, 1])]);
    const observation = observe(state);
    expect(observation['graphValues']).toEqual({ 가: 3, 나: 2 });
    expect(observation['graphCells']).toEqual({ 가: 3, 나: 2 });
    expect(observation['graphMatchesData']).toBe(true);
    expect(observation['graphMatchesTable']).toBe(true);
    expect(predicates['graphMatches']?.(observation, { source: 'data' })).toBe(true);
    expect(predicates['graphMatches']?.(observation, { source: 'table' })).toBe(true);
  });
});

describe('E18 막대 그래프', () => {
  const config: GraphConfig = {
    mode: 'scale',
    data: SPORTS,
    graph: 'student',
    scale: 1,
    scaleOptions: [1, 2, 5, 10],
    orientationFlip: true,
  };

  it('set-bar는 0~축 칸 수로 자른다', () => {
    const set = (cells: number) =>
      reduce(createInitialState(config), { type: 'set-bar', cat: '축구', cells }).bars['축구'];
    expect(set(6)).toBe(6);
    expect(set(-4)).toBe(0);
    expect(set(99)).toBe(13);
    expect(set(2.4)).toBe(2);
  });

  it('막대 값 = 칸 수 × scale이고 data와 같으면 graphMatchesData', () => {
    const state = apply(config, [
      { type: 'set-bar', cat: '축구', cells: 12 },
      { type: 'set-bar', cat: '피구', cells: 8 },
      { type: 'set-bar', cat: '줄넘기', cells: 5 },
      { type: 'set-bar', cat: '수영', cells: 10 },
    ]);
    const observation = observe(state);
    expect(observation['graphValues']).toEqual(SPORTS);
    expect(observation['graphMatchesData']).toBe(true);
    expect(predicates['barCellsIs']?.(observation, { cat: '축구', cells: 12 })).toBe(true);
    expect(predicates['barCellsIs']?.(observation, { cat: '축구', cells: 11 })).toBe(false);
  });

  it('눈금을 바꾸면 값을 유지하도록 칸 수를 다시 계산하고 나누어떨어지지 않으면 내림한다', () => {
    const before = apply(config, [
      { type: 'set-bar', cat: '축구', cells: 12 },
      { type: 'set-bar', cat: '피구', cells: 8 },
      { type: 'set-bar', cat: '줄넘기', cells: 5 },
    ]);
    const two = reduce(before, { type: 'set-scale', scale: 2 });
    expect(two.scale).toBe(2);
    expect(two.bars).toMatchObject({ 축구: 6, 피구: 4, 줄넘기: 2 }); // 5칸=5 → 2칸(값 4)
    const five = reduce(two, { type: 'set-scale', scale: 5 });
    expect(five.bars).toMatchObject({ 축구: 2, 피구: 1, 줄넘기: 0 }); // 12→2, 8→1, 4→0
    // 값이 칸 경계에 안 맞으면 값이 줄어든다(내림).
    expect(observe(five)['graphValues']).toMatchObject({ 축구: 10, 피구: 5, 줄넘기: 0 });
  });

  it('scale 5에서 값 8인 범주가 offGridCategories에 들어간다', () => {
    const five = apply(config, [{ type: 'set-scale', scale: 5 }]);
    expect(stringsOf(observe(five), 'offGridCategories')).toEqual(['축구', '피구']);
    const one = apply(config, []);
    expect(stringsOf(observe(one), 'offGridCategories')).toEqual([]);
    const ten = apply(config, [{ type: 'set-scale', scale: 10 }]);
    expect(stringsOf(observe(ten), 'offGridCategories')).toEqual(['축구', '피구', '줄넘기']);
  });

  it('scaleOptions 밖의 값과 같은 값으로 바꾸기는 무시한다', () => {
    const initial = createInitialState(config);
    expect(reduce(initial, { type: 'set-scale', scale: 3 })).toBe(initial);
    expect(reduce(initial, { type: 'set-scale', scale: 1 })).toBe(initial);
  });

  it('table-to-graph 모드는 scaleOptions가 없으면 눈금을 못 바꾼다', () => {
    const initial = createInitialState({ data: SPORTS });
    expect(reduce(initial, { type: 'set-scale', scale: 2 })).toBe(initial);
  });

  it('given 그래프는 늘 정확한 값이고 graphCells는 값 ÷ scale 내림이다', () => {
    const state = apply({ mode: 'scale', data: SPORTS, scale: 5, scaleOptions: [5] }, []);
    const observation = observe(state);
    expect(observation['graphValues']).toEqual(SPORTS);
    expect(observation['graphCells']).toEqual({ 축구: 2, 피구: 1, 줄넘기: 1, 수영: 2 });
    expect(observation['graphMatchesData']).toBe(true);
  });

  it('flip은 orientationFlip일 때만 방향을 바꾸고 값은 그대로다', () => {
    const drawn = apply(config, [{ type: 'set-bar', cat: '축구', cells: 12 }]);
    const flipped = reduce(drawn, { type: 'flip' });
    expect(flipped.orientation).toBe('horizontal');
    expect(flipped.bars).toEqual(drawn.bars);
    const observation = observe(flipped);
    expect(observation['flipped']).toBe(true);
    expect(observation['graphValues']).toEqual(observe(drawn)['graphValues']);
    expect(predicates['orientationIs']?.(observation, { orientation: 'horizontal' })).toBe(true);
    expect(observe(reduce(flipped, { type: 'flip' }))['flipped']).toBe(false);

    const locked = createInitialState({ data: SPORTS });
    expect(reduce(locked, { type: 'flip' })).toBe(locked);
  });

  it('reset-graph는 막대와 ○를 비운다', () => {
    const state = apply(config, [
      { type: 'set-bar', cat: '축구', cells: 3 },
      { type: 'reset-graph' },
    ]);
    expect(state.bars['축구']).toBe(0);
  });

  it('given 그래프에서는 set-bar를 무시한다', () => {
    const given = createInitialState({ data: SPORTS });
    expect(reduce(given, { type: 'set-bar', cat: '축구', cells: 3 })).toBe(given);
  });
});

describe('E18 표와 그래프 비교', () => {
  const config: GraphConfig = { data: { 가: 2, 나: 3 }, graph: 'student', table: 'student' };

  it('graphMatches {source: table}는 학생 표와 같을 때 참이다', () => {
    const state = apply(config, [
      { type: 'set-table', cat: '가', value: 4 },
      { type: 'set-table', cat: '나', value: 1 },
      { type: 'set-bar', cat: '가', cells: 4 },
      { type: 'set-bar', cat: '나', cells: 1 },
    ]);
    const observation = observe(state);
    expect(predicates['graphMatches']?.(observation, { source: 'table' })).toBe(true);
    expect(predicates['graphMatches']?.(observation, { source: 'data' })).toBe(false);
    expect(predicates['graphMatches']?.(observation, { source: 'x' })).toBe(false);
  });

  it('MC-GRAPH-TABLE-MISMATCH는 다 그리기 전에는 나오지 않는다', () => {
    const partial = apply(config, [
      { type: 'set-table', cat: '가', value: 2 },
      { type: 'set-table', cat: '나', value: 3 },
      { type: 'set-bar', cat: '가', cells: 5 }, // 다른 값이지만 나는 아직 0칸
    ]);
    expect(stringsOf(observe(partial), 'misconceptions')).not.toContain('MC-GRAPH-TABLE-MISMATCH');
  });

  it('다 그렸는데 표와 다른 범주가 있으면 MC-GRAPH-TABLE-MISMATCH', () => {
    const state = apply(config, [
      { type: 'set-table', cat: '가', value: 2 },
      { type: 'set-table', cat: '나', value: 3 },
      { type: 'set-bar', cat: '가', cells: 5 },
      { type: 'set-bar', cat: '나', cells: 3 },
    ]);
    expect(stringsOf(observe(state), 'misconceptions')).toEqual(['MC-GRAPH-TABLE-MISMATCH']);
    // 표가 given이면 data와 비교한다.
    const given = apply({ ...config, table: 'given' }, [
      { type: 'set-bar', cat: '가', cells: 2 },
      { type: 'set-bar', cat: '나', cells: 4 },
    ]);
    expect(stringsOf(observe(given), 'misconceptions')).toEqual(['MC-GRAPH-TABLE-MISMATCH']);
  });

  it('학생 표를 아직 안 채운 범주는 비교하지 않는다', () => {
    const state = apply(config, [
      { type: 'set-bar', cat: '가', cells: 5 },
      { type: 'set-bar', cat: '나', cells: 5 },
    ]);
    expect(stringsOf(observe(state), 'misconceptions')).toEqual([]);
  });

  it('MC-COUNT-ONE-TO-ONE: rawItems가 있고 표를 다 채웠는데 합계가 자료 수와 다르다', () => {
    const base: GraphConfig = {
      categories: ['🍎', '🍌'],
      rawItems: ['🍎', '🍌', '🍎', '🍎', '🍌'],
      table: 'student',
      graph: 'none',
    };
    const wrong = apply(base, [
      { type: 'set-table', cat: '🍎', value: 4 },
      { type: 'set-table', cat: '🍌', value: 2 },
    ]);
    expect(stringsOf(observe(wrong), 'misconceptions')).toEqual(['MC-COUNT-ONE-TO-ONE']);
    const right = apply(base, [
      { type: 'set-table', cat: '🍎', value: 3 },
      { type: 'set-table', cat: '🍌', value: 2 },
    ]);
    expect(stringsOf(observe(right), 'misconceptions')).toEqual([]);
    const incomplete = apply(base, [{ type: 'set-table', cat: '🍎', value: 4 }]);
    expect(stringsOf(observe(incomplete), 'misconceptions')).toEqual([]);
    expect(observe(wrong)['rawCount']).toBe(5);
  });

  it('센 것 표시는 토글이고 범위 밖 번호는 무시한다', () => {
    const base: GraphConfig = { rawItems: ['a', 'b', 'c'], categories: ['a'] };
    const state = apply(base, [
      { type: 'toggle-tally', index: 2 },
      { type: 'toggle-tally', index: 0 },
      { type: 'toggle-tally', index: 9 },
      { type: 'toggle-tally', index: -1 },
    ]);
    expect(state.tallied).toEqual([0, 2]);
    expect(observe(state)['talliedCount']).toBe(2);
    expect(
      apply(base, [
        { type: 'toggle-tally', index: 1 },
        { type: 'toggle-tally', index: 1 },
      ]).tallied,
    ).toEqual([]);
  });

  it('hasMisconception 판정', () => {
    const observation = observe(
      apply({ data: { 가: 1 }, graph: 'student', graphType: 'o-mark' }, [
        { type: 'toggle-mark', cat: '가', cell: 1 },
      ]),
    );
    expect(predicates['hasMisconception']?.(observation, { code: 'MC-GRAPH-GAP-ORDER' })).toBe(
      true,
    );
    expect(predicates['hasMisconception']?.(observation, { code: 'MC-X' })).toBe(false);
  });
});

describe('E18 이벤트', () => {
  const config: GraphConfig = {
    mode: 'scale',
    data: SPORTS,
    graph: 'student',
    table: 'student',
    orientationFlip: true,
  };
  const names = (state: GraphState, action: GraphAction) =>
    emit(state, reduce(state, action), action).map((event) => event.name);

  it('각 Action이 카드의 이벤트를 낸다', () => {
    const initial = createInitialState(config);
    expect(names(initial, { type: 'set-table', cat: '축구', value: 3 })).toEqual(['table-changed']);
    expect(names(initial, { type: 'set-bar', cat: '축구', cells: 3 })).toEqual(['graph-changed']);
    expect(names(initial, { type: 'set-scale', scale: 2 })).toEqual(['scale-changed']);
    expect(names(initial, { type: 'flip' })).toEqual(['flipped']);
  });

  it('바뀐 것이 없으면 이벤트가 없다', () => {
    const initial = createInitialState(config);
    expect(names(initial, { type: 'set-bar', cat: '축구', cells: 0 })).toEqual([]);
    expect(names(initial, { type: 'toggle-tally', index: 0 })).toEqual([]);
    expect(definition.events).toEqual([
      'table-changed',
      'graph-changed',
      'scale-changed',
      'flipped',
    ]);
  });

  it('이벤트 payload에 범주·눈금·방향이 들어간다', () => {
    const initial = createInitialState(config);
    const drawn = reduce(initial, { type: 'set-bar', cat: '피구', cells: 2 });
    expect(emit(initial, drawn, { type: 'set-bar', cat: '피구', cells: 2 })[0]?.payload).toEqual({
      cat: '피구',
    });
    const flipped = reduce(initial, { type: 'flip' });
    expect(emit(initial, flipped, { type: 'flip' })[0]?.payload).toEqual({
      orientation: 'horizontal',
    });
  });
});

describe('E18 직렬화', () => {
  it('모든 상태와 Observation이 JSON으로 오간다', () => {
    const config: GraphConfig = {
      mode: 'scale',
      data: SPORTS,
      graph: 'student',
      table: 'student',
      rawItems: ['⚽', '🏐'],
      orientationFlip: true,
    };
    const states = [
      createInitialState(config),
      apply(config, [{ type: 'set-table', cat: '축구', value: 12 }]),
      apply(config, [
        { type: 'set-bar', cat: '축구', cells: 4 },
        { type: 'set-scale', scale: 2 },
      ]),
      apply(config, [{ type: 'flip' }, { type: 'toggle-tally', index: 1 }]),
      apply({ ...config, graphType: 'o-mark' }, [{ type: 'toggle-mark', cat: '축구', cell: 1 }]),
      createInitialState({}),
    ];
    for (const state of states) {
      assertSerializable(state);
      assertSerializable(observe(state));
    }
  });

  it('빈 설정도 깨지지 않는다', () => {
    const observation = observe(createInitialState(undefined));
    expect(observation['graphMatchesData']).toBe(false);
    expect(observation['graphMatchesTable']).toBe(false);
    expect(recordOf(observation, 'graphValues')).toEqual({});
  });
});
