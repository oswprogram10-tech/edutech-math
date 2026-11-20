/** E19 가능성 모드(words·spinner·simulate) 엔진 테스트: 결정성, 확률, 편집 범위, 판정, 직렬화, 오버레이 계산. */
import { describe, expect, it } from 'vitest';
import type { Observation } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import definition from '../index';
import { observe } from '../observe';
import { afterStreakStats, smallBatchCounts } from '../overlays/compute';
import { createInitialState, reduce } from '../reduce';
import { makeRng, probabilitiesOf, sequence, spinOnce, tally, totalOf } from '../device';
import type {
  ChanceAction,
  ChanceConfig,
  ChanceState,
  Device,
  SimulateState,
  SpinnerState,
  WordsState,
} from '../types';

function play(config: ChanceConfig, actions: readonly ChanceAction[] = []): ChanceState {
  return actions.reduce<ChanceState>(reduce, createInitialState(config));
}
function words(config: object = {}, actions: readonly ChanceAction[] = []): WordsState {
  const state = play({ mode: 'words', ...config } as ChanceConfig, actions);
  if (state.mode !== 'words') throw new Error('words 아님');
  return state;
}
function spinner(config: object = {}, actions: readonly ChanceAction[] = []): SpinnerState {
  const state = play({ mode: 'spinner', ...config } as ChanceConfig, actions);
  if (state.mode !== 'spinner') throw new Error('spinner 아님');
  return state;
}
function simulate(config: object = {}, actions: readonly ChanceAction[] = []): SimulateState {
  const state = play({ mode: 'simulate', ...config } as ChanceConfig, actions);
  if (state.mode !== 'simulate') throw new Error('simulate 아님');
  return state;
}
const pred = (name: string, observation: Observation, args?: Record<string, unknown>): boolean => {
  const fn = predicates[name];
  if (!fn) throw new Error(`판정 ${name} 없음`);
  return fn(observation, args as never);
};
const obs = (state: ChanceState): Observation => observe(state);

const HALF: Device = {
  type: 'spinner',
  sectors: [
    { color: 'red', size: 1 },
    { color: 'blue', size: 1 },
  ],
};
const bag = (red: number, blue = 0, yellow = 0, green = 0): Device => ({
  type: 'bag',
  marbles: [
    { color: 'red', count: red },
    { color: 'blue', count: blue },
    { color: 'yellow', count: yellow },
    { color: 'green', count: green },
  ],
});

describe('난수(seed)', () => {
  it('같은 seed는 같은 수열, 다른 seed는 다른 수열', () => {
    const a = makeRng(7);
    const b = makeRng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(makeRng(7)()).not.toBe(makeRng(8)());
  });

  it('같은 Action 목록이면 같은 상태(되감기·미러링)', () => {
    const actions: ChanceAction[] = [
      { type: 'spin', seed: 1 },
      { type: 'spin', seed: 2 },
      { type: 'spin', seed: 3 },
    ];
    expect(spinner({}, actions)).toEqual(spinner({}, actions));
    const run: ChanceAction[] = [{ type: 'run', batch: 1000, seed: 99 }];
    expect(simulate({}, run)).toEqual(simulate({}, run));
  });

  it('상태는 JSON 왕복 뒤에도 같은 reduce 결과를 낸다', () => {
    const s0 = spinner({}, [{ type: 'spin', seed: 5 }]);
    const roundTrip = JSON.parse(JSON.stringify(s0)) as ChanceState;
    expect(reduce(roundTrip, { type: 'spin', seed: 6 })).toEqual(
      reduce(s0, { type: 'spin', seed: 6 }),
    );
    const s1 = simulate({}, [{ type: 'run', batch: 10, seed: 5 }]);
    expect(JSON.parse(JSON.stringify(s1))).toEqual(s1);
    const s2 = words({}, [{ type: 'place', cardId: 'c1', slot: '1' }]);
    expect(JSON.parse(JSON.stringify(s2))).toEqual(s2);
  });

  it('10,000회 빨강 1/2 장치의 상대도수는 0.45~0.55', () => {
    for (const seed of [1, 2, 3, 12345, 4294967295]) {
      const counts = tally(HALF, seed, 10000);
      expect(counts.red + counts.blue).toBe(10000);
      expect(counts.red / 10000).toBeGreaterThan(0.45);
      expect(counts.red / 10000).toBeLessThan(0.55);
      expect(counts.yellow + counts.green).toBe(0);
    }
  });

  it('spinOnce와 tally(1회)가 같은 결과를 낸다', () => {
    for (const seed of [0, 1, 99, 2 ** 32 - 1]) {
      const { outcome } = spinOnce(HALF, seed);
      expect(tally(HALF, seed, 1)[outcome]).toBe(1);
      expect(sequence(HALF, seed, 1)).toEqual([outcome]);
    }
  });

  it('1회 reduce는 10,000회도 50ms 안에 끝난다', () => {
    const start = performance.now();
    simulate({}, [{ type: 'run', batch: 10000, seed: 3 }]);
    expect(performance.now() - start).toBeLessThan(50);
  });
});

