import { describe, expect, it } from 'vitest';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { Observation } from '../../../core/engine-sdk';
import type {
  PercentConfig,
  PercentState,
  RacerConfig,
  RateConfig,
  RateState,
  RatioAction,
  RatioState,
} from '../types';

function rate(config: Partial<RateConfig> = {}, actions: readonly RatioAction[] = []): RateState {
  const state = actions.reduce<RatioState>(reduce, createInitialState({ mode: 'rate', ...config }));
  if (state.mode !== 'rate') throw new Error('rate 아님');
  return state;
}

function percent(
  config: Partial<PercentConfig> = {},
  actions: readonly RatioAction[] = [],
): PercentState {
  const state = actions.reduce<RatioState>(
    reduce,
    createInitialState({ mode: 'percent', ...config }),
  );
  if (state.mode !== 'percent') throw new Error('percent 아님');
  return state;
}

const obs = (state: RatioState): Observation => observe(state, {});
const predict = (value: string): RatioAction => ({ type: 'predict', value });
const run: RatioAction = { type: 'run' };
const hit = (name: string, observation: Observation, args?: Record<string, unknown>) => {
  const check = predicates[name];
  if (!check) throw new Error(`predicate 없음: ${name}`);
  return check(observation, args as never);
};

const racer = (
  id: string,
  distance: number | null,
  time: number | null,
  extra: Partial<RacerConfig> = {},
): RacerConfig => ({ id, name: `이름${id}`, distance, time, ...extra });

/** 같은 속력(60·10 vs 120·20)이고 거리·시간 쌍이 다른 두 캐릭터. */
const SAME_SPEED = [racer('a', 60, 10), racer('b', 120, 20)];
const BLANK = [racer('a', null, null), racer('b', null, null)];

function setField(racerId: string, field: 'distance' | 'time', value: number): RatioAction {
  return { type: 'set', racerId, field, value };
}

describe('rate 설정', () => {
  it('racers를 생략하면 토끼·거북 기본 장면(predictFirst)', () => {
    const state = rate();
    expect(state.error).toBeNull();
    expect(state.racers.map((r) => [r.name, r.distance, r.time])).toEqual([
      ['토끼', 120, 20],
      ['거북', 200, 40],
    ]);
    expect(state.settings).toEqual({
      predictFirst: true,
      maxDistance: 400,
      maxTime: 120,
      look: 'race',
    });
  });

  it('racers를 주면 predictFirst 기본은 false, editable 기본은 null인 칸만', () => {
    const state = rate({
      racers: [
        { name: '토끼', distance: 120, time: null },
        { name: '거북', distance: null, time: null },
      ],
    });
    expect(state.settings.predictFirst).toBe(false);
    expect(state.racers.map((r) => r.id)).toEqual(['racer-1', 'racer-2']);
    expect(state.racers[0]).toMatchObject({ editDistance: false, editTime: true });
    expect(state.racers[1]).toMatchObject({ editDistance: true, editTime: true });
  });

  it('editable true는 둘 다 열고, false는 둘 다 잠근다', () => {
    const state = rate({
      racers: [racer('a', 60, 10, { editable: true }), racer('b', null, null, { editable: false })],
    });
    expect(state.racers[0]).toMatchObject({ editDistance: true, editTime: true });
    expect(state.racers[1]).toMatchObject({ editDistance: false, editTime: false });
  });

  it('잘못된 설정은 오류 상태(조작 무시)', () => {
    const bad: Partial<RateConfig>[] = [
      { racers: [racer('a', 60, 10)] },
      { racers: [racer('a', 60, 10), racer('a', 120, 20)] },
      { racers: [racer('a', 0, 10), racer('b', 120, 20)] },
      { racers: [racer('a', 401, 10), racer('b', 120, 20)] },
      { racers: [racer('a', 60, 121), racer('b', 120, 20)] },
      { racers: [{ ...racer('a', 60, 10), name: '' }, racer('b', 120, 20)] },
      { look: 'x' as never },
      { maxDistance: 0 },
    ];
    for (const config of bad) {
      const state = rate(config);
      expect(state.error).not.toBeNull();
      expect(reduce(state, run)).toBe(state);
    }
  });
});

