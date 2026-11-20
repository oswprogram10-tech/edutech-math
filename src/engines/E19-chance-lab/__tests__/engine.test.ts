import { describe, expect, it } from 'vitest';
import type { Observation } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import { emit, predicates } from '../events';
import definition from '../index';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type {
  ChanceAction,
  ChanceConfig,
  ChanceState,
  LevelingState,
  OutlierState,
  SeesawState,
} from '../types';

function play(config: ChanceConfig, actions: readonly ChanceAction[] = []): ChanceState {
  return actions.reduce<ChanceState>(reduce, createInitialState(config));
}

function leveling(config: object, actions: readonly ChanceAction[] = []): LevelingState {
  const state = play({ mode: 'leveling', ...config }, actions);
  if (state.mode !== 'leveling') throw new Error('leveling 아님');
  return state;
}

function seesaw(config: object, actions: readonly ChanceAction[] = []): SeesawState {
  const state = play({ mode: 'seesaw', ...config } as ChanceConfig, actions);
  if (state.mode !== 'seesaw') throw new Error('seesaw 아님');
  return state;
}

function outlier(config: object, actions: readonly ChanceAction[] = []): OutlierState {
  const state = play({ mode: 'outlier', ...config } as ChanceConfig, actions);
  if (state.mode !== 'outlier') throw new Error('outlier 아님');
  return state;
}

const errorOf = (mode: 'seesaw' | 'outlier', config: object): string | null =>
  createInitialState({ mode, ...config } as ChanceConfig).error;
const obs = (state: ChanceState): Observation => observe(state);
const move = (from: number, to: number): ChanceAction => ({ type: 'move', from, to });
const fulcrum = (value: string): ChanceAction => ({ type: 'set-fulcrum', value });
const setValue = (value: number): ChanceAction => ({ type: 'set-value', value });
const predict = (value: string): ChanceAction => ({ type: 'predict', value });
const reset: ChanceAction = { type: 'reset' };
const pred = (name: string, observation: Observation, args?: Record<string, unknown>): boolean => {
  const fn = predicates[name];
  if (!fn) throw new Error(`판정 ${name} 없음`);
  return fn(observation, args as never);
};

describe('정의', () => {
  it('id·모드·레이아웃·오버레이 이름', () => {
    expect(definition.id).toBe('E19');
    expect(definition.modes).toEqual([
      'leveling',
      'seesaw',
      'outlier',
      'words',
      'spinner',
      'simulate',
    ]);
    expect(definition.layout).toBe('fit');
    expect(Object.keys(definition.overlays ?? {}).sort()).toEqual([
      'after-streak',
      'arms',
      'level-try',
      'mean-pull',
      'small-batches',
      'sum-tower',
    ]);
  });

  it('config 없이도 샌드박스 기본 자료로 시작한다', () => {
    const state = createInitialState({} as ChanceConfig);
    expect(state.mode).toBe('leveling');
    expect(state.error).toBeNull();
    if (state.mode === 'leveling') expect(state.heights).toEqual([7, 4, 9, 3, 7]);
    const o = outlier({});
    expect(o.dragIndex).toBe(4);
    expect(o.requirePrediction).toBe(true);
  });
});