describe('가능성(probabilities)', () => {
  it('회전판: 칸 크기 합 ÷ 전체, 약분', () => {
    const state = spinner({
      device: {
        type: 'spinner',
        sectors: [
          { color: 'red', size: 2 },
          { color: 'blue', size: 1 },
          { color: 'red', size: 1 },
          { color: 'green', size: 4 },
        ],
      },
    });
    expect(obs(state)['probabilities']).toEqual({
      red: '3/8',
      blue: '1/8',
      yellow: '0',
      green: '1/2',
    });
  });

  it('주머니: 빨강 0개 → "0", 모두 빨강 → "1"', () => {
    expect(probabilitiesOf(bag(0, 3)).red).toBe('0');
    expect(probabilitiesOf(bag(0, 3)).blue).toBe('1');
    expect(probabilitiesOf(bag(5)).red).toBe('1');
    expect(probabilitiesOf(bag(1, 1, 1, 1)).yellow).toBe('1/4');
    expect(probabilitiesOf(bag(10, 10)).red).toBe('1/2');
    expect(totalOf(bag(10, 10))).toBe(20);
  });

  it('주머니는 네 색 목록으로 정리된다(없는 색은 0개)', () => {
    const state = spinner({
      device: { type: 'bag', marbles: [{ color: 'green', count: 2 }] },
    });
    expect(state.device).toEqual(bag(0, 0, 0, 2));
  });
});

