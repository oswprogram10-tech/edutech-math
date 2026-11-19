/** T167: E18 distortion 모드의 설정·reduce·observe·predicate·이벤트·장면 단위 테스트. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import {
  axisCellsFor,
  currentScene,
  exampleTicks,
  groupedBars,
  unitsOnTicks,
  visualRatioOf,
  valueRatioOf,
} from '../distortion';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, normalizeSettings, reduce } from '../reduce';
import type { DistortionState, GraphAction, GraphConfig, GraphState } from '../types';

const FULL = {
  mode: 'distortion',
  data: [
    ['1반', 52],
    ['2반', 48],
  ],
  controls: ['yStart', 'yStep', 'wavyLine', 'groupItems'],
  yStartOptions: [0, 45],
  yStepOptions: [1, 5, 10],
  headlineCards: ['1반이 압도적!', '큰 차이 없어요', '독서왕 1반', '2반도 열심히'],
  checklist: ['y-zero', 'even-step', 'sum-100', 'fair-grouping'],
  examples: [
    {
      id: 'a',
      title: '예시 가',
      kind: 'bar',
      data: { 가: 52, 나: 48 },
      yStart: 45,
      flaws: ['y-zero'],
    },
    {
      id: 'b',
      title: '예시 나',
      kind: 'circle',
      data: { 가: 60, 나: 55 },
      flaws: ['sum-100'],
    },
    {
      id: 'c',
      title: '예시 다',
      kind: 'bar',
      data: { 가: 10, 나: 20, 다: 30 },
      ticks: [0, 10, 30, 60],
      grouped: '나와 다를 묶었어요',
      flaws: ['even-step', 'fair-grouping'],
    },
  ],
} as const;

function make(extra: Record<string, unknown> = {}): DistortionState {
  const state = createInitialState({ ...FULL, ...extra } as unknown as GraphConfig);
  if (state.mode !== 'distortion') throw new Error('distortion 상태가 아님');
  return state;
}

function run(state: GraphState, ...actions: GraphAction[]): DistortionState {
  const next = actions.reduce(reduce, state);
  if (next.mode !== 'distortion') throw new Error('distortion 상태가 아님');
  return next;
}

const start = (value: number): GraphAction => ({ type: 'set-y-start', value });
const step = (value: number): GraphAction => ({ type: 'set-y-step', value });
const mark = (example: string, item: string): GraphAction => ({
  type: 'toggle-example-mark',
  example,
  item,
});

describe('distortion 설정 정규화', () => {
  it('배열 data를 받고 기본 조작은 yStart·yStep이다', () => {
    const settings = normalizeSettings(
      {
        mode: 'distortion',
        data: [
          ['1반', 52],
          ['2반', 48],
        ],
      } as unknown as GraphConfig,
      'distortion',
    );
    expect(settings.categories).toEqual(['1반', '2반']);
    expect(settings.data).toEqual({ '1반': 52, '2반': 48 });
    expect(settings.distortion?.controls).toEqual(['yStart', 'yStep']);
  });

  it('기본 yStartOptions는 0과 최솟값 아래 10의 배수 두 개다', () => {
    const settings = normalizeSettings(
      { mode: 'distortion', data: { 가: 52, 나: 48 } },
      'distortion',
    );
    expect(settings.distortion?.yStartOptions).toEqual([0, 30, 40]);
    const exact = normalizeSettings({ mode: 'distortion', data: { 가: 50, 나: 70 } }, 'distortion');
    expect(exact.distortion?.yStartOptions).toEqual([0, 30, 40]);
    const small = normalizeSettings({ mode: 'distortion', data: { 가: 5, 나: 7 } }, 'distortion');
    expect(small.distortion?.yStartOptions).toEqual([0]);
  });

  it('기본 yStepOptions는 [1,2,5,10] 중 그래프가 2~25칸이 되는 것이다', () => {
    const settings = normalizeSettings(
      { mode: 'distortion', data: { 가: 52, 나: 48 } },
      'distortion',
    );
    // 시작 0이면 step 1은 53칸이라 안 되지만 시작 30에서는 23칸이라 된다.
    expect(settings.distortion?.yStepOptions).toEqual([1, 2, 5, 10]);
    const large = normalizeSettings(
      { mode: 'distortion', data: { 가: 900, 나: 800 } },
      'distortion',
    );
    expect(large.distortion?.yStepOptions).not.toContain(1);
    expect(large.distortion?.yStepOptions.length).toBeGreaterThan(0);
  });

  it('자료는 0~1000 정수만 받고 나머지는 0이다', () => {
    const settings = normalizeSettings(
      { mode: 'distortion', data: { 가: 1000, 나: 1001, 다: 1.5, 라: -3 } },
      'distortion',
    );
    expect(settings.data).toEqual({ 가: 1000, 나: 0, 다: 0, 라: 0 });
  });

  it('다른 모드는 100을 넘는 값을 0으로 본다(상한 1000은 이 모드만)', () => {
    const settings = normalizeSettings({ mode: 'scale', data: { 가: 500 } }, 'scale');
    expect(settings.data).toEqual({ 가: 0 });
    expect(settings.distortion).toBeNull();
  });

  it('제목 카드는 최대 6장, 묶음은 구성원 둘 이상이어야 한다', () => {
    const settings = normalizeSettings(
      {
        mode: 'distortion',
        data: { 가: 1, 나: 2, 다: 3 },
        headlineCards: ['1', '2', '3', '4', '5', '6', '7', '8'],
        groupOptions: [
          { label: '가나', members: ['가', '나'] },
          { label: '혼자', members: ['가'] },
          { label: '없음', members: ['가', '라'] },
        ],
      } as unknown as GraphConfig,
      'distortion',
    );
    expect(settings.distortion?.headlineCards).toHaveLength(6);
    expect(settings.distortion?.groupOptions.map((group) => group.label)).toEqual(['가나']);
  });

  it('예시: 눈금이 오름차순이 아니면 쓰지 않고 flaws는 체크리스트 항목만 남는다', () => {
    const settings = normalizeSettings(
      {
        mode: 'distortion',
        data: { 가: 1 },
        examples: [
          { data: { 가: 1 }, ticks: [0, 10, 5], flaws: ['y-zero', '몰라'] },
          { data: { 가: 1 }, ticks: [0, 5, 20] },
        ],
      } as unknown as GraphConfig,
      'distortion',
    );
    const [first, second] = settings.distortion?.examples ?? [];
    expect(first?.id).toBe('e1');
    expect(first?.ticks).toBeNull();
    expect(first?.flaws).toEqual(['y-zero']);
    expect(second?.ticks).toEqual([0, 5, 20]);
  });
});

describe('distortion reduce', () => {
  it('옵션 밖 시작값·눈금 간격은 무시한다', () => {
    const state = make();
    expect(run(state, start(7))).toBe(state);
    expect(run(state, step(3))).toBe(state);
    expect(run(state, start(45)).yStart).toBe(45);
  });

  it('조작 기록을 남기고 되돌려도 기록은 남는다', () => {
    const state = run(make(), start(45), start(0), step(10), { type: 'toggle-group', label: 'x' });
    expect(state.history).toEqual({ yStartChanged: true, yStepChanged: true, grouped: false });
    expect(state.yStart).toBe(0);
  });

  it('물결선 토글과 reset-graph(막대 설정만 처음으로)', () => {
    const state = run(
      make(),
      start(45),
      step(10),
      { type: 'toggle-wavy' },
      { type: 'add-headline', card: '큰 차이 없어요' },
      { type: 'show-example', index: 1 },
      { type: 'reset-graph' },
    );
    expect(state.yStart).toBe(0);
    expect(state.yStep).toBe(make().yStep);
    expect(state.wavy).toBe(false);
    expect(state.headline).toEqual(['큰 차이 없어요']);
    expect(state.history.yStartChanged).toBe(true);
    expect(state.exampleIndex).toBe(1);
  });

  it('제목 카드: 누른 순서로 쌓이고 6장이 한도이며 지우기로 비운다', () => {
    const cards = FULL.headlineCards;
    let state = make({ headlineCards: ['가', '나', '다'] });
    expect(run(state, { type: 'add-headline', card: '없는 카드' })).toBe(state);
    state = run(
      state,
      ...['나', '가', '나', '가', '나', '다'].map((card) => ({
        type: 'add-headline' as const,
        card,
      })),
    );
    expect(state.headline).toEqual(['나', '가', '나', '가', '나', '다']);
    expect(run(state, { type: 'add-headline', card: '가' })).toBe(state);
    expect(run(state, { type: 'clear-headline' }).headline).toEqual([]);
    expect(cards.length).toBeGreaterThan(0);
  });

  it('예시 표시는 체크리스트 순서로 쌓이고 같은 항목을 다시 누르면 지운다', () => {
    let state = run(make(), mark('c', 'fair-grouping'), mark('c', 'even-step'));
    expect(state.exampleMarks['c']).toEqual(['even-step', 'fair-grouping']);
    state = run(state, mark('c', 'even-step'));
    expect(state.exampleMarks['c']).toEqual(['fair-grouping']);
    expect(run(state, mark('zzz', 'y-zero'))).toBe(state);
    expect(run(state, mark('c', 'nothing'))).toBe(state);
  });

  it('체크리스트에 없는 항목은 표시할 수 없다', () => {
    const state = make({ checklist: ['y-zero'] });
    expect(run(state, mark('a', 'sum-100'))).toBe(state);
  });

  it('show-example은 범위 안의 정수만 받는다', () => {
    const state = make();
    expect(run(state, { type: 'show-example', index: 4 })).toBe(state);
    expect(run(state, { type: 'show-example', index: -1 })).toBe(state);
    expect(run(state, { type: 'show-example', index: 3 }).exampleIndex).toBe(3);
  });

  it('묶음: 켜고 끄고, 구성원이 겹치는 묶음은 함께 못 켠다', () => {
    const config = {
      data: { 가: 1, 나: 2, 다: 3 },
      groupOptions: [
        { label: '가나', members: ['가', '나'] },
        { label: '나다', members: ['나', '다'] },
      ],
    };
    const base = createInitialState({ ...FULL, ...config } as unknown as GraphConfig);
    const on = run(base, { type: 'toggle-group', label: '가나' });
    expect(on.groups).toEqual(['가나']);
    expect(on.history.grouped).toBe(true);
    expect(run(on, { type: 'toggle-group', label: '나다' })).toBe(on);
    expect(run(on, { type: 'toggle-group', label: '가나' }).groups).toEqual([]);
  });

  it('상태는 JSON 직렬화가 된다', () => {
    const state = run(make(), start(45), mark('a', 'y-zero'), { type: 'toggle-wavy' });
    expect(() => assertSerializable(state)).not.toThrow();
  });
});

describe('distortion observe', () => {
  it('visualRatio: 0 시작이면 값의 비 52/48, 45 시작이면 7/3이다', () => {
    const zero = observe(make());
    expect(zero['visualRatio']).toBe('13/12');
    expect(zero['valueRatio']).toBe('13/12');
    const cut = observe(run(make(), start(45)));
    expect(cut['visualRatio']).toBe('7/3');
    expect(cut['valueRatio']).toBe('13/12');
    // 눈금 간격은 막대 높이의 비를 바꾸지 않는다.
    expect(observe(run(make(), start(45), step(5)))['visualRatio']).toBe('7/3');
  });

  it('물결선을 보이면 물결 칸 1이 막대 높이에 더해져 비가 줄어든다', () => {
    const wavy = observe(run(make(), start(45), { type: 'toggle-wavy' }, step(1)));
    // 높이: (52-45)/1+1 = 8, (48-45)/1+1 = 4 → 2
    expect(wavy['wavyShown']).toBe(true);
    expect(wavy['visualRatio']).toBe('2');
    // 시작값이 0이면 켜 있어도 보이지 않는다.
    expect(observe(run(make(), { type: 'toggle-wavy' }))['wavyShown']).toBe(false);
  });

  it('가장 짧은 막대가 0이면 visualRatio는 null이다', () => {
    const state = run(make({ yStartOptions: [0, 48] }), start(48));
    expect(observe(state)['visualRatio']).toBeNull();
    expect(observe(state)['valueRatio']).toBe('13/12');
    const zeroData = make({ data: { 가: 5, 나: 0 } });
    expect(observe(zeroData)['valueRatio']).toBeNull();
  });

  it('묶음을 켜면 barCategories·barValues에 합이 나온다', () => {
    const state = createInitialState({
      mode: 'distortion',
      data: { 가: 10, 나: 20, 다: 30 },
      controls: ['groupItems'],
      groupOptions: [{ label: '나·다', members: ['나', '다'] }],
    } as unknown as GraphConfig);
    const observed = observe(run(state, { type: 'toggle-group', label: '나·다' }));
    expect(observed['barCategories']).toEqual(['가', '나·다']);
    expect(observed['barValues']).toEqual({ 가: 10, '나·다': 50 });
    expect(observed['groupsOn']).toEqual(['나·다']);
  });

  it('marksMatch: 집합이 같을 때만 true이고 flaws는 관찰 결과에 없다', () => {
    let state = make();
    expect(observe(state)['marksMatch']).toEqual({ a: false, b: false, c: false });
    state = run(state, mark('a', 'y-zero'), mark('b', 'sum-100'), mark('c', 'even-step'));
    expect(observe(state)['marksMatch']).toEqual({ a: true, b: true, c: false });
    expect(observe(state)['allMarksMatch']).toBe(false);
    state = run(state, mark('c', 'fair-grouping'));
    expect(observe(state)['allMarksMatch']).toBe(true);
    // 정답 말고 하나 더 고르면 틀린 것으로 본다.
    state = run(state, mark('a', 'even-step'));
    expect(observe(state)['marksMatch']).toMatchObject({ a: false });
    expect(JSON.stringify(observe(state))).not.toContain('flaws');
  });

  it('예시가 없으면 allMarksMatch는 false다', () => {
    const state = make({ examples: [] });
    expect(observe(state)['allMarksMatch']).toBe(false);
  });

  it('observe는 JSON 직렬화가 되고 큰 값(1000)도 비를 정확히 구한다', () => {
    const state = make({ data: { 가: 1000, 나: 999 }, yStartOptions: [0, 990], yStepOptions: [1] });
    expect(() => assertSerializable(observe(state))).not.toThrow();
    expect(observe(run(state, start(990)))['visualRatio']).toBe('10/9');
  });
});

describe('distortion predicate', () => {
  const at = (state: GraphState) => observe(state);

  it('yStartAbove·yStartIs', () => {
    const zero = at(make());
    const cut = at(run(make(), start(45)));
    expect(predicates['yStartAbove']?.(zero, { value: 0 })).toBe(false);
    expect(predicates['yStartAbove']?.(cut, { value: 0 })).toBe(true);
    expect(predicates['yStartIs']?.(zero, { value: 0 })).toBe(true);
    expect(predicates['yStartIs']?.(cut, { value: 0 })).toBe(false);
    expect(predicates['yStartIs']?.(cut, { value: '45' })).toBe(false);
  });

  it('visualRatioAtLeast·AtMost는 Rational으로 비교한다', () => {
    const cut = at(run(make(), start(45)));
    expect(predicates['visualRatioAtLeast']?.(cut, { value: '7/3' })).toBe(true);
    expect(predicates['visualRatioAtLeast']?.(cut, { value: '2.4' })).toBe(false);
    expect(predicates['visualRatioAtLeast']?.(cut, { value: 2 })).toBe(true);
    expect(predicates['visualRatioAtMost']?.(cut, { value: '7/3' })).toBe(true);
    expect(predicates['visualRatioAtMost']?.(cut, { value: 2 })).toBe(false);
    const nothing = at(run(make({ yStartOptions: [0, 48] }), start(48)));
    expect(predicates['visualRatioAtLeast']?.(nothing, { value: 1 })).toBe(false);
    expect(predicates['visualRatioAtMost']?.(nothing, { value: 100 })).toBe(false);
    expect(predicates['visualRatioAtLeast']?.(cut, { value: 'abc' })).toBe(false);
  });

  it('marksMatch: example를 주면 그 예시만, 없으면 모든 예시', () => {
    const state = run(make(), mark('a', 'y-zero'));
    expect(predicates['marksMatch']?.(at(state), { example: 'a' })).toBe(true);
    expect(predicates['marksMatch']?.(at(state), { example: 'b' })).toBe(false);
    expect(predicates['marksMatch']?.(at(state), {})).toBe(false);
  });
});

describe('distortion 이벤트', () => {
  const names = (prev: GraphState, action: GraphAction) =>
    emit(prev, reduce(prev, action), action).map((event) => event.name);

  it('axis-changed·group-changed·headline-changed·mark-changed', () => {
    const state = make({
      groupOptions: [{ label: '묶음', members: ['1반', '2반'] }],
    });
    expect(names(state, start(45))).toEqual(['axis-changed']);
    expect(names(state, step(10))).toEqual(['axis-changed']);
    expect(names(state, { type: 'toggle-wavy' })).toEqual(['axis-changed']);
    expect(names(state, { type: 'toggle-group', label: '묶음' })).toEqual(['group-changed']);
    expect(names(state, { type: 'add-headline', card: '독서왕 1반' })).toEqual([
      'headline-changed',
    ]);
    expect(names(state, mark('a', 'y-zero'))).toEqual(['mark-changed']);
    expect(emit(state, reduce(state, start(7)), start(7))).toEqual([]);
    expect(emit(state, reduce(state, { type: 'show-example', index: 1 }), start(0))).toEqual([]);
  });

  it('mark-changed 이벤트에는 예시 id만 실린다', () => {
    const state = make();
    const action = mark('a', 'y-zero');
    expect(emit(state, reduce(state, action), action)).toEqual([
      { name: 'mark-changed', payload: { example: 'a' } },
    ]);
  });
});

describe('distortion 계산', () => {
  it('axisCellsFor: 가장 큰 값 위에 한 칸 이상 남는다', () => {
    expect(axisCellsFor(52, 0, 10)).toBe(6);
    expect(axisCellsFor(50, 0, 10)).toBe(6);
    expect(axisCellsFor(52, 45, 1)).toBe(8);
    expect(axisCellsFor(0, 0, 5)).toBe(1);
    expect(axisCellsFor(10, 45, 5)).toBe(1);
  });

  it('visualRatioOf·valueRatioOf: 경계값', () => {
    expect(visualRatioOf([], 0, 1, false)).toBeNull();
    expect(visualRatioOf([5], 0, 1, false)?.equals(Rational.of(1))).toBe(true);
    expect(visualRatioOf([0, 5], 0, 1, false)).toBeNull();
    expect(valueRatioOf([6, 4])?.toJSON()).toBe('3/2');
    expect(valueRatioOf([])).toBeNull();
  });

  it('groupedBars: 첫 구성원 자리에 합으로 놓인다', () => {
    const bars = groupedBars(
      ['가', '나', '다', '라'],
      { 가: 1, 나: 2, 다: 3, 라: 4 },
      [{ label: '나라', members: ['나', '라'] }],
      ['나라'],
    );
    expect(bars).toEqual([
      { cat: '가', value: 1 },
      { cat: '나라', value: 6 },
      { cat: '다', value: 3 },
    ]);
  });

  it('unitsOnTicks: 눈금 사이는 직선으로 잇고 범위 밖은 끝에 붙인다', () => {
    expect(unitsOnTicks([0, 10, 30, 60], 20)).toBeCloseTo(1.5);
    expect(unitsOnTicks([0, 10, 30, 60], 60)).toBe(3);
    expect(unitsOnTicks([0, 10, 30, 60], 5)).toBe(0.5);
    expect(unitsOnTicks([10, 20], 5)).toBe(0);
    expect(unitsOnTicks([10, 20], 99)).toBe(1);
  });

  it('exampleTicks: ticks가 없으면 yStart부터 최댓값을 덮는다', () => {
    const state = make();
    const example = state.settings.distortion?.examples[0];
    if (example === undefined) throw new Error('예시 없음');
    const ticks = exampleTicks(example);
    expect(ticks[0]).toBe(45);
    expect(ticks[ticks.length - 1]).toBeGreaterThan(52);
  });

  it('currentScene: 원그래프 예시는 막대 장면이 없다', () => {
    expect(currentScene(run(make(), { type: 'show-example', index: 2 }))).toBeNull();
    const own = currentScene(make());
    expect(own?.bars.map((bar) => bar.cat)).toEqual(['1반', '2반']);
    const uneven = currentScene(run(make(), { type: 'show-example', index: 3 }));
    expect(uneven?.ticks.map((tick) => tick.value)).toEqual([0, 10, 30, 60]);
    expect(uneven?.bars[1]?.units).toBeCloseTo(1.5);
  });
});