describe('leveling', () => {
  const data = [7, 4, 9, 3, 7];

  it('move는 맨 위 블록 하나를 옮긴다', () => {
    const state = leveling({ data }, [move(2, 1)]);
    expect(state.heights).toEqual([7, 5, 8, 3, 7]);
    expect(state.moves).toBe(1);
  });

  it('거절 셋: 빈 기둥, 가득 찬 기둥, 같은 기둥은 같은 객체를 돌려준다', () => {
    const empty = leveling({ data: [0, 4], maxHeight: 4 });
    expect(reduce(empty, move(0, 1))).toBe(empty);
    expect(reduce(empty, move(1, 1))).toBe(empty);
    const full = leveling({ data: [4, 2], maxHeight: 4 });
    expect(reduce(full, move(1, 0))).toBe(full);
    expect(reduce(full, move(0, 1))).not.toBe(full);
    expect(reduce(full, move(0, 9))).toBe(full);
    expect(reduce(full, move(-1, 0))).toBe(full);
  });

  it('maxHeight 기본값은 max(data)+2, 경계 높이까지 쌓을 수 있다', () => {
    const state = leveling({ data: [3, 5] });
    expect(state.maxHeight).toBe(7);
    const edge = leveling({ data: [3, 5], maxHeight: 6 }, [move(0, 1)]);
    expect(edge.heights).toEqual([2, 6]);
    expect(reduce(edge, move(0, 1))).toBe(edge);
  });

  it('고르게 되면 leveled·level, 평균은 Observation에만', () => {
    const partial = leveling({ data }, [move(2, 1), move(2, 1), move(2, 3), move(0, 3)]);
    expect(partial.heights).toEqual([6, 6, 6, 5, 7]);
    expect(obs(partial)).toMatchObject({ leveled: false, level: null, mean: '6', moves: 4 });
    const solved = leveling({ data }, [move(2, 1), move(2, 1), move(2, 3), move(0, 3), move(4, 3)]);
    expect(solved.heights).toEqual([6, 6, 6, 6, 6]);
    expect(obs(solved)).toMatchObject({ leveled: true, level: '6', mean: '6', moves: 5 });
    expect(Object.keys(solved)).not.toContain('mean');
  });

  it('합이 자료 수로 나누어떨어지지 않으면 설정 오류', () => {
    expect(leveling({ data: [1, 2] }).error).not.toBeNull();
    expect(leveling({ data: [7, 4, 9, 3, 6] }).error).not.toBeNull();
    expect(reduce(leveling({ data: [1, 2] }), move(0, 1))).toEqual(leveling({ data: [1, 2] }));
  });

  it('자료 수·값·maxHeight 범위를 검사한다', () => {
    expect(leveling({ data: [3] }).error).not.toBeNull();
    expect(leveling({ data: Array.from({ length: 9 }, () => 2) }).error).not.toBeNull();
    expect(leveling({ data: [2, -2] }).error).not.toBeNull();
    expect(leveling({ data: [2, 2.5] }).error).not.toBeNull();
    expect(leveling({ data: [2, 4], maxHeight: 3 }).error).not.toBeNull();
    expect(leveling({ data: [2, 4], names: ['가'] }).error).not.toBeNull();
    expect(leveling({ data: [2, 4], names: ['가', '나'] }).names).toEqual(['가', '나']);
    expect(leveling({ data: [2, 4] }).names).toEqual(['1번', '2번']);
  });

  it('경계: 값 0이 있는 자료, 자료 2개', () => {
    const state = leveling({ data: [0, 6] }, [move(1, 0), move(1, 0), move(1, 0)]);
    expect(state.heights).toEqual([3, 3]);
    expect(obs(state)['level']).toBe('3');
    const zero = leveling({ data: [0, 0] });
    expect(obs(zero)).toMatchObject({ leveled: true, level: '0', mean: '0' });
  });

  it('reset은 처음 자료로 돌리고, 이미 처음이면 같은 객체', () => {
    const initial = leveling({ data });
    expect(reduce(initial, reset)).toBe(initial);
    const moved = reduce(initial, move(2, 1));
    expect(reduce(moved, reset)).toEqual(initial);
  });

  it('predicates: leveled · levelIs · movesAtMost', () => {
    const solved = obs(leveling({ data: [2, 4] }, [move(1, 0)]));
    expect(pred('leveled', solved)).toBe(true);
    expect(pred('levelIs', solved, { value: 3 })).toBe(true);
    expect(pred('levelIs', solved, { value: '6/2' })).toBe(true);
    expect(pred('levelIs', solved, { value: 4 })).toBe(false);
    expect(pred('movesAtMost', solved, { n: 1 })).toBe(true);
    expect(pred('movesAtMost', solved, { n: 0 })).toBe(false);
    const before = obs(leveling({ data: [2, 4] }));
    expect(pred('leveled', before)).toBe(false);
    expect(pred('levelIs', before, { value: 3 })).toBe(false);
  });

  it('JSON 왕복이 같다', () => {
    const state = leveling({ data }, [move(2, 1)]);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(JSON.parse(JSON.stringify(obs(state)))).toEqual(obs(state));
  });
});