describe('설정 검사', () => {
  const errorOf = (config: object): string | null =>
    createInitialState(config as ChanceConfig).error;
  it('기본값: words 5장, spinner 빨강1·파랑1, simulate [10,1000,10000]', () => {
    expect(words().cards).toHaveLength(5);
    expect(words().slotValues).toEqual(['0', '1/4', '1/2', '3/4', '1']);
    expect(words({ slots: 'three' }).slotValues).toEqual(['0', '1/2', '1']);
    expect(spinner().device).toEqual(HALF);
    expect(simulate().batches).toEqual([10, 1000, 10000]);
    expect(simulate().showExpected).toBe(true);
    expect(spinner().editable).toBe(true);
  });

  it('범위 밖 설정은 오류', () => {
    expect(errorOf({ mode: 'words', cards: [] })).not.toBeNull();
    const seven = Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, text: `카드${i}` }));
    expect(errorOf({ mode: 'words', cards: seven })).not.toBeNull();
    expect(errorOf({ mode: 'words', cards: seven.slice(0, 6) })).toBeNull();
    expect(
      errorOf({
        mode: 'words',
        cards: [
          { id: 'a', text: 'x' },
          { id: 'a', text: 'y' },
        ],
      }),
    ).not.toBeNull();
    expect(errorOf({ mode: 'words', slots: 'four' })).not.toBeNull();
    const sectors = (n: number, size = 1) =>
      Array.from({ length: n }, () => ({ color: 'red', size }));
    expect(
      errorOf({ mode: 'spinner', device: { type: 'spinner', sectors: sectors(0) } }),
    ).not.toBeNull();
    expect(
      errorOf({ mode: 'spinner', device: { type: 'spinner', sectors: sectors(9) } }),
    ).not.toBeNull();
    expect(
      errorOf({ mode: 'spinner', device: { type: 'spinner', sectors: sectors(8, 4) } }),
    ).toBeNull();
    expect(
      errorOf({ mode: 'spinner', device: { type: 'spinner', sectors: sectors(2, 5) } }),
    ).not.toBeNull();
    expect(errorOf({ mode: 'spinner', device: bag(0) })).not.toBeNull();
    expect(errorOf({ mode: 'spinner', device: bag(11) })).not.toBeNull();
    expect(errorOf({ mode: 'spinner', device: bag(10, 10) })).toBeNull();
    expect(errorOf({ mode: 'spinner', device: bag(10, 10, 1) })).not.toBeNull();
    expect(errorOf({ mode: 'spinner', device: { type: 'cup' } })).not.toBeNull();
    expect(errorOf({ mode: 'simulate', batches: [] })).not.toBeNull();
    expect(errorOf({ mode: 'simulate', batches: [10, 10] })).not.toBeNull();
    expect(errorOf({ mode: 'simulate', batches: [1, 2, 3, 4, 5] })).not.toBeNull();
    expect(errorOf({ mode: 'simulate', batches: [0] })).not.toBeNull();
    expect(errorOf({ mode: 'simulate', batches: [10001] })).not.toBeNull();
    expect(errorOf({ mode: 'simulate', batches: [10, 10000] })).toBeNull();
  });
});

describe('words', () => {
  it('place·unplace', () => {
    const s0 = words();
    expect(s0.placements).toEqual({ c1: null, c2: null, c3: null, c4: null, c5: null });
    const s1 = reduce(s0, { type: 'place', cardId: 'c1', slot: '1' }) as WordsState;
    expect(s1.placements['c1']).toBe('1');
    // 같은 값의 다른 표기도 칸으로 받아들인다
    const s2 = reduce(s1, { type: 'place', cardId: 'c2', slot: '2/4' }) as WordsState;
    expect(s2.placements['c2']).toBe('1/2');
    // 한 칸에 여러 장
    const s3 = reduce(s2, { type: 'place', cardId: 'c3', slot: '1/2' }) as WordsState;
    expect(Object.values(s3.placements).filter((v) => v === '1/2')).toHaveLength(2);
    // 다른 칸으로 옮기기
    const s4 = reduce(s3, { type: 'place', cardId: 'c3', slot: '0' }) as WordsState;
    expect(s4.placements['c3']).toBe('0');
    const s5 = reduce(s4, { type: 'unplace', cardId: 'c3' }) as WordsState;
    expect(s5.placements['c3']).toBeNull();
    expect(reduce(s5, { type: 'reset' })).toEqual(s0);
  });

  it('거절: 없는 카드·없는 칸·같은 칸·읽을 수 없는 값은 상태 그대로(같은 객체)', () => {
    const s0 = words();
    expect(reduce(s0, { type: 'place', cardId: 'zz', slot: '1' })).toBe(s0);
    expect(reduce(s0, { type: 'place', cardId: 'c1', slot: '1/3' })).toBe(s0);
    expect(reduce(s0, { type: 'place', cardId: 'c1', slot: 'abc' })).toBe(s0);
    expect(reduce(s0, { type: 'unplace', cardId: 'c1' })).toBe(s0);
    expect(reduce(s0, { type: 'reset' })).toBe(s0);
    const s1 = reduce(s0, { type: 'place', cardId: 'c1', slot: '1' });
    expect(reduce(s1, { type: 'place', cardId: 'c1', slot: '1' })).toBe(s1);
    // three는 1/4 칸이 없다
    const three = words({ slots: 'three' });
    expect(reduce(three, { type: 'place', cardId: 'c1', slot: '1/4' })).toBe(three);
  });

  it('Observation·판정', () => {
    const s = words({}, [{ type: 'place', cardId: 'c1', slot: '1' }]);
    const o = obs(s);
    expect(o['placements']).toEqual({ c1: '1', c2: null, c3: null, c4: null, c5: null });
    expect(o['allPlaced']).toBe(false);
    expect(pred('placementIs', o, { card: 'c1', value: '1' })).toBe(true);
    expect(pred('placementIs', o, { card: 'c1', value: '4/4' })).toBe(true);
    expect(pred('placementIs', o, { card: 'c1', value: '1/2' })).toBe(false);
    expect(pred('placementIs', o, { card: 'c2', value: '0' })).toBe(false);
    expect(pred('placementIs', o, { card: 'zz', value: '0' })).toBe(false);
    expect(pred('allPlaced', o)).toBe(false);
    const all = words(
      {},
      ['c1', 'c2', 'c3', 'c4', 'c5'].map(
        (cardId) => ({ type: 'place', cardId, slot: '1/2' }) as const,
      ),
    );
    expect(pred('allPlaced', obs(all))).toBe(true);
  });
});

