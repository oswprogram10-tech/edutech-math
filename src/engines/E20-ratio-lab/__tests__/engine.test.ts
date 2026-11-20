import { describe, expect, it } from 'vitest';
import definition from '../index';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { Observation } from '../../../core/engine-sdk';
import type {
  MixConfig,
  MixState,
  RatioAction,
  RatioConfig,
  RatioState,
  ResizeConfig,
  ResizeState,
} from '../types';

function play(config: RatioConfig, actions: readonly RatioAction[]): RatioState {
  return actions.reduce<RatioState>(reduce, createInitialState(config));
}

function mixState(config: MixConfig, actions: readonly RatioAction[] = []): MixState {
  const state = play({ mode: 'mix', ...config }, actions);
  if (state.mode !== 'mix') throw new Error('mix 아님');
  return state;
}

function resizeState(
  config: Partial<ResizeConfig>,
  actions: readonly RatioAction[] = [],
): ResizeState {
  const state = play({ mode: 'resize', ...config }, actions);
  if (state.mode !== 'resize') throw new Error('resize 아님');
  return state;
}

const obs = (state: RatioState): Observation => observe(state, {});
const add = (ingredient: 'milk' | 'syrup', n = 1): RatioAction => ({ type: 'add', ingredient, n });
const remove = (ingredient: 'milk' | 'syrup', n = 1): RatioAction => ({
  type: 'remove',
  ingredient,
  n,
});
const repeat = (action: RatioAction, times: number): RatioAction[] =>
  Array.from({ length: times }, () => action);

/** 학생 컵을 milk:syrup으로 만든다. */
function cupOf(milk: number, syrup: number, extra: MixConfig = {}): MixState {
  return mixState(extra, [...repeat(add('milk'), milk), ...repeat(add('syrup'), syrup)]);
}

describe('정의', () => {
  it('id·모드·레이아웃·오버레이 일곱', () => {
    expect(definition.id).toBe('E20');
    expect(definition.modes).toEqual(['mix', 'resize', 'rate', 'percent']);
    expect(definition.layout).toBe('fit');
    expect(Object.keys(definition.overlays ?? {}).sort()).toEqual([
      'footprints',
      'growth-arrows',
      'ratio-grid',
      'same-time',
      'side-by-side',
      'tens-brackets',
      'unit-groups',
    ]);
  });
});