describe('seesaw', () => {
  const data = [7, 4, 9, 3, 7];

  it('범위 기본값은 최소−1 ~ 최대+1, 받침점은 min에서 시작한다', () => {
    const state = seesaw({ data });
    expect([state.min, state.max, state.fulcrum, state.step]).toEqual([2, 10, '2', '1']);
  });

  it('받침점 5.5·6·7의 기울기', () => {
    const half = seesaw({ data, step: '1/2' }, [fulcrum('11/2')]);
    expect(obs(half)).toMatchObject({ fulcrum: '11/2', balanced: false, tilt: 'right', mean: '6' });
    const six = seesaw({ data }, [fulcrum('6')]);
    expect(obs(six)).toMatchObject({ fulcrum: '6', balanced: true, tilt: 'level', moves: 1 });
    const seven = seesaw({ data }, [fulcrum('7')]);
    expect(obs(seven)).toMatchObject({ tilt: 'left', balanced: false });
  });

  it('받침점이 평균과 다르면 시작부터 오른쪽으로 기운다(받침점이 왼쪽 끝)', () => {
    expect(obs(seesaw({ data }))['tilt']).toBe('right');
  });

  it('범위 밖·step 밖·모르는 글은 거절(같은 객체)', () => {
    const state = seesaw({ data, step: '1/2' });
    expect(reduce(state, fulcrum('1'))).toBe(state);
    expect(reduce(state, fulcrum('11'))).toBe(state);
    expect(reduce(state, fulcrum('5.3'))).toBe(state);
    expect(reduce(state, fulcrum('abc'))).toBe(state);
    expect(reduce(state, fulcrum('2'))).toBe(state); // 이미 그 자리
    expect(reduce(state, fulcrum('5.5'))).not.toBe(state);
    expect(observe(reduce(state, fulcrum('11/2')))['fulcrum']).toBe('11/2');
  });

  it('step이 맞지 않으면 설정 오류', () => {
    expect(errorOf('seesaw', { data, step: '0' })).not.toBeNull();
    expect(errorOf('seesaw', { data, step: '-1' })).not.toBeNull();
    expect(errorOf('seesaw', { data, step: '3' })).not.toBeNull();
    expect(errorOf('seesaw', { data, min: 5 })).not.toBeNull();
    expect(errorOf('seesaw', { data, max: 8 })).not.toBeNull();
    expect(errorOf('seesaw', { data, step: '1/2' })).toBeNull();
  });

  it('경계: 자료 2개·값 0, 평균이 격자 밖이면 수평이 없다', () => {
    const two = seesaw({ data: [0, 1], step: '1/2' });
    expect([two.min, two.max]).toEqual([-1, 2]);
    expect(obs(reduce(two, fulcrum('1/2')))).toMatchObject({ balanced: true, mean: '1/2' });
    const stuck = seesaw({ data: [0, 1] }, [fulcrum('0')]);
    expect(obs(stuck)['balanced']).toBe(false);
  });

  it('reset은 min으로 돌리고 횟수를 지운다', () => {
    const state = seesaw({ data }, [fulcrum('6')]);
    const back = reduce(state, reset);
    expect(back).toMatchObject({ fulcrum: '2', moves: 0 });
    expect(reduce(back, reset)).toBe(back);
  });

  it('predicates: balanced · fulcrumIs, JSON 왕복', () => {
    const state = seesaw({ data, step: '1/2' }, [fulcrum('6')]);
    const o = obs(state);
    expect(pred('balanced', o)).toBe(true);
    expect(pred('fulcrumIs', o, { value: 6 })).toBe(true);
    expect(pred('fulcrumIs', o, { value: '12/2' })).toBe(true);
    expect(pred('fulcrumIs', o, { value: '11/2' })).toBe(false);
    expect(pred('meanIs', o, { value: 6 })).toBe(true);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('outlier', () => {
  const data = [7, 4, 9, 3, 7];
  const base = { data, dragIndex: 4 };

  it('30으로 끌면 mean 53/5, meanShift 23/5', () => {
    const state = outlier(base, [setValue(30)]);
    expect(obs(state)).toMatchObject({
      values: [7, 4, 9, 3, 30],
      mean: '53/5',
      initialMean: '6',
      meanShift: '23/5',
      dragged: true,
      prediction: null,
      predictionLocked: false,
    });
  });

  it('max 기본값은 max(data)×4이고 범위 밖·같은 값·소수는 거절', () => {
    const state = outlier(base);
    expect([state.min, state.max]).toEqual([0, 36]);
    expect(reduce(state, setValue(37))).toBe(state);
    expect(reduce(state, setValue(-1))).toBe(state);
    expect(reduce(state, setValue(7))).toBe(state);
    expect(reduce(state, setValue(2.5))).toBe(state);
    expect(observe(reduce(state, setValue(36)))['dragged']).toBe(true);
    expect(reduce(state, setValue(0))).not.toBe(state);
  });

  it('예측 잠금: 예측 전에는 끌기를 거절하고, 예측은 한 번만', () => {
    const state = outlier({ ...base, predict: true });
    expect(reduce(state, setValue(30))).toBe(state);
    const locked = reduce(state, predict('10.6'));
    expect(locked.mode === 'outlier' && locked.prediction).toBe('53/5');
    expect(reduce(locked, predict('3'))).toBe(locked);
    const moved = reduce(locked, setValue(30));
    expect(obs(moved)).toMatchObject({ prediction: '53/5', predictionLocked: true, dragged: true });
  });

  it('예측 값 검사: 모르는 글·범위 밖은 거절, 대분수·분수·소수 모두 받는다', () => {
    const state = outlier({ ...base, predict: true });
    expect(reduce(state, predict('abc'))).toBe(state);
    expect(reduce(state, predict(''))).toBe(state);
    expect(reduce(state, predict('1/0'))).toBe(state);
    expect(reduce(state, predict('37'))).toBe(state);
    expect(reduce(state, predict('-1'))).toBe(state);
    for (const text of ['10.6', '53/5', '10 3/5', ' 53/5 ']) {
      const locked = reduce(state, predict(text));
      expect(locked.mode === 'outlier' && locked.prediction).toBe('53/5');
    }
    // predict가 꺼진 설정은 예측을 받지 않는다.
    const free = outlier(base);
    expect(reduce(free, predict('3'))).toBe(free);
  });

  it('predicate predictionIs는 Rational 비교: "10.6" = "53/5"', () => {
    const state = outlier({ ...base, predict: true }, [predict('53/5'), setValue(30)]);
    const o = obs(state);
    expect(pred('predictionIs', o, { value: '10.6' })).toBe(true);
    expect(pred('predictionIs', o, { value: '53/5' })).toBe(true);
    expect(pred('predictionIs', o, { value: 10 })).toBe(false);
    expect(pred('predictionLocked', o)).toBe(true);
    expect(pred('meanIs', o, { value: '10.6' })).toBe(true);
    expect(pred('meanIs', o, { value: 6 })).toBe(false);
    expect(pred('dragged', o)).toBe(true);
    expect(pred('valueAt', o, { index: 4, value: 30 })).toBe(true);
    expect(pred('valueAt', o, { index: 4, value: 7 })).toBe(false);
    expect(pred('valueAt', o, { index: 9, value: 7 })).toBe(false);
    expect(pred('predictionIs', obs(outlier(base)), { value: 6 })).toBe(false);
  });

  it('reset은 값을 되돌리지만 잠근 예측은 남긴다', () => {
    const state = outlier({ ...base, predict: true }, [predict('6'), setValue(30)]);
    const back = reduce(state, reset);
    expect(back).toMatchObject({ values: data, dragged: false, prediction: '6' });
    expect(reduce(back, reset)).toBe(back);
  });

  it('설정 오류: dragIndex 없음·범위 밖, 자료 밖 min·max', () => {
    expect(errorOf('outlier', { data })).not.toBeNull();
    expect(errorOf('outlier', { data, dragIndex: 5 })).not.toBeNull();
    expect(errorOf('outlier', { data, dragIndex: -1 })).not.toBeNull();
    expect(errorOf('outlier', { ...base, max: 8 })).not.toBeNull();
    expect(errorOf('outlier', { ...base, min: 5 })).not.toBeNull();
    expect(errorOf('outlier', { ...base, predict: 'yes' })).not.toBeNull();
    expect(errorOf('outlier', { ...base, max: 20, min: 2 })).toBeNull();
  });

  it('경계: 값이 모두 0이어도 끌 범위가 있고, 자료 2개', () => {
    const zero = outlier({ data: [0, 0], dragIndex: 1 });
    expect(zero.max).toBe(1);
    expect(obs(reduce(zero, setValue(1)))).toMatchObject({ mean: '1/2', meanShift: '1/2' });
    expect(obs(outlier({ data: [3, 4], dragIndex: 0 }, [setValue(0)]))).toMatchObject({
      mean: '2',
      meanShift: '-3/2',
    });
  });

  it('JSON 왕복과 mean 합계 검산', () => {
    const state = outlier({ ...base, predict: true }, [predict('6'), setValue(30)]);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(Rational.parse(String(obs(state)['mean'])).equals(Rational.of(53, 5))).toBe(true);
  });
});

describe('공통', () => {
  it('설정 오류 상태는 Action을 받지 않고 observe가 error를 알린다', () => {
    const bad = createInitialState({ mode: 'leveling', data: [1, 2] });
    expect(reduce(bad, move(0, 1))).toBe(bad);
    expect(observe(bad)).toMatchObject({ error: expect.any(String) });
  });

  it('다른 모드의 Action은 무시한다', () => {
    const l = leveling({ data: [2, 4] });
    expect(reduce(l, fulcrum('1'))).toBe(l);
    const s = seesaw({ data: [2, 4] });
    expect(reduce(s, move(0, 1))).toBe(s);
    const o = outlier({ data: [2, 4], dragIndex: 0 });
    expect(reduce(o, move(0, 1))).toBe(o);
  });

  it('emit: 바뀔 때만 이벤트를 내고 평균 값은 싣지 않는다', () => {
    const a = leveling({ data: [2, 4] });
    const b = reduce(a, move(1, 0));
    expect(emit(a, a, move(1, 1))).toEqual([]);
    expect(emit(a, b, move(1, 0))).toEqual([
      { name: 'chance-changed', payload: { leveled: true } },
    ]);
    for (const event of emit(a, b, move(1, 0))) {
      expect(definition.events).toContain(event.name);
      expect(JSON.stringify(event)).not.toContain('mean');
    }
    const s = seesaw({ data: [2, 4] });
    expect(emit(s, reduce(s, fulcrum('1')), fulcrum('1'))).toEqual([]);
    expect(emit(s, reduce(s, fulcrum('3')), fulcrum('3'))[0]?.payload).toEqual({ tilt: 'level' });
    const o = outlier({ data: [2, 4], dragIndex: 0, predict: false });
    expect(emit(o, reduce(o, setValue(3)), setValue(3))[0]?.payload).toEqual({ dragged: true });
  });
});