describe('spinner', () => {
  it('spin: 횟수·색별 횟수·최근 10개', () => {
    let state: ChanceState = spinner();
    for (let seed = 1; seed <= 12; seed += 1) state = reduce(state, { type: 'spin', seed });
    if (state.mode !== 'spinner') throw new Error();
    expect(state.trials).toBe(12);
    expect(state.counts.red + state.counts.blue).toBe(12);
    expect(state.last).toHaveLength(10);
    expect(obs(state)['trials']).toBe(12);
    expect(pred('trialsAtLeast', obs(state), { n: 12 })).toBe(true);
    expect(pred('trialsAtLeast', obs(state), { n: 13 })).toBe(false);
  });

  it('spin 거절: seed가 정수·0 이상 2^32 미만이 아니면 그대로', () => {
    const s0 = spinner();
    for (const seed of [-1, 1.5, 2 ** 32, Number.NaN]) {
      expect(reduce(s0, { type: 'spin', seed })).toBe(s0);
    }
    expect(reduce(s0, { type: 'spin', seed: 0 })).not.toBe(s0);
    expect(reduce(s0, { type: 'spin', seed: 2 ** 32 - 1 })).not.toBe(s0);
  });

  it('주머니 한 가지 색만 있으면 늘 그 색', () => {
    const s = spinner({ device: bag(0, 0, 3) }, [
      { type: 'spin', seed: 1 },
      { type: 'spin', seed: 2 },
    ]);
    expect(s.counts.yellow).toBe(2);
    expect(s.last).toEqual(['yellow', 'yellow']);
  });

  it('회전판 편집: 범위 거절·편집 시 결과 지움·edits는 남음', () => {
    let s = spinner({}, [{ type: 'spin', seed: 1 }]);
    expect(s.trials).toBe(1);
    const edited = reduce(s, { type: 'sector-add', color: 'yellow' }) as SpinnerState;
    expect(edited.device.type === 'spinner' && edited.device.sectors).toHaveLength(3);
    expect(edited.trials).toBe(0);
    expect(edited.last).toEqual([]);
    expect(edited.counts).toEqual({ red: 0, blue: 0, yellow: 0, green: 0 });
    expect(edited.edits).toBe(1);
    expect(obs(edited)['edits']).toBe(1);
    s = edited;
    // 시행 뒤 다시 편집해도 edits는 쌓인다
    s = reduce(s, { type: 'spin', seed: 4 }) as SpinnerState;
    s = reduce(s, { type: 'sector-size', index: 2, size: 3 }) as SpinnerState;
    expect(s.edits).toBe(2);
    expect(s.trials).toBe(0);
    expect(obs(s)['probabilities']).toEqual({ red: '1/5', blue: '1/5', yellow: '3/5', green: '0' });
  });

  it('편집 거절은 같은 객체', () => {
    const s0 = spinner();
    const full = spinner({
      device: {
        type: 'spinner',
        sectors: Array.from({ length: 8 }, () => ({ color: 'red', size: 1 })),
      },
    });
    expect(reduce(full, { type: 'sector-add', color: 'blue' })).toBe(full);
    const one = spinner({ device: { type: 'spinner', sectors: [{ color: 'red', size: 1 }] } });
    expect(reduce(one, { type: 'sector-remove', index: 0 })).toBe(one);
    expect(reduce(s0, { type: 'sector-remove', index: 2 })).toBe(s0);
    expect(reduce(s0, { type: 'sector-remove', index: -1 })).toBe(s0);
    expect(reduce(s0, { type: 'sector-size', index: 0, size: 0 })).toBe(s0);
    expect(reduce(s0, { type: 'sector-size', index: 0, size: 5 })).toBe(s0);
    expect(reduce(s0, { type: 'sector-size', index: 0, size: 1 })).toBe(s0);
    expect(reduce(s0, { type: 'sector-size', index: 0, size: 1.5 })).toBe(s0);
    expect(reduce(s0, { type: 'sector-size', index: 9, size: 2 })).toBe(s0);
    expect(reduce(s0, { type: 'sector-color', index: 0, color: 'red' })).toBe(s0);
    expect(reduce(s0, { type: 'sector-color', index: 0, color: 'pink' as never })).toBe(s0);
    expect(reduce(s0, { type: 'sector-add', color: 'pink' as never })).toBe(s0);
    // 주머니 Action은 회전판에서 거절
    expect(reduce(s0, { type: 'marble-set', color: 'red', count: 3 })).toBe(s0);
  });

  it('주머니 편집: 색별 0~10, 합 1~20', () => {
    const b = spinner({ device: bag(1, 1) });
    const more = reduce(b, { type: 'marble-set', color: 'red', count: 5 }) as SpinnerState;
    expect(more.device).toEqual(bag(5, 1));
    expect(reduce(b, { type: 'marble-set', color: 'red', count: 11 })).toBe(b);
    expect(reduce(b, { type: 'marble-set', color: 'red', count: -1 })).toBe(b);
    expect(reduce(b, { type: 'marble-set', color: 'red', count: 1 })).toBe(b);
    // 합 0은 거절: 마지막 두 구슬을 모두 빼는 두 번째 편집
    const lone = spinner({ device: bag(1) });
    expect(reduce(lone, { type: 'marble-set', color: 'red', count: 0 })).toBe(lone);
    // 합 21은 거절
    const near = spinner({ device: bag(10, 10) });
    expect(reduce(near, { type: 'marble-set', color: 'yellow', count: 1 })).toBe(near);
    expect(reduce(near, { type: 'sector-add', color: 'red' })).toBe(near);
  });

  it('editable: false이면 장치 편집은 거절, 돌리기는 된다', () => {
    const s0 = spinner({ editable: false });
    expect(reduce(s0, { type: 'sector-add', color: 'green' })).toBe(s0);
    expect(reduce(s0, { type: 'spin', seed: 1 })).not.toBe(s0);
  });

  it('reset: 시행·편집을 모두 되돌린다', () => {
    const s0 = spinner();
    const s1 = reduce(reduce(s0, { type: 'sector-add', color: 'green' }), {
      type: 'spin',
      seed: 9,
    });
    expect(reduce(s1, { type: 'reset' })).toEqual(s0);
    expect(reduce(s0, { type: 'reset' })).toBe(s0);
  });

  it('판정: probabilityIs·deviceHas', () => {
    const o = obs(
      spinner({
        device: {
          type: 'spinner',
          sectors: [
            { color: 'red', size: 2 },
            { color: 'blue', size: 2 },
            { color: 'red', size: 1 },
          ],
        },
      }),
    );
    expect(pred('probabilityIs', o, { outcome: 'red', value: '3/5' })).toBe(true);
    expect(pred('probabilityIs', o, { outcome: 'red', value: '6/10' })).toBe(true);
    expect(pred('probabilityIs', o, { outcome: 'blue', value: '3/5' })).toBe(false);
    expect(pred('probabilityIs', o, { outcome: 'pink', value: '0' })).toBe(false);
    expect(pred('deviceHas', o, { outcome: 'red', count: 3 })).toBe(true);
    expect(pred('deviceHas', o, { outcome: 'red', count: 2 })).toBe(false);
    expect(pred('deviceHas', o, { outcome: 'yellow', count: 0 })).toBe(true);
    const ob = obs(spinner({ device: bag(3, 2) }));
    expect(pred('deviceHas', ob, { outcome: 'red', count: 3 })).toBe(true);
    expect(pred('deviceHas', ob, { outcome: 'green', count: 0 })).toBe(true);
    expect(pred('probabilityIs', ob, { outcome: 'red', value: '3/5' })).toBe(true);
  });
});

