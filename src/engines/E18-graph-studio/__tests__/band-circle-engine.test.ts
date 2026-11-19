/** T166: E18 band-circle 모드의 설정·reduce·observe·predicate·이벤트 단위 테스트. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, normalizeSettings, reduce } from '../reduce';
import type { BandCircleState, GraphAction, GraphConfig, GraphState } from '../types';

const DATA = { 사과: 9, 포도: 6, 딸기: 3, 기타: 2 };

function make(extra: Record<string, unknown> = {}): BandCircleState {
  const state = createInitialState({
    mode: 'band-circle',
    data: DATA,
    percentEntry: 'student',
    band: 'student',
    ...extra,
  } as GraphConfig);
  if (state.mode !== 'band-circle') throw new Error('band-circle 상태가 아님');
  return state;
}

function run(state: GraphState, ...actions: GraphAction[]): BandCircleState {
  const next = actions.reduce(reduce, state);
  if (next.mode !== 'band-circle') throw new Error('band-circle 상태가 아님');
  return next;
}

const percent = (cat: string, value: number | null): GraphAction => ({
  type: 'set-percent',
  cat,
  value,
});
const band = (cat: string, cells: number): GraphAction => ({ type: 'set-band', cat, cells });

function fillPercents(state: BandCircleState, values: readonly number[]): BandCircleState {
  return run(state, ...Object.keys(DATA).map((cat, index) => percent(cat, values[index] ?? 0)));
}

describe('band-circle 설정 정규화', () => {
  it('기본값: percentEntry given, band auto, morph drag, startAs band, sliceLabels name-percent', () => {
    const state = make({ percentEntry: undefined, band: undefined });
    const settings = state.settings.bandCircle;
    expect(settings?.percentEntry).toBe('given');
    expect(settings?.band).toBe('auto');
    expect(settings?.morph).toBe('drag');
    expect(settings?.startAs).toBe('band');
    expect(settings?.sliceLabels).toBe('name-percent');
    expect(settings?.compare).toBeNull();
    expect(state.curl).toBe(0);
  });

  it('data는 [[이름, 값], …] 배열 모양도 받는다(순서 유지)', () => {
    const state = make({
      data: [
        ['사과', 9],
        ['포도', 6],
        ['딸기', 3],
        ['기타', 2],
      ],
    });
    expect(state.settings.categories).toEqual(['사과', '포도', '딸기', '기타']);
    expect(state.settings.data).toEqual(DATA);
    expect(state.settings.bandCircle?.total).toBe(20);
  });

  it('requirePercentEntry: true는 percentEntry student와 같고, 명시한 percentEntry가 이긴다', () => {
    const required = make({ percentEntry: undefined, requirePercentEntry: true });
    expect(required.settings.bandCircle?.percentEntry).toBe('student');
    const explicit = make({ percentEntry: 'hidden', requirePercentEntry: true });
    expect(explicit.settings.bandCircle?.percentEntry).toBe('hidden');
  });

  it('참 백분율은 개수 × 100 / 전체의 Rational 문자열이다(약분·정수 아님)', () => {
    const exact = make().settings.bandCircle?.truePercents;
    expect(exact).toEqual({ 사과: '45', 포도: '30', 딸기: '15', 기타: '10' });
    const odd = make({ data: { a: 1, b: 2 } }).settings.bandCircle?.truePercents;
    expect(odd).toEqual({ a: '100/3', b: '200/3' });
    const empty = make({ data: { a: 0, b: 0 } }).settings.bandCircle?.truePercents;
    expect(empty).toEqual({ a: '0', b: '0' });
  });

  it('circleTitle은 없으면 title을 쓴다', () => {
    expect(make({ title: '과일' }).settings.bandCircle?.circleTitle).toBe('과일');
    expect(make({ title: '과일', circleTitle: '1반' }).settings.bandCircle?.circleTitle).toBe(
      '1반',
    );
    expect(make().settings.bandCircle?.circleTitle).toBe('');
  });

  it('startAs circle은 처음부터 curl 100이다', () => {
    expect(make({ startAs: 'circle' }).curl).toBe(100);
    expect(make({ startAs: 'circle', morph: 'none' }).curl).toBe(100);
  });

  it('compare는 title·data(객체 또는 배열)·전체를 정리한다', () => {
    const state = make({
      compare: {
        title: '2반',
        data: [
          ['사과', 20],
          ['포도', 10],
        ],
      },
    });
    const compare = state.settings.bandCircle?.compare;
    expect(compare?.title).toBe('2반');
    expect(compare?.categories).toEqual(['사과', '포도']);
    expect(compare?.total).toBe(30);
    expect(
      make({ compare: { title: '빈 자료', data: {} } }).settings.bandCircle?.compare,
    ).toBeNull();
  });

  it('table 기본은 given이고 student는 given으로 바뀐다. 잘못된 값은 기본값', () => {
    const settings = normalizeSettings(
      {
        mode: 'band-circle',
        data: DATA,
        table: 'student',
        band: 'x',
        morph: 'y',
      } as unknown as GraphConfig,
      'band-circle',
    );
    expect(settings.table).toBe('given');
    expect(settings.bandCircle?.band).toBe('auto');
    expect(settings.bandCircle?.morph).toBe('drag');
  });

  it('percentEntry given이면 표에 참 백분율(정수)이 처음부터 있다', () => {
    const state = make({ percentEntry: 'given' });
    expect(state.percents).toEqual({ 사과: 45, 포도: 30, 딸기: 15, 기타: 10 });
    expect(make({ percentEntry: 'hidden' }).percents).toEqual({
      사과: null,
      포도: null,
      딸기: null,
      기타: null,
    });
  });

  it('상태는 JSON 직렬화가 된다', () => {
    expect(() => assertSerializable(make({ compare: { title: 'x', data: DATA } }))).not.toThrow();
  });
});

describe('band-circle reduce', () => {
  it('set-percent: 0과 100 경계, null은 지움, 범위 밖은 자르고 비정수는 반올림한다', () => {
    const state = make();
    expect(run(state, percent('사과', 0)).percents['사과']).toBe(0);
    expect(run(state, percent('사과', 100)).percents['사과']).toBe(100);
    expect(run(state, percent('사과', 150)).percents['사과']).toBe(100);
    expect(run(state, percent('사과', -4)).percents['사과']).toBe(0);
    expect(run(state, percent('사과', 44.6)).percents['사과']).toBe(45);
    expect(run(state, percent('사과', 45), percent('사과', null)).percents['사과']).toBeNull();
    // 같은 값·없는 범주·유한하지 않은 값은 상태를 그대로 둔다.
    expect(reduce(state, percent('없음', 5))).toBe(state);
    expect(reduce(state, percent('사과', Number.NaN))).toBe(state);
    expect(reduce(state, percent('사과', null))).toBe(state);
  });

  it('set-percent는 percentEntry가 student일 때만 받는다', () => {
    const given = make({ percentEntry: 'given' });
    expect(reduce(given, percent('사과', 1))).toBe(given);
    const hidden = make({ percentEntry: 'hidden' });
    expect(reduce(hidden, percent('사과', 1))).toBe(hidden);
  });

  it('set-band: 0~100 경계, 합이 100을 넘어도 그대로 둔다', () => {
    const state = make();
    expect(run(state, band('사과', 0)).bandCells['사과']).toBe(0);
    expect(run(state, band('사과', 100)).bandCells['사과']).toBe(100);
    expect(run(state, band('사과', 101)).bandCells['사과']).toBe(100);
    const over = run(state, band('사과', 100), band('포도', 100));
    expect(over.bandCells).toMatchObject({ 사과: 100, 포도: 100 });
    expect(reduce(state, band('없음', 3))).toBe(state);
    expect(reduce(state, band('사과', Number.POSITIVE_INFINITY))).toBe(state);
  });

  it('set-band는 band가 student일 때만 받는다', () => {
    const auto = make({ band: 'auto' });
    expect(reduce(auto, band('사과', 5))).toBe(auto);
  });

  it('set-curl: 0~100으로 자르고 정수로 맞춘다. curl ≠ 0에서도 set-band는 받는다', () => {
    const state = make();
    expect(run(state, { type: 'set-curl', value: 100 }).curl).toBe(100);
    expect(run(state, { type: 'set-curl', value: 250 }).curl).toBe(100);
    expect(run(state, { type: 'set-curl', value: -3 }).curl).toBe(0);
    expect(run(state, { type: 'set-curl', value: 40.4 }).curl).toBe(40);
    expect(reduce(state, { type: 'set-curl', value: 0 })).toBe(state);
    expect(reduce(state, { type: 'set-curl', value: Number.NaN })).toBe(state);
    const curled = run(state, { type: 'set-curl', value: 60 }, band('사과', 12));
    expect(curled.bandCells['사과']).toBe(12);
  });

  it('reset-graph: 띠 칸을 비우고 curl을 처음 값으로 둔다. 백분율 표는 둔다', () => {
    const state = run(
      make(),
      percent('사과', 45),
      band('사과', 30),
      { type: 'set-curl', value: 100 },
      { type: 'reset-graph' },
    );
    expect(state.bandCells['사과']).toBeNull();
    expect(state.curl).toBe(0);
    expect(state.percents['사과']).toBe(45);
    const circle = run(
      make({ startAs: 'circle' }),
      { type: 'set-curl', value: 0 },
      { type: 'reset-graph' },
    );
    expect(circle.curl).toBe(100);
  });

  it('다른 모드 상태는 band-circle Action을 무시한다', () => {
    const other = createInitialState({ mode: 'table-to-graph', data: DATA });
    expect(reduce(other, { type: 'set-curl', value: 50 })).toBe(other);
    expect(reduce(other, percent('사과', 5))).toBe(other);
  });
});

describe('band-circle observe', () => {
  it('참 백분율은 Rational 문자열이고, 처음에는 모두 비어 있다', () => {
    const observation = observe(make());
    expect(observation['truePercents']).toEqual({ 사과: '45', 포도: '30', 딸기: '15', 기타: '10' });
    expect(observation['percents']).toEqual({ 사과: null, 포도: null, 딸기: null, 기타: null });
    expect(observation['percentsComplete']).toBe(false);
    expect(observation['percentSum']).toBeNull();
    expect(observation['curl']).toBe(0);
    expect(observation['circleShown']).toBe(false);
    expect(observation['categories']).toEqual(['사과', '포도', '딸기', '기타']);
    expect(() => assertSerializable(observation)).not.toThrow();
  });

  it('percentSum은 빈 칸이 있으면 null, 다 채우면 합이다', () => {
    const partial = run(make(), percent('사과', 45));
    expect(observe(partial)['percentSum']).toBeNull();
    const full = fillPercents(make(), [45, 30, 15, 10]);
    expect(observe(full)['percentSum']).toBe(100);
    expect(observe(full)['percentsComplete']).toBe(true);
    expect(observe(full)['percentsMatchData']).toBe(true);
    const off = fillPercents(make(), [45, 30, 15, 11]);
    expect(observe(off)['percentsMatchData']).toBe(false);
    expect(observe(off)['percentSum']).toBe(101);
  });

  it('참 백분율이 정수가 아니면 학생의 정수와 같지 않다(33 ≠ 100/3)', () => {
    const state = run(make({ data: { a: 1, b: 2 } }), percent('a', 33), percent('b', 67));
    expect(observe(state)['percentsMatchData']).toBe(false);
  });

  it('band auto는 학생이 쓴 백분율대로, 빈 칸은 0칸이다', () => {
    const state = run(make({ band: 'auto' }), percent('사과', 45), percent('포도', 30));
    const observation = observe(state);
    expect(observation['bandCells']).toEqual({ 사과: 45, 포도: 30, 딸기: 0, 기타: 0 });
    expect(observation['bandCellSum']).toBe(75);
    expect(observation['bandMatchesData']).toBe(false);
  });

  it('band given은 참 백분율대로라 칸 수가 모두 맞다', () => {
    const observation = observe(make({ band: 'given' }));
    expect(observation['bandCells']).toEqual({ 사과: 45, 포도: 30, 딸기: 15, 기타: 10 });
    expect(observation['bandMatchesData']).toBe(true);
  });

  it('band student: 학생이 정한 칸 수, 맞게 채우면 bandMatchesData', () => {
    const wrong = run(make(), band('사과', 45), band('포도', 30));
    expect(observe(wrong)['bandMatchesData']).toBe(false);
    const right = run(
      make(),
      band('사과', 45),
      band('포도', 30),
      band('딸기', 15),
      band('기타', 10),
    );
    expect(observe(right)['bandMatchesData']).toBe(true);
    expect(observe(right)['bandCellSum']).toBe(100);
  });

  it('circleShown은 curl이 100일 때만 참이다(99는 아니다)', () => {
    expect(observe(run(make(), { type: 'set-curl', value: 99 }))['circleShown']).toBe(false);
    expect(observe(run(make(), { type: 'set-curl', value: 100 }))['circleShown']).toBe(true);
  });

  describe('MC-GRAPH-PERCENT-AS-COUNT', () => {
    const code = 'MC-GRAPH-PERCENT-AS-COUNT';
    const codes = (state: GraphState) => observe(state)['misconceptions'];

    it('학생 띠가 모두 채워졌고 칸 합이 100이 아니면 감지한다(모자람·넘침)', () => {
      const under = run(make(), band('사과', 9), band('포도', 6), band('딸기', 3), band('기타', 2));
      expect(codes(under)).toEqual([code]);
      const over = run(
        make(),
        band('사과', 60),
        band('포도', 50),
        band('딸기', 20),
        band('기타', 10),
      );
      expect(codes(over)).toEqual([code]);
    });

    it('띠를 다 채우기 전, 합이 100이면 감지하지 않는다', () => {
      expect(codes(run(make(), band('사과', 9), band('포도', 6)))).toEqual([]);
      const exact = run(
        make(),
        band('사과', 45),
        band('포도', 30),
        band('딸기', 15),
        band('기타', 10),
      );
      expect(codes(exact)).toEqual([]);
    });

    it('학생 백분율이 모두 개수와 같고 합이 100이 아니면 감지한다', () => {
      expect(codes(fillPercents(make({ band: 'auto' }), [9, 6, 3, 2]))).toEqual([code]);
    });

    it('백분율이 개수와 다르거나 다 채우지 않았거나 합이 100이면 감지하지 않는다', () => {
      expect(codes(fillPercents(make({ band: 'auto' }), [45, 30, 15, 10]))).toEqual([]);
      expect(codes(fillPercents(make({ band: 'auto' }), [9, 6, 3, 3]))).toEqual([]);
      expect(codes(run(make({ band: 'auto' }), percent('사과', 9), percent('포도', 6)))).toEqual(
        [],
      );
      // 개수 합이 100이면 개수 그대로가 백분율이라 합이 100이다.
      const hundred = make({ band: 'auto', data: { a: 60, b: 40 } });
      expect(codes(run(hundred, percent('a', 60), percent('b', 40)))).toEqual([]);
    });
  });
});

describe('band-circle predicate', () => {
  const full = () => fillPercents(make({ band: 'auto' }), [45, 30, 15, 10]);

  it('percentsMatch', () => {
    expect(predicates['percentsMatch']?.(observe(full()), null)).toBe(true);
    expect(predicates['percentsMatch']?.(observe(make()), null)).toBe(false);
    expect(
      predicates['percentsMatch']?.(observe(fillPercents(make(), [45, 30, 15, 9])), null),
    ).toBe(false);
  });

  it('percentSumIs는 빈 칸이 있으면 항상 거짓이다', () => {
    expect(predicates['percentSumIs']?.(observe(full()), { value: 100 })).toBe(true);
    expect(predicates['percentSumIs']?.(observe(full()), { value: 99 })).toBe(false);
    expect(predicates['percentSumIs']?.(observe(make()), { value: 100 })).toBe(false);
    expect(
      predicates['percentSumIs']?.(observe(run(make(), percent('사과', 0))), { value: 0 }),
    ).toBe(false);
    expect(predicates['percentSumIs']?.(observe(full()), { value: '100' })).toBe(false);
  });

  it('bandMatch', () => {
    const right = run(
      make(),
      band('사과', 45),
      band('포도', 30),
      band('딸기', 15),
      band('기타', 10),
    );
    expect(predicates['bandMatch']?.(observe(right), null)).toBe(true);
    expect(predicates['bandMatch']?.(observe(make()), null)).toBe(false);
    expect(predicates['bandMatch']?.(observe(make({ band: 'given' })), null)).toBe(true);
  });

  it('circleShown', () => {
    expect(predicates['circleShown']?.(observe(make()), null)).toBe(false);
    expect(
      predicates['circleShown']?.(observe(run(make(), { type: 'set-curl', value: 100 })), null),
    ).toBe(true);
  });

  it('hasMisconception으로 오개념을 고를 수 있다', () => {
    const wrong = run(make(), band('사과', 9), band('포도', 6), band('딸기', 3), band('기타', 2));
    expect(
      predicates['hasMisconception']?.(observe(wrong), { code: 'MC-GRAPH-PERCENT-AS-COUNT' }),
    ).toBe(true);
  });
});

describe('band-circle 이벤트', () => {
  const names = (prev: GraphState, action: GraphAction) =>
    emit(prev, reduce(prev, action), action).map((event) => [event.name, event.payload]);

  it('percent-changed·band-changed는 바뀐 범주에만 낸다', () => {
    expect(names(make(), percent('사과', 5))).toEqual([['percent-changed', { cat: '사과' }]]);
    expect(names(make(), band('포도', 5))).toEqual([['band-changed', { cat: '포도' }]]);
    expect(names(run(make(), percent('사과', 5)), percent('사과', 5))).toEqual([]);
  });

  it('curl-changed는 값이 바뀔 때만 낸다(끄는 동안은 Action이 없으므로 내지 않는다)', () => {
    expect(names(make(), { type: 'set-curl', value: 100 })).toEqual([
      ['curl-changed', { value: 100 }],
    ]);
    expect(names(make(), { type: 'set-curl', value: 0 })).toEqual([]);
  });

  it('reset-graph는 지워진 칸과 curl 변화를 낸다', () => {
    const state = run(make(), band('사과', 5), { type: 'set-curl', value: 100 });
    expect(names(state, { type: 'reset-graph' })).toEqual([
      ['band-changed', { cat: '사과' }],
      ['curl-changed', { value: 0 }],
    ]);
  });
});