describe('rate reduce', () => {
  it('set: 편집할 수 있는 칸만, 1~max 정수', () => {
    const base = rate({ racers: BLANK });
    expect((reduce(base, setField('a', 'distance', 400)) as RateState).racers[0]?.distance).toBe(
      400,
    );
    expect((reduce(base, setField('a', 'distance', 1)) as RateState).racers[0]?.distance).toBe(1);
    expect(reduce(base, setField('a', 'distance', 0))).toBe(base);
    expect(reduce(base, setField('a', 'distance', 401))).toBe(base);
    expect(reduce(base, setField('a', 'distance', 1.5))).toBe(base);
    expect(reduce(base, setField('a', 'time', 121))).toBe(base);
    expect((reduce(base, setField('a', 'time', 120)) as RateState).racers[0]?.time).toBe(120);
    expect(reduce(base, setField('zzz', 'time', 5))).toBe(base);
    // 같은 값은 변화 없음
    const once = reduce(base, setField('a', 'distance', 30)) as RateState;
    expect(reduce(once, setField('a', 'distance', 30))).toBe(once);
  });

  it('set: 잠긴 칸(처음 값이 있는 칸)은 거절', () => {
    const state = rate({ racers: SAME_SPEED });
    expect(reduce(state, setField('a', 'distance', 70))).toBe(state);
  });

  it('run: 값이 다 있어야 하고 predictFirst면 예측 뒤에만', () => {
    const blank = rate({ racers: BLANK, predictFirst: true });
    expect(reduce(blank, run)).toBe(blank);
    const full = rate({ racers: SAME_SPEED, predictFirst: true });
    expect(reduce(full, run)).toBe(full);
    const predicted = reduce(full, predict('a')) as RateState;
    expect((reduce(predicted, run) as RateState).runs).toBe(1);
    const free = rate({ racers: SAME_SPEED });
    const first = reduce(free, run) as RateState;
    expect(first.runs).toBe(1);
    expect((reduce(first, run) as RateState).runs).toBe(2);
  });

  it('predict: 값을 다 넣은 뒤 한 번만, 모르는 값은 거절', () => {
    const blank = rate({ racers: BLANK });
    expect(reduce(blank, predict('a'))).toBe(blank);
    const full = rate({ racers: SAME_SPEED });
    expect(reduce(full, predict('zzz'))).toBe(full);
    const done = reduce(full, predict('same')) as RateState;
    expect(done.prediction).toBe('same');
    expect(reduce(done, predict('a'))).toBe(done);
  });

  it('reset: 값은 처음으로, 예측·실행 기록은 남긴다', () => {
    const state = rate({ racers: BLANK, predictFirst: true }, [
      setField('a', 'distance', 100),
      setField('a', 'time', 10),
      setField('b', 'distance', 50),
      setField('b', 'time', 5),
      predict('b'),
      run,
      { type: 'reset' },
    ]);
    expect(state.racers.map((r) => [r.distance, r.time])).toEqual([
      [null, null],
      [null, null],
    ]);
    expect(state.prediction).toBe('b');
    expect(state.runs).toBe(1);
    expect(reduce(state, { type: 'reset' })).toBe(state);
  });

  it('percent Action은 무시, JSON 왕복', () => {
    const state = rate({ racers: SAME_SPEED }, [predict('a'), run]);
    expect(reduce(state, { type: 'toggle', index: 3 })).toBe(state);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('rate observe', () => {
  it('속력 6과 5 → 토끼가 더 빠르다, 속력은 기약분수 문자열', () => {
    const o = obs(rate());
    expect(o['mode']).toBe('rate');
    expect(o['racers']).toEqual([
      { id: 'rabbit', distance: 120, time: 20, speed: '6' },
      { id: 'turtle', distance: 200, time: 40, speed: '5' },
    ]);
    expect(o['fastestId']).toBe('rabbit');
    expect(o['sameSpeed']).toBe(false);
    expect(o['ran']).toBe(false);
    expect(o['runs']).toBe(0);
    expect(o['predictionLocked']).toBe(false);
    expect(o['misconceptions']).toEqual([]);
  });

  it('분수 속력은 약분한다(거리 5·시간 20 → 1/4)', () => {
    const o = obs(rate({ racers: [racer('a', 5, 20), racer('b', 7, 2)] }));
    expect((o['racers'] as { speed: string }[])[0]?.speed).toBe('1/4');
    expect(o['fastestId']).toBe('b');
  });

  it('같은 속력(60·10 vs 120·20) → sameSpeed, fastestId null', () => {
    const o = obs(rate({ racers: SAME_SPEED }));
    expect(o['sameSpeed']).toBe(true);
    expect(o['fastestId']).toBeNull();
  });

  it('값이 비면 speed null, fastestId null, sameSpeed false', () => {
    const o = obs(rate({ racers: BLANK }));
    expect((o['racers'] as { speed: unknown }[]).every((r) => r.speed === null)).toBe(true);
    expect(o['fastestId']).toBeNull();
    expect(o['sameSpeed']).toBe(false);
  });

  it('예측·잠금·실행 횟수', () => {
    const o = obs(rate({}, [predict('rabbit'), run, run]));
    expect(o).toMatchObject({
      prediction: 'rabbit',
      predictionLocked: true,
      ran: true,
      runs: 2,
    });
  });

  it('MC-RATE-DISTANCE-ONLY: 거리가 더 긴 쪽(느린 쪽)을 예측하면 기록, 빠른 쪽이면 없음', () => {
    expect(obs(rate({}, [predict('turtle')]))['misconceptions']).toEqual(['MC-RATE-DISTANCE-ONLY']);
    expect(obs(rate({}, [predict('rabbit')]))['misconceptions']).toEqual([]);
    expect(obs(rate({}, [predict('same')]))['misconceptions']).toEqual([]);
  });

  it('MC-RATE-DISTANCE-ONLY: 같은 속력인데 거리가 더 긴 쪽을 예측하면 기록(더 빠르지 않다)', () => {
    expect(obs(rate({ racers: SAME_SPEED }, [predict('b')]))['misconceptions']).toEqual([
      'MC-RATE-DISTANCE-ONLY',
    ]);
  });

  it('MC-RATE-DISTANCE-ONLY: 시간만 긴 쪽을 예측해도 기록, 기록은 reset 뒤에도 남는다', () => {
    const racers = [racer('a', 20, 10), racer('b', 20, 5)];
    // a는 시간이 길고(10 > 5) 느리다(2 < 4)
    const state = rate({ racers }, [predict('a'), { type: 'reset' }]);
    expect(obs(state)['misconceptions']).toEqual(['MC-RATE-DISTANCE-ONLY']);
  });

  it('observe는 JSON 직렬화가 가능하다', () => {
    const o = obs(rate({}, [predict('rabbit'), run]));
    expect(JSON.parse(JSON.stringify(o))).toEqual(o);
  });
});

describe('rate predicates', () => {
  it('predictionIs·predictionCorrect', () => {
    const none = obs(rate());
    expect(hit('predictionIs', none, { value: 'rabbit' })).toBe(false);
    expect(hit('predictionCorrect', none)).toBe(false);
    const right = obs(rate({}, [predict('rabbit')]));
    expect(hit('predictionIs', right, { value: 'rabbit' })).toBe(true);
    expect(hit('predictionIs', right, { value: 'turtle' })).toBe(false);
    expect(hit('predictionCorrect', right)).toBe(true);
    expect(hit('predictionCorrect', obs(rate({}, [predict('turtle')])))).toBe(false);
    expect(hit('predictionCorrect', obs(rate({}, [predict('same')])))).toBe(false);
    const same = rate({ racers: SAME_SPEED }, [predict('same')]);
    expect(hit('predictionCorrect', obs(same))).toBe(true);
    expect(hit('predictionCorrect', obs(rate({ racers: SAME_SPEED }, [predict('a')])))).toBe(false);
  });

  it('ran·sameSpeed', () => {
    expect(hit('ran', obs(rate()))).toBe(false);
    expect(hit('ran', obs(rate({}, [predict('rabbit'), run])))).toBe(true);
    expect(hit('sameSpeed', obs(rate()))).toBe(false);
    expect(hit('sameSpeed', obs(rate({ racers: SAME_SPEED })))).toBe(true);
    expect(hit('sameSpeed', obs(rate({ racers: BLANK })))).toBe(false);
  });

  it('racerIs·racersDiffer', () => {
    const o = obs(rate({ racers: SAME_SPEED }));
    expect(hit('racerIs', o, { id: 'a', distance: 60, time: 10 })).toBe(true);
    expect(hit('racerIs', o, { id: 'a', distance: 60, time: 11 })).toBe(false);
    expect(hit('racerIs', o, { id: 'c', distance: 60, time: 10 })).toBe(false);
    expect(hit('racerIs', o, { id: 'a' })).toBe(false);
    expect(hit('racersDiffer', o)).toBe(true);
    const twin = obs(rate({ racers: [racer('a', 60, 10), racer('b', 60, 10)] }));
    expect(hit('racersDiffer', twin)).toBe(false);
    expect(hit('racersDiffer', obs(rate({ racers: BLANK })))).toBe(false);
  });

  it('hasMisconception', () => {
    const o = obs(rate({}, [predict('turtle')]));
    expect(hit('hasMisconception', o, { code: 'MC-RATE-DISTANCE-ONLY' })).toBe(true);
    expect(hit('hasMisconception', o, { code: 'MC-X' })).toBe(false);
  });
});

describe('percent 설정·reduce', () => {
  it('기본은 grid 0칸, 편집·개수 표시 켜짐', () => {
    const state = percent();
    expect(state.settings).toEqual({ layout: 'grid', editable: true, showCount: true });
    expect(state.cells).toEqual([]);
  });

  it('shaded 미리 칠함(앞에서부터)과 경계 0·100', () => {
    expect(percent({ shaded: 0 }).cells).toHaveLength(0);
    expect(percent({ shaded: 100 }).cells).toHaveLength(100);
    expect(percent({ shaded: 3 }).cells).toEqual([0, 1, 2]);
    for (const bad of [-1, 101, 1.5]) {
      expect(percent({ shaded: bad }).error).not.toBeNull();
    }
    expect(percent({ layout: 'x' as never }).error).not.toBeNull();
  });

  it('toggle: 켜고 끈다, 범위 밖은 거절', () => {
    const state = percent();
    const on = reduce(state, { type: 'toggle', index: 5 }) as PercentState;
    expect(on.cells).toEqual([5]);
    const two = reduce(on, { type: 'toggle', index: 2 }) as PercentState;
    expect(two.cells).toEqual([2, 5]);
    expect((reduce(two, { type: 'toggle', index: 5 }) as PercentState).cells).toEqual([2]);
    expect(reduce(state, { type: 'toggle', index: -1 })).toBe(state);
    expect(reduce(state, { type: 'toggle', index: 100 })).toBe(state);
    expect(reduce(state, { type: 'toggle', index: 0.5 })).toBe(state);
    expect((reduce(state, { type: 'toggle', index: 99 }) as PercentState).cells).toEqual([99]);
  });

  it('fill-to: 앞에서부터 count칸 (0·100 경계, 범위 밖 거절)', () => {
    const state = percent({ shaded: 10 });
    expect((reduce(state, { type: 'fill-to', count: 25 }) as PercentState).cells).toHaveLength(25);
    expect((reduce(state, { type: 'fill-to', count: 0 }) as PercentState).cells).toEqual([]);
    expect((reduce(state, { type: 'fill-to', count: 100 }) as PercentState).cells).toHaveLength(
      100,
    );
    expect(reduce(state, { type: 'fill-to', count: 101 })).toBe(state);
    expect(reduce(state, { type: 'fill-to', count: -1 })).toBe(state);
    expect(reduce(state, { type: 'fill-to', count: 10 })).toBe(state);
    // 흩어진 칸도 앞에서부터로 정리된다
    const scattered = percent({}, [
      { type: 'toggle', index: 50 },
      { type: 'toggle', index: 7 },
      { type: 'fill-to', count: 2 },
    ]);
    expect(scattered.cells).toEqual([0, 1]);
  });

  it('clear·reset', () => {
    const state = percent({ shaded: 4 }, [{ type: 'toggle', index: 40 }]);
    expect(state.cells).toHaveLength(5);
    const cleared = reduce(state, { type: 'clear' }) as PercentState;
    expect(cleared.cells).toEqual([]);
    expect(reduce(cleared, { type: 'clear' })).toBe(cleared);
    expect((reduce(state, { type: 'reset' }) as PercentState).cells).toEqual([0, 1, 2, 3]);
    const untouched = percent({ shaded: 4 });
    expect(reduce(untouched, { type: 'reset' })).toBe(untouched);
  });

  it('editable false면 칠하기·지우기를 거절한다', () => {
    const state = percent({ shaded: 5, editable: false });
    expect(reduce(state, { type: 'toggle', index: 9 })).toBe(state);
    expect(reduce(state, { type: 'fill-to', count: 1 })).toBe(state);
    expect(reduce(state, { type: 'clear' })).toBe(state);
  });

  it('JSON 왕복', () => {
    const state = percent({ shaded: 3 }, [{ type: 'toggle', index: 30 }]);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('percent observe·predicates', () => {
  it('25칸 → 분수 1/4, percent "25"', () => {
    const o = obs(percent({ shaded: 25 }));
    expect(o).toMatchObject({
      mode: 'percent',
      shaded: 25,
      percent: '25',
      fraction: '1/4',
      misconceptions: [],
    });
    expect((o['cells'] as number[]).length).toBe(25);
  });

  it('경계 0 → "0", 100 → "1", 1 → "1/100", 50 → "1/2"', () => {
    expect(obs(percent({ shaded: 0 }))['fraction']).toBe('0');
    expect(obs(percent({ shaded: 100 }))['fraction']).toBe('1');
    expect(obs(percent({ shaded: 1 }))['fraction']).toBe('1/100');
    expect(obs(percent({ shaded: 50 }))['fraction']).toBe('1/2');
  });

  it('shadedIs·fractionIs(표기 차이 무시)', () => {
    const o = obs(percent({ shaded: 25 }));
    expect(hit('shadedIs', o, { n: 25 })).toBe(true);
    expect(hit('shadedIs', o, { n: 24 })).toBe(false);
    expect(hit('shadedIs', o, {})).toBe(false);
    expect(hit('fractionIs', o, { value: '1/4' })).toBe(true);
    expect(hit('fractionIs', o, { value: '25/100' })).toBe(true);
    expect(hit('fractionIs', o, { value: '1/5' })).toBe(false);
    expect(hit('fractionIs', obs(percent({ shaded: 100 })), { value: '1' })).toBe(true);
    expect(hit('fractionIs', obs(percent({ shaded: 0 })), { value: '0' })).toBe(true);
    expect(hit('shadedIs', obs(rate()), { n: 0 })).toBe(false);
  });
});

describe('rate·percent emit', () => {
  it('상태가 바뀌면 ratio-changed', () => {
    const before = rate({ racers: SAME_SPEED });
    const after = reduce(before, run);
    expect(emit(before, after, run)[0]).toEqual({
      name: 'ratio-changed',
      payload: { ran: true },
    });
    const empty = percent();
    const next = reduce(empty, { type: 'toggle', index: 1 });
    expect(emit(empty, next, { type: 'toggle', index: 1 })[0]?.payload).toEqual({ shaded: 1 });
    expect(emit(empty, empty, { type: 'clear' })).toEqual([]);
  });
});