describe('simulate', () => {
  it('run: 칸마다 횟수 합이 batch, 같은 칸을 다시 돌리면 그 칸만 새로', () => {
    let s = simulate({}, [{ type: 'run', batch: 10, seed: 1 }]);
    expect(s.results.map((r) => r.batch)).toEqual([10]);
    expect(Object.values(s.results[0]?.counts ?? {}).reduce((a, b) => a + b, 0)).toBe(10);
    s = reduce(s, { type: 'run', batch: 10000, seed: 2 }) as SimulateState;
    expect(s.results.map((r) => r.batch)).toEqual([10, 10000]);
    const before = s.results[0];
    s = reduce(s, { type: 'run', batch: 10000, seed: 3 }) as SimulateState;
    expect(s.results[0]).toBe(before);
    expect(s.runs).toBe(3);
    // 순서는 batches 순서
    const t = simulate({}, [
      { type: 'run', batch: 10000, seed: 2 },
      { type: 'run', batch: 10, seed: 1 },
    ]);
    expect(t.results.map((r) => r.batch)).toEqual([10, 10000]);
  });

  it('Observation: rel은 기약분수, 돌린 칸만', () => {
    const s = simulate({ batches: [4] }, [{ type: 'run', batch: 4, seed: 1 }]);
    const o = obs(s);
    const results = o['results'] as {
      batch: number;
      counts: Record<string, number>;
      rel: Record<string, string>;
    }[];
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r?.batch).toBe(4);
    expect(r?.rel['red']).toBe(
      { 0: '0', 1: '1/4', 2: '1/2', 3: '3/4', 4: '1' }[r?.counts['red'] ?? 0],
    );
    expect(o['runs']).toBe(1);
    expect(o['allBatchesRun']).toBe(true);
    expect(obs(simulate())['results']).toEqual([]);
    expect(obs(simulate())['allBatchesRun']).toBe(false);
  });

  it('run 거절: 목록에 없는 batch·잘못된 seed', () => {
    const s0 = simulate();
    expect(reduce(s0, { type: 'run', batch: 100, seed: 1 })).toBe(s0);
    expect(reduce(s0, { type: 'run', batch: 10, seed: -3 })).toBe(s0);
    expect(reduce(s0, { type: 'run', batch: 10, seed: 0.5 })).toBe(s0);
  });

  it('clear·편집·reset', () => {
    const s1 = simulate({}, [
      { type: 'run', batch: 10, seed: 1 },
      { type: 'run', batch: 1000, seed: 2 },
    ]);
    const cleared = reduce(s1, { type: 'clear' }) as SimulateState;
    expect(cleared.results).toEqual([]);
    expect(cleared.runs).toBe(0);
    expect(reduce(cleared, { type: 'clear' })).toBe(cleared);
    const edited = reduce(s1, { type: 'sector-add', color: 'green' }) as SimulateState;
    expect(edited.results).toEqual([]);
    expect(edited.edits).toBe(1);
    expect(reduce(edited, { type: 'reset' })).toEqual(simulate());
    expect(reduce(simulate(), { type: 'reset' })).toEqual(simulate());
  });

  it('판정: batchRun·allBatchesRun·probabilityIs', () => {
    const s = simulate({}, [{ type: 'run', batch: 10, seed: 1 }]);
    expect(pred('batchRun', obs(s), { batch: 10 })).toBe(true);
    expect(pred('batchRun', obs(s), { batch: 1000 })).toBe(false);
    expect(pred('allBatchesRun', obs(s))).toBe(false);
    const all = simulate(
      {},
      [10, 1000, 10000].map((batch) => ({ type: 'run', batch, seed: batch }) as const),
    );
    expect(pred('allBatchesRun', obs(all))).toBe(true);
    expect(pred('probabilityIs', obs(all), { outcome: 'blue', value: '1/2' })).toBe(true);
  });
});