describe('mix reduce', () => {
  it('샌드박스 기본: 기준 4:1, 학생 컵 0:0, 최대 30', () => {
    const state = mixState({});
    expect(state.reference).toEqual({ milk: 4, syrup: 1 });
    expect(state.cup).toEqual({ milk: 0, syrup: 0 });
    expect(state.settings.maxEach).toBe(30);
    expect(state.settings.scaleFactors).toEqual([2, 3]);
    expect(state.error).toBeNull();
  });

  it('add·remove가 한 개씩 바꾸고 조작 횟수를 센다', () => {
    const state = mixState({}, [add('milk'), add('milk'), add('syrup'), remove('milk')]);
    expect(state.cup).toEqual({ milk: 1, syrup: 1 });
    expect(state.addOps).toBe(4);
  });

  it('0 아래로 빼기와 maxEach 넘게 넣기는 거절(같은 객체)', () => {
    const empty = mixState({});
    expect(reduce(empty, remove('milk'))).toBe(empty);
    const full = mixState({ make: { milk: 30, syrup: 0 } });
    expect(reduce(full, add('milk'))).toBe(full);
    expect(reduce(full, add('syrup')).mode).toBe('mix');
    const exact = mixState({ make: { maxEach: 3 } }, repeat(add('milk'), 3));
    expect(exact.cup.milk).toBe(3);
    expect(reduce(exact, add('milk'))).toBe(exact);
  });

  it('scale은 두 양에 모두 k를 곱한다', () => {
    const state = cupOf(4, 1);
    const scaled = reduce(state, { type: 'scale', k: 2 });
    expect(scaled).toMatchObject({ cup: { milk: 8, syrup: 2 }, scaleOps: 1 });
  });

  it('scale이 maxEach를 넘으면 거절, 빈 컵·k<2도 거절', () => {
    const big = mixState({ make: { milk: 16, syrup: 1 } });
    expect(reduce(big, { type: 'scale', k: 2 })).toBe(big);
    const edge = mixState({ make: { milk: 15, syrup: 1 } });
    expect(reduce(edge, { type: 'scale', k: 2 })).toMatchObject({ cup: { milk: 30, syrup: 2 } });
    const empty = mixState({});
    expect(reduce(empty, { type: 'scale', k: 2 })).toBe(empty);
    expect(reduce(edge, { type: 'scale', k: 1 })).toBe(edge);
    expect(reduce(edge, { type: 'scale', k: 2.5 })).toBe(edge);
  });

  it('reset은 시작값으로 돌리고 조작 횟수는 남긴다', () => {
    const state = mixState({ make: { milk: 2, syrup: 1 } }, [add('milk'), { type: 'scale', k: 2 }]);
    const back = reduce(state, { type: 'reset' });
    expect(back).toMatchObject({ cup: { milk: 2, syrup: 1 }, addOps: 1, scaleOps: 1 });
    expect(reduce(back, { type: 'reset' })).toBe(back);
  });

  it('학생 컵이 없으면(make:null) 조작은 모두 무시', () => {
    const state = mixState({ make: null });
    expect(state.settings.hasCup).toBe(false);
    expect(reduce(state, add('milk'))).toBe(state);
    expect(reduce(state, { type: 'scale', k: 2 })).toBe(state);
  });

  it('resize Action은 mix에서 무시', () => {
    const state = mixState({});
    expect(reduce(state, { type: 'save' })).toBe(state);
    expect(reduce(state, { type: 'step', dim: 'w', delta: 1 })).toBe(state);
  });

  it('상태는 JSON 왕복이 같다', () => {
    const state = cupOf(3, 2, { fixedCups: [{ id: 'a', label: '가', milk: 5, syrup: 2 }] });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('mix 설정 검사', () => {
  it.each<[string, MixConfig]>([
    ['음수 기준', { reference: { milk: -1, syrup: 1 } }],
    ['0:0 기준', { reference: { milk: 0, syrup: 0 } }],
    ['소수 기준', { reference: { milk: 1.5, syrup: 1 } }],
    ['시작값이 maxEach 초과', { make: { milk: 31 } }],
    ['maxEach 0', { make: { maxEach: 0 } }],
    [
      '고정 컵 4개',
      {
        fixedCups: Array.from({ length: 4 }, (_, i) => ({
          id: `c${i}`,
          label: 'x',
          milk: 1,
          syrup: 1,
        })),
      },
    ],
    [
      '고정 컵 id 중복',
      {
        fixedCups: [
          { id: 'a', label: 'x', milk: 1, syrup: 1 },
          { id: 'a', label: 'y', milk: 2, syrup: 1 },
        ],
      },
    ],
    ['고정 컵 0:0', { fixedCups: [{ id: 'a', label: 'x', milk: 0, syrup: 0 }] }],
    ['배수 1', { scaleFactors: [1] }],
  ])('%s → error', (_name, config) => {
    const state = mixState(config);
    expect(state.error).not.toBeNull();
    expect(reduce(state, add('milk'))).toBe(state);
  });

  it('reference:null이면 기준 컵 없음', () => {
    expect(mixState({ reference: null }).reference).toBeNull();
  });
});

describe('mix stripMax', () => {
  const fixed = [
    { id: 'a', label: '가', milk: 5, syrup: 2 },
    { id: 'b', label: '나', milk: 8, syrup: 3 },
  ];
  it('기준·고정 컵만으로 정한다: 4:1·5:2·8:3이면 0.5', () => {
    expect(mixState({ fixedCups: fixed }).settings.stripMax).toBe(0.5);
  });
  it('기준 4:1만이면 0.3, 기준 컵·고정 컵이 없으면 0.5', () => {
    expect(mixState({}).settings.stripMax).toBe(0.3);
    expect(mixState({ reference: null }).settings.stripMax).toBe(0.5);
  });
  it('학생 컵 값으로 움직이지 않는다', () => {
    expect(cupOf(1, 9).settings.stripMax).toBe(0.3);
  });
  it('0.2~1로 자른다', () => {
    expect(mixState({ reference: { milk: 9, syrup: 1 } }).settings.stripMax).toBe(0.2);
    expect(mixState({ reference: { milk: 0, syrup: 3 } }).settings.stripMax).toBe(1);
    expect(mixState({ reference: { milk: 1, syrup: 1 } }).settings.stripMax).toBe(0.8);
  });
  it('직접 주면 그대로, 0 이하·1 초과는 오류', () => {
    expect(mixState({ stripMax: 0.6 }).settings.stripMax).toBe(0.6);
    expect(mixState({ stripMax: 1 }).error).toBeNull();
    expect(mixState({ stripMax: 0 }).error).not.toBeNull();
    expect(mixState({ stripMax: 1.1 }).error).not.toBeNull();
  });
});

describe('mix observe', () => {
  it('8:2는 기준 4:1과 같다', () => {
    const o = obs(cupOf(8, 2));
    expect(o).toMatchObject({
      mode: 'mix',
      cup: { milk: 8, syrup: 2, value: '1/4' },
      referenceValue: '1/4',
      sameAsReference: true,
      misconceptions: [],
    });
  });

  it('5:2는 다르고 MC-RATIO-ADDITIVE', () => {
    const o = obs(cupOf(5, 2));
    expect(o['sameAsReference']).toBe(false);
    expect(o['misconceptions']).toEqual(['MC-RATIO-ADDITIVE']);
    expect(o['cup']).toMatchObject({ value: '2/5' });
  });

  it('우유 0이면 value null, 빈 컵도 null', () => {
    expect(obs(cupOf(0, 3))['cup']).toMatchObject({ milk: 0, syrup: 3, value: null });
    expect(obs(mixState({}))['cup']).toMatchObject({ value: null });
    expect(obs(mixState({}))['sameAsReference']).toBe(false);
  });

  it('시럽 0이면 value "0"', () => {
    expect(obs(cupOf(3, 0))['cup']).toMatchObject({ value: '0' });
  });

  it('더하기 오개념 경계: 기준 그대로(d=0)·d만큼 우유만·비가 같은 d는 기록 안 함', () => {
    expect(obs(cupOf(4, 1))['misconceptions']).toEqual([]);
    expect(obs(cupOf(5, 1))['misconceptions']).toEqual([]);
    // 기준 2:2(비 1)에 d=1을 더한 3:3은 비가 같아서 오개념이 아니다.
    const same = cupOf(3, 3, { reference: { milk: 2, syrup: 2 } });
    expect(obs(same)['sameAsReference']).toBe(true);
    expect(obs(same)['misconceptions']).toEqual([]);
    expect(obs(cupOf(6, 3))['misconceptions']).toEqual(['MC-RATIO-ADDITIVE']);
  });

  it('기준 컵이 없으면 오개념을 기록하지 않는다', () => {
    const o = obs(cupOf(5, 2, { reference: null }));
    expect(o['referenceValue']).toBeNull();
    expect(o['misconceptions']).toEqual([]);
  });

  it('고정 컵: 5:2 vs 8:3은 5:2가 더 진하다', () => {
    const fixed = [
      { id: 'a', label: '가', milk: 5, syrup: 2 },
      { id: 'b', label: '나', milk: 8, syrup: 3 },
    ];
    const o = obs(mixState({ fixedCups: fixed, make: null }));
    expect(o['darkestFixedId']).toBe('a');
    expect(o['fixed']).toEqual([
      { id: 'a', milk: 5, syrup: 2, value: '2/5' },
      { id: 'b', milk: 8, syrup: 3, value: '3/8' },
    ]);
  });

  it('고정 컵이 같은 진하기면 null, 하나뿐이어도 null', () => {
    const same = obs(
      mixState({
        fixedCups: [
          { id: 'a', label: '가', milk: 4, syrup: 1 },
          { id: 'b', label: '나', milk: 8, syrup: 2 },
        ],
      }),
    );
    expect(same['darkestFixedId']).toBeNull();
    const one = obs(mixState({ fixedCups: [{ id: 'a', label: '가', milk: 4, syrup: 1 }] }));
    expect(one['darkestFixedId']).toBeNull();
  });

  it('가장 진한 컵이 둘 이상 같으면 null, 셋 중 하나가 크면 그 컵', () => {
    const tie = obs(
      mixState({
        fixedCups: [
          { id: 'a', label: 'a', milk: 1, syrup: 1 },
          { id: 'b', label: 'b', milk: 2, syrup: 2 },
          { id: 'c', label: 'c', milk: 3, syrup: 1 },
        ],
      }),
    );
    expect(tie['darkestFixedId']).toBeNull();
    const win = obs(
      mixState({
        fixedCups: [
          { id: 'a', label: 'a', milk: 3, syrup: 1 },
          { id: 'b', label: 'b', milk: 1, syrup: 1 },
          { id: 'c', label: 'c', milk: 2, syrup: 1 },
        ],
      }),
    );
    expect(win['darkestFixedId']).toBe('b');
  });

  it('큰 수(99:33)도 기약분수로', () => {
    const state = mixState({ make: { milk: 99, syrup: 33, maxEach: 99 } });
    expect(obs(state)['cup']).toMatchObject({ value: '1/3' });
  });

  it('observe 결과는 JSON 직렬화 가능하고 목표 값을 담지 않는다', () => {
    const o = obs(cupOf(5, 2));
    expect(JSON.parse(JSON.stringify(o))).toEqual(o);
  });
});

describe('mix predicates', () => {
  const p = predicates;
  it('cupIs는 양까지 같아야 한다', () => {
    const o = obs(cupOf(8, 2));
    expect(p['cupIs']?.(o, { milk: 8, syrup: 2 })).toBe(true);
    expect(p['cupIs']?.(o, { milk: 4, syrup: 1 })).toBe(false);
    expect(p['cupIs']?.(o, { milk: 8 })).toBe(false);
    expect(p['cupIs']?.(o, undefined)).toBe(false);
  });
  it('sameAsReference·scaleUsed·cupValueIs', () => {
    const scaled = obs(reduce(cupOf(4, 1), { type: 'scale', k: 2 }));
    expect(p['sameAsReference']?.(scaled, undefined)).toBe(true);
    expect(p['scaleUsed']?.(scaled, undefined)).toBe(true);
    expect(p['scaleUsed']?.(obs(cupOf(8, 2)), undefined)).toBe(false);
    expect(p['cupValueIs']?.(scaled, { value: '1/4' })).toBe(true);
    expect(p['cupValueIs']?.(scaled, { value: '2/8' })).toBe(true);
    expect(p['cupValueIs']?.(scaled, { value: '1/5' })).toBe(false);
    expect(p['cupValueIs']?.(obs(cupOf(0, 2)), { value: '0' })).toBe(false);
    expect(p['cupValueIs']?.(scaled, { value: 'x' })).toBe(false);
  });
  it('hasMisconception', () => {
    const o = obs(cupOf(5, 2));
    expect(p['hasMisconception']?.(o, { code: 'MC-RATIO-ADDITIVE' })).toBe(true);
    expect(p['hasMisconception']?.(o, { code: 'MC-X' })).toBe(false);
    expect(p['hasMisconception']?.(obs(cupOf(8, 2)), { code: 'MC-RATIO-ADDITIVE' })).toBe(false);
  });
});

describe('resize reduce', () => {
  it('기본 base 4×3, max 24', () => {
    const state = resizeState({});
    expect(state).toMatchObject({ base: { w: 4, h: 3 }, size: { w: 4, h: 3 } });
    expect(state.settings).toMatchObject({ max: 24, addStep: 2, showVerdict: true });
  });

  it('step이 한 칸씩 바꾼다', () => {
    const state = resizeState({}, [
      { type: 'step', dim: 'w', delta: 1 },
      { type: 'step', dim: 'h', delta: -1 },
    ]);
    expect(state.size).toEqual({ w: 5, h: 2 });
  });

  it('1칸 미만·max 초과는 거절', () => {
    const small = resizeState({ base: { w: 1, h: 1 } });
    expect(reduce(small, { type: 'step', dim: 'w', delta: -1 })).toBe(small);
    expect(reduce(small, { type: 'step', dim: 'h', delta: -1 })).toBe(small);
    const big = resizeState({ base: { w: 24, h: 3 } });
    expect(reduce(big, { type: 'step', dim: 'w', delta: 1 })).toBe(big);
    expect(reduce(big, { type: 'add-both', n: 2 })).toBe(big);
    expect(reduce(big, { type: 'scale', k: 2 })).toBe(big);
  });

  it('add-both·scale', () => {
    const added = resizeState({}, [{ type: 'add-both', n: 2 }]);
    expect(added).toMatchObject({ size: { w: 6, h: 5 }, addOps: 1 });
    const scaled = resizeState({}, [{ type: 'scale', k: 2 }]);
    expect(scaled).toMatchObject({ size: { w: 8, h: 6 }, scaleOps: 1 });
    expect(resizeState({ max: 12 }, [{ type: 'scale', k: 3 }]).size).toEqual({ w: 12, h: 9 });
    const edge = resizeState({ max: 11 });
    expect(reduce(edge, { type: 'scale', k: 3 })).toBe(edge);
  });

  it('save는 같은 크기를 한 번만 담고 8개까지', () => {
    const once = resizeState({}, [{ type: 'save' }, { type: 'save' }]);
    expect(once.saved).toEqual([{ w: 4, h: 3 }]);
    let state = resizeState({});
    for (let i = 0; i < 10; i += 1) {
      state = reduce(state, { type: 'save' }) as ResizeState;
      state = reduce(state, { type: 'step', dim: 'w', delta: 1 }) as ResizeState;
    }
    expect(state.saved).toHaveLength(8);
  });

  it('reset은 크기만 처음으로 돌리고 담은 크기·횟수는 남긴다', () => {
    const state = resizeState({}, [{ type: 'scale', k: 2 }, { type: 'save' }]);
    const back = reduce(state, { type: 'reset' });
    expect(back).toMatchObject({ size: { w: 4, h: 3 }, saved: [{ w: 8, h: 6 }], scaleOps: 1 });
    expect(reduce(back, { type: 'reset' })).toBe(back);
  });

  it('mix Action은 resize에서 무시, JSON 왕복', () => {
    const state = resizeState({}, [{ type: 'scale', k: 2 }, { type: 'save' }]);
    expect(reduce(state, add('milk'))).toBe(state);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it.each<[string, Partial<ResizeConfig>]>([
    ['base 0', { base: { w: 0, h: 3 } }],
    ['base 소수', { base: { w: 2.5, h: 3 } }],
    ['base가 max 초과', { base: { w: 30, h: 3 } }],
    ['addStep 0', { addStep: 0 }],
    ['look 잘못', { look: 'x' as never }],
  ])('%s → error', (_name, config) => {
    expect(resizeState(config).error).not.toBeNull();
  });
});

describe('resize observe', () => {
  it('처음 상태: 찌그러지지 않음', () => {
    expect(obs(resizeState({}))).toMatchObject({
      mode: 'resize',
      size: { w: 4, h: 3 },
      base: { w: 4, h: 3 },
      sizeValue: '4/3',
      baseValue: '4/3',
      distorted: false,
      saved: [],
      savedEquivalentCount: 0,
      misconceptions: [],
    });
  });

  it('×2 → 8×6 동치', () => {
    const o = obs(resizeState({}, [{ type: 'scale', k: 2 }, { type: 'save' }]));
    expect(o).toMatchObject({
      size: { w: 8, h: 6 },
      distorted: false,
      saved: [{ w: 8, h: 6, equivalent: true }],
      savedEquivalentCount: 1,
      scaleOps: 1,
    });
  });

  it('+2 → 6×5 찌그러짐 + MC-RATIO-ADDITIVE(담았을 때)', () => {
    const before = obs(resizeState({}, [{ type: 'add-both', n: 2 }]));
    expect(before).toMatchObject({ size: { w: 6, h: 5 }, distorted: true, addOps: 1 });
    expect(before['misconceptions']).toEqual([]);
    const saved = obs(resizeState({}, [{ type: 'add-both', n: 2 }, { type: 'save' }]));
    expect(saved['misconceptions']).toEqual(['MC-RATIO-ADDITIVE']);
    expect(saved['saved']).toEqual([{ w: 6, h: 5, equivalent: false }]);
  });

  it('정사각형 base는 +d도 동치라 오개념이 아니다', () => {
    const o = obs(
      resizeState({ base: { w: 3, h: 3 } }, [{ type: 'add-both', n: 2 }, { type: 'save' }]),
    );
    expect(o['distorted']).toBe(false);
    expect(o['misconceptions']).toEqual([]);
  });

  it('처음 크기를 담으면 동치지만 개수에는 세지 않는다', () => {
    const o = obs(resizeState({}, [{ type: 'save' }]));
    expect(o['saved']).toEqual([{ w: 4, h: 3, equivalent: true }]);
    expect(o['savedEquivalentCount']).toBe(0);
  });

  it('동치가 아닌 다른 비율(5×3)', () => {
    const o = obs(resizeState({}, [{ type: 'step', dim: 'w', delta: 1 }, { type: 'save' }]));
    expect(o).toMatchObject({ distorted: true, sizeValue: '5/3' });
    expect(o['misconceptions']).toEqual([]);
  });

  it('1칸 크기(1×1 base)', () => {
    const o = obs(resizeState({ base: { w: 1, h: 1 } }, [{ type: 'scale', k: 3 }]));
    expect(o).toMatchObject({ size: { w: 3, h: 3 }, distorted: false, sizeValue: '1' });
  });
});

describe('resize predicates', () => {
  const p = predicates;
  const scaledSaved = (k: number) => [{ type: 'scale', k } as const, { type: 'save' } as const];
  it('savedEquivalentAtLeast', () => {
    const o = obs(resizeState({}, [...scaledSaved(2), ...scaledSaved(3)]));
    expect(o['savedEquivalentCount']).toBe(2);
    expect(p['savedEquivalentAtLeast']?.(o, { n: 2 })).toBe(true);
    expect(p['savedEquivalentAtLeast']?.(o, { n: 3 })).toBe(false);
    expect(p['savedEquivalentAtLeast']?.(o, {})).toBe(false);
  });
  it('allSavedEquivalent: 담은 것이 있고 모두 동치', () => {
    expect(p['allSavedEquivalent']?.(obs(resizeState({})), undefined)).toBe(false);
    expect(p['allSavedEquivalent']?.(obs(resizeState({}, scaledSaved(2))), undefined)).toBe(true);
    const mixed = resizeState({}, [
      ...scaledSaved(2),
      { type: 'step', dim: 'w', delta: 1 },
      { type: 'save' },
    ]);
    expect(p['allSavedEquivalent']?.(obs(mixed), undefined)).toBe(false);
  });
  it('sizeIs·distorted·hasMisconception', () => {
    const o = obs(resizeState({}, [{ type: 'add-both', n: 2 }, { type: 'save' }]));
    expect(p['sizeIs']?.(o, { w: 6, h: 5 })).toBe(true);
    expect(p['sizeIs']?.(o, { w: 6, h: 4 })).toBe(false);
    expect(p['sizeIs']?.(obs(cupOf(1, 1)), { w: 1, h: 1 })).toBe(false);
    expect(p['distorted']?.(o, undefined)).toBe(true);
    expect(p['distorted']?.(obs(resizeState({})), undefined)).toBe(false);
    expect(p['hasMisconception']?.(o, { code: 'MC-RATIO-ADDITIVE' })).toBe(true);
  });
});

describe('emit', () => {
  it('상태가 같으면 이벤트 없음, 바뀌면 ratio-changed', () => {
    const state = cupOf(1, 1);
    expect(emit(state, state, { type: 'reset' })).toEqual([]);
    const next = reduce(state, add('milk'));
    const events = emit(state, next, add('milk'));
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe('ratio-changed');
    expect(definition.events).toContain('ratio-changed');
    const resized = resizeState({});
    const moved = reduce(resized, { type: 'add-both', n: 2 });
    expect(emit(resized, moved, { type: 'add-both', n: 2 })[0]?.payload).toEqual({
      distorted: true,
    });
  });
});