describe('Observation·이벤트', () => {
  it('설정 오류에서도 모양이 같다', () => {
    const o = obs(createInitialState({ mode: 'spinner', device: bag(0) } as ChanceConfig));
    expect(o['error']).toBeTruthy();
  });

  it('상태가 바뀔 때만 이벤트', () => {
    const s0 = spinner();
    const s1 = reduce(s0, { type: 'spin', seed: 1 });
    expect(emit(s0, s1, { type: 'spin', seed: 1 })).toEqual([
      { name: 'chance-changed', payload: { trials: 1 } },
    ]);
    expect(emit(s0, s0, { type: 'spin', seed: -1 })).toEqual([]);
    const w0 = words();
    const w1 = reduce(w0, { type: 'place', cardId: 'c1', slot: '0' });
    expect(emit(w0, w1, { type: 'place', cardId: 'c1', slot: '0' })).toEqual([
      { name: 'chance-changed', payload: { allPlaced: false } },
    ]);
    const m0 = simulate();
    const m1 = reduce(m0, { type: 'run', batch: 10, seed: 1 });
    expect(emit(m0, m1, { type: 'run', batch: 10, seed: 1 })).toEqual([
      { name: 'chance-changed', payload: { runs: 1 } },
    ]);
  });

  it('정의에 새 모드·오버레이가 등록돼 있다', () => {
    expect(definition.modes).toEqual([
      'leveling',
      'seesaw',
      'outlier',
      'words',
      'spinner',
      'simulate',
    ]);
    expect(Object.keys(definition.overlays ?? {}).sort()).toEqual([
      'after-streak',
      'arms',
      'level-try',
      'mean-pull',
      'small-batches',
      'sum-tower',
    ]);
  });
});

describe('오버레이 계산 함수(순수)', () => {
  it('small-batches: 같은 장치면 늘 같고, 묶음은 5개·각 합 10', () => {
    const a = smallBatchCounts(HALF);
    expect(a).toEqual(smallBatchCounts(HALF));
    expect(a).toHaveLength(5);
    for (const counts of a) {
      expect(Object.values(counts).reduce((x, y) => x + y, 0)).toBe(10);
    }
    // 들쭉날쭉: 5묶음의 빨강 횟수가 전부 같지는 않다
    expect(new Set(a.map((c) => c.red)).size).toBeGreaterThan(1);
  });

  it('after-streak: 빨강이 없으면 null, 있으면 같은 결과', () => {
    expect(afterStreakStats(bag(0, 4))).toBeNull();
    const a = afterStreakStats(HALF);
    expect(a).toEqual(afterStreakStats(HALF));
    expect(a?.trials).toBe(10000);
    expect(a?.samples).toBeGreaterThan(100);
    const total = Object.values(a?.whole ?? {}).reduce((x, y) => x + y, 0);
    expect(total).toBe(10000);
    // 도박사의 오류 반례: 5번 이어진 다음에도 빨강 상대도수는 1/2 근처
    const rel = (a?.after.red ?? 0) / (a?.samples ?? 1);
    expect(rel).toBeGreaterThan(0.35);
    expect(rel).toBeLessThan(0.65);
  });

  it('after-streak: 모두 빨강이면 늘 빨강, 드문 빨강이면 표본 0', () => {
    const all = afterStreakStats(bag(3));
    expect(all?.after.red).toBe(all?.samples);
    const rare = afterStreakStats(bag(1, 10, 9));
    expect(rare?.samples).toBe(0);
  });
});
