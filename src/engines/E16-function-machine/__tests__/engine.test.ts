/** E16 reduce·observe·events·predicates·scenes 단위 테스트. */
import { describe, expect, it, vi } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { Observation } from '../../../core/engine-sdk';
import { Rational, solveBox } from '../../../core/math';
import definition from '../index';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import { hiddenOf } from '../relation-check';
import { SCENE_RULES } from '../settings';
import { sceneParts } from '../scenes';
import type {
  BlackBoxState,
  CovaryState,
  FunctionAction,
  FunctionConfig,
  FunctionState,
} from '../types';

function apply(config: FunctionConfig, actions: readonly FunctionAction[]): FunctionState {
  return actions.reduce<FunctionState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

function digits(text: string, target: 'input' | 'rule' = 'input'): FunctionAction[] {
  return [...text].map((key): FunctionAction => ({ type: 'type', target, key }));
}

function insert(x: string): FunctionAction[] {
  return [...digits(x), { type: 'insert-input' }];
}

function rule(text: string): FunctionAction[] {
  return [{ type: 'clear', target: 'rule' }, ...digits(text, 'rule'), { type: 'test-rule' }];
}

const X3: FunctionConfig = { mode: 'black-box', rule: '□ = ○ × 3' };

function bb(state: FunctionState): BlackBoxState {
  if (state.mode !== 'black-box') throw new Error('black-box 상태가 아니다');
  return state;
}

function cv(state: FunctionState): CovaryState {
  if (state.mode !== 'covary') throw new Error('covary 상태가 아니다');
  return state;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

describe('엔진 정의', () => {
  it('ID·이름·모드', () => {
    expect(definition.id).toBe('E16');
    expect(definition.name).toBe('대응 관계');
    expect(definition.modes).toEqual(['black-box', 'table', 'covary']);
    expect(Object.keys(definition.overlays ?? {}).sort()).toEqual([
      'diff-arrows',
      'fail-cols',
      'long-chain',
      'swap-check',
    ]);
  });
});

describe('black-box reduce', () => {
  it('수를 넣으면 표에 열이 쌓이고 y는 Rational 문자열이다', () => {
    const state = bb(apply(X3, [...insert('1'), ...insert('2'), ...insert('5')]));
    expect(state.trials).toEqual([
      ['1', '3'],
      ['2', '6'],
      ['5', '15'],
    ]);
    expect(state.draft).toBe('');
  });

  it('같은 ○를 다시 넣으면 열을 더하지 않고 강조만 한다', () => {
    const state = bb(apply(X3, [...insert('4'), ...insert('7'), ...insert('4')]));
    expect(state.trials).toHaveLength(2);
    expect(state.lastX).toBe('4');
  });

  it('범위 밖 수는 막고 notice를 남기며 draft는 지켜진다', () => {
    const state = bb(apply({ ...X3, inputRange: [0, 20] } as FunctionConfig, insert('21')));
    expect(state.trials).toEqual([]);
    expect(state.notice).toBe('range');
    expect(state.draft).toBe('21');
    expect(bb(reduce(state, { type: 'backspace', target: 'input' })).notice).toBeNull();
  });

  it('경계: 범위의 끝 수는 넣을 수 있다', () => {
    const state = bb(
      apply({ ...X3, inputRange: [0, 20] } as FunctionConfig, [...insert('20'), ...insert('0')]),
    );
    expect(state.trials).toEqual([
      ['20', '60'],
      ['0', '0'],
    ]);
  });

  it('maxTrials에 이르면 새 ○를 막는다(이미 넣은 ○는 허용)', () => {
    const config = { ...X3, maxTrials: 2 } as FunctionConfig;
    let state = bb(apply(config, [...insert('1'), ...insert('2'), ...insert('3')]));
    expect(state.trials).toHaveLength(2);
    expect(state.notice).toBe('limit');
    state = bb(reduce(state, { type: 'clear', target: 'input' }));
    state = bb(apply2(state, insert('1')));
    expect(state.trials).toHaveLength(2);
    expect(state.notice).toBeNull();
  });

  it('결과가 정수가 아니면 분수로 쌓이고, 0으로 나누는 수는 막는다', () => {
    const half = bb(apply({ mode: 'black-box', rule: '□ = ○ ÷ 2' }, insert('1')));
    expect(half.trials).toEqual([['1', '1/2']]);
    const zero = bb(apply({ mode: 'black-box', rule: '□ = 6 ÷ ○' }, insert('0')));
    expect(zero.trials).toEqual([]);
    expect(zero.notice).toBe('no-output');
  });

  it('draft는 3자리까지, 맨 앞 0 뒤 숫자는 0을 바꾼다', () => {
    expect(bb(apply(X3, digits('12345'))).draft).toBe('123');
    expect(bb(apply(X3, digits('05'))).draft).toBe('5');
  });

  it('식 칸에는 허용한 기호만 들어간다', () => {
    const state = apply(X3, digits('□=○*3a-', 'rule'));
    expect(state.ruleText).toBe('□=○×3−');
  });

  it('ruleInput이 false면 식 입력을 받지 않는다', () => {
    const state = apply({ ...X3, ruleInput: false } as FunctionConfig, rule('□ = ○ × 3'));
    expect(state.ruleText).toBe('');
    expect(state.tested).toBeNull();
  });

  it('빈 식은 시험하지 않고, 읽히지 않는 식은 자리와 함께 기록한다', () => {
    expect(apply(X3, [{ type: 'test-rule' }]).tested).toBeNull();
    const bad = apply(X3, rule('□ = ○ ×'));
    expect(bad.tested?.ok).toBe(false);
    expect(bad.tested?.errorAt).toBe(4);
    expect(bad.ruleHistory).toEqual([]);
  });

  it('ruleHistory는 읽힌 식만 formatRelation으로 최근 10개', () => {
    const actions: FunctionAction[] = [];
    for (let n = 1; n <= 12; n += 1) actions.push(...rule(`□ = ○ + ${n}`));
    const state = apply(X3, actions);
    expect(state.ruleHistory).toHaveLength(10);
    expect(state.ruleHistory[9]).toBe('□ = ○ + 12');
    expect(state.ruleHistory[0]).toBe('□ = ○ + 3');
  });
});

function apply2(state: FunctionState, actions: readonly FunctionAction[]): FunctionState {
  return actions.reduce<FunctionState>((s, a) => reduce(s, a), state);
}

describe('table reduce', () => {
  const config: FunctionConfig = {
    mode: 'table',
    rule: '□ = ○ × 3',
    rows: [
      { x: '1', y: '3' },
      { x: '2', y: null },
      { x: null, y: '12' },
    ],
  };

  it('빈칸만 활성화되고 주어진 칸은 무시한다', () => {
    const start = createInitialState(config);
    expect(reduce(start, { type: 'activate', cell: '0.x' })).toBe(start);
    const active = reduce(start, { type: 'activate', cell: '1.y' });
    expect(active.mode === 'table' && active.active).toBe('1.y');
  });

  it('활성 칸이 없으면 수를 받지 않는다', () => {
    const start = createInitialState(config);
    expect(reduce(start, { type: 'type', target: 'input', key: '6' })).toBe(start);
  });

  it('빈칸에 쓴 수는 cells에 문자열로 남고, 지우면 사라진다', () => {
    let state = apply(config, [{ type: 'activate', cell: '1.y' }, ...digits('6')]);
    expect(state.mode === 'table' && state.cells).toEqual({ '1.y': '6' });
    state = reduce(state, { type: 'backspace', target: 'input' });
    expect(state.mode === 'table' && state.cells).toEqual({});
  });

  it('잘못된 설정은 error를 켜고 throw하지 않는다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const bad of [
      { mode: 'table', rule: '□ + ○ = 4' },
      { mode: 'table', rule: 'abc' },
      { mode: 'table', rows: [{ x: null, y: null }] },
      { mode: 'table', rows: [{ x: 'abc', y: null }] },
    ] as FunctionConfig[]) {
      expect(createInitialState(bad).settings.error).not.toBeNull();
    }
    warn.mockRestore();
  });

  it('rule을 쓰지 않으면 기본 규칙과 기본 표가 정해진다', () => {
    const state = createInitialState({ mode: 'table' });
    expect(state.settings.error).toBeNull();
    const obs = observe(state);
    expect(obs.cellsCorrect).toBe(false);
  });
});

describe('covary reduce', () => {
  const config: FunctionConfig = {
    mode: 'covary',
    scene: 'chairs-legs',
    x: { min: 1, max: 10 },
    blankRows: [5],
  };

  it('처음에는 min 열 하나다', () => {
    const state = cv(createInitialState(config));
    expect(state.x).toBe('1');
    expect(state.visited).toEqual(['1']);
  });

  it('지나온 ○는 오름차순으로 한 번씩 쌓인다', () => {
    const state = cv(
      apply(config, [
        { type: 'set-x', x: '7' },
        { type: 'set-x', x: '3' },
        { type: 'set-x', x: '7' },
        { type: 'set-x', x: '5' },
      ]),
    );
    expect(state.visited).toEqual(['1', '3', '5', '7']);
    expect(state.x).toBe('5');
  });

  it('범위 밖은 끝으로 맞추고 정수가 아닌 값은 무시한다', () => {
    expect(cv(apply(config, [{ type: 'set-x', x: '99' }])).x).toBe('10');
    const start = createInitialState(config);
    expect(reduce(start, { type: 'set-x', x: '2.5' })).toBe(start);
    expect(reduce(start, { type: 'set-x', x: 'abc' })).toBe(start);
  });

  it('빈칸 줄에 이르면 그 칸이 활성화된다', () => {
    const state = cv(apply(config, [{ type: 'set-x', x: '5' }]));
    expect(state.active).toBe('5.y');
  });
});

describe('직렬화와 순수성', () => {
  const configs: FunctionConfig[] = [
    X3,
    { mode: 'table' },
    { mode: 'covary', scene: 'triangles-sticks', blankRows: [3] },
  ];

  it('모든 모드의 상태가 직렬화되고 JSON 왕복이 같다', () => {
    for (const config of configs) {
      let state = createInitialState(config);
      assertSerializable(state);
      state = apply2(state, [...insert('3'), ...rule('□ = ○ × 3'), { type: 'set-x', x: '3' }]);
      assertSerializable(state);
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
      assertSerializable(observe(state));
    }
  });

  it('reduce는 입력 상태를 바꾸지 않는다', () => {
    const base = deepFreeze(createInitialState(X3));
    const actions: FunctionAction[] = [
      ...insert('3'),
      ...rule('□ = ○ + 1'),
      { type: 'focus', target: 'rule' },
      { type: 'backspace', target: 'rule' },
    ];
    let state: FunctionState = base;
    for (const action of actions) state = deepFreeze(reduce(state, action));
    expect(base.mode === 'black-box' && base.trials).toEqual([]);
  });

  it('바뀌는 것이 없으면 같은 객체를 돌려준다', () => {
    const start = createInitialState(X3);
    expect(reduce(start, { type: 'insert-input' })).toBe(start);
    expect(reduce(start, { type: 'backspace', target: 'input' })).toBe(start);
    expect(reduce(start, { type: 'type', target: 'input', key: 'x' })).toBe(start);
    expect(reduce(start, { type: 'activate', cell: '0.x' })).toBe(start);
    expect(reduce(start, { type: 'set-x', x: '2' })).toBe(start);
  });
});

describe('observe', () => {
  it('판정용 값은 있고 숨은 규칙 문자열은 없다', () => {
    const state = apply(X3, [...insert('1'), ...insert('2'), ...rule('□ = ○ × 3')]);
    const o = observe(state);
    expect(o).toMatchObject({
      mode: 'black-box',
      trialCount: 2,
      holdsAll: true,
      matchesHidden: true,
      ruleValid: true,
      ruleFormatted: '□ = ○ × 3',
    });
    expect(JSON.stringify(o)).not.toContain('"rule"');
    expect(Object.keys(o)).not.toContain('hidden');
  });

  it('table·covary에는 cellsComplete·cellsCorrect, covary에는 x·visited', () => {
    const o = observe(createInitialState({ mode: 'covary', blankRows: [3] }));
    expect(o).toMatchObject({ cellsComplete: false, cellsCorrect: false, x: '1', visited: ['1'] });
  });
});

describe('events', () => {
  it('trial-added는 새 열이 생길 때만, rule-tested는 시험할 때, x-changed는 슬라이더', () => {
    const s0 = createInitialState(X3);
    const s1 = apply2(s0, digits('3'));
    const s2 = reduce(s1, { type: 'insert-input' });
    expect(emit(s1, s2, { type: 'insert-input' })).toEqual([
      { name: 'trial-added', payload: { x: '3', y: '9' } },
    ]);
    const typed = apply2(s2, digits('□=○×3', 'rule'));
    const tested = reduce(typed, { type: 'test-rule' });
    expect(emit(typed, tested, { type: 'test-rule' })).toEqual([
      { name: 'rule-tested', payload: { valid: true, holdsAll: false } },
    ]);
    expect(emit(s0, s0, { type: 'insert-input' })).toEqual([]);

    const c0 = createInitialState({ mode: 'covary' });
    const c1 = reduce(c0, { type: 'set-x', x: '4' });
    expect(emit(c0, c1, { type: 'set-x', x: '4' })).toEqual([
      { name: 'x-changed', payload: { x: '4' } },
    ]);
  });

  it('cell-entered는 활성 칸에 쓸 때', () => {
    const config: FunctionConfig = { mode: 'table', rows: [{ x: '1', y: null }] };
    const s0 = reduce(createInitialState(config), { type: 'activate', cell: '0.y' });
    const s1 = reduce(s0, { type: 'type', target: 'input', key: '3' });
    expect(emit(s0, s1, { type: 'type', target: 'input', key: '3' })).toEqual([
      { name: 'cell-entered', payload: { cell: '0.y' } },
    ]);
  });

  it('emit이 내는 이름은 모두 events 목록에 있다', () => {
    expect(definition.events).toEqual(['trial-added', 'rule-tested', 'cell-entered', 'x-changed']);
  });
});

describe('predicates', () => {
  const three = [...insert('1'), ...insert('2'), ...insert('5')];
  const good: Observation = observe(apply(X3, [...three, ...rule('□ = ○ × 3')]));
  const wrong: Observation = observe(apply(X3, [...three, ...rule('□ = ○ + 2')]));
  const untested: Observation = observe(apply(X3, three));

  it('holdsAll', () => {
    expect(predicates.holdsAll?.(good, {})).toBe(true);
    expect(predicates.holdsAll?.(wrong, {})).toBe(false);
    expect(predicates.holdsAll?.(untested, {})).toBe(false);
    expect(predicates.holdsAll?.(good, { minPairs: 3 })).toBe(true);
    expect(predicates.holdsAll?.(good, { minPairs: 4 })).toBe(false);
    expect(predicates.holdsAll?.(good, { minPairs: 0 })).toBe(false);
    expect(predicates.holdsAll?.(good, { minPairs: 'a' })).toBe(false);
  });

  it('matchesHidden·ruleSolvedForBox', () => {
    expect(predicates.matchesHidden?.(good, undefined)).toBe(true);
    expect(predicates.matchesHidden?.(wrong, undefined)).toBe(false);
    expect(predicates.ruleSolvedForBox?.(good, undefined)).toBe(true);
    expect(predicates.ruleSolvedForBox?.(untested, undefined)).toBe(false);
    const swapped = observe(apply(X3, [...three, ...rule('○ = □ × 3')]));
    expect(predicates.ruleSolvedForBox?.(swapped, undefined)).toBe(false);
  });

  it('ruleFormDiffers: 같은 규칙이지만 쓴 모양이 다르다', () => {
    const other = observe(apply(X3, [...three, ...rule('○ × 3 = □')]));
    expect(predicates.ruleFormDiffers?.(other, { from: '□ = ○ × 3' })).toBe(true);
    expect(predicates.ruleFormDiffers?.(good, { from: '□ = ○ × 3' })).toBe(false);
    expect(predicates.ruleFormDiffers?.(wrong, { from: '□ = ○ × 3' })).toBe(false);
    expect(predicates.ruleFormDiffers?.(other, { from: 'zzz' })).toBe(false);
    expect(predicates.ruleFormDiffers?.(other, {})).toBe(false);
  });

  it('trialsAtMost', () => {
    expect(predicates.trialsAtMost?.(good, { n: 3 })).toBe(true);
    expect(predicates.trialsAtMost?.(good, { n: 2 })).toBe(false);
    expect(predicates.trialsAtMost?.(good, { n: 'x' })).toBe(false);
    expect(
      predicates.trialsAtMost?.(observe(createInitialState({ mode: 'table' })), { n: 3 }),
    ).toBe(false);
  });

  it('cellsCorrect·cellIs', () => {
    const config: FunctionConfig = { mode: 'table', rows: [{ x: '2', y: null }] };
    const wrongCells = observe(apply(config, [{ type: 'activate', cell: '0.y' }, ...digits('7')]));
    const rightCells = observe(apply(config, [{ type: 'activate', cell: '0.y' }, ...digits('6')]));
    expect(predicates.cellsCorrect?.(wrongCells, undefined)).toBe(false);
    expect(predicates.cellsCorrect?.(rightCells, undefined)).toBe(true);
    expect(predicates.cellIs?.(rightCells, { col: 0, which: 'y', value: '6' })).toBe(true);
    expect(predicates.cellIs?.(rightCells, { col: '0', which: 'y', value: '6' })).toBe(true);
    expect(predicates.cellIs?.(rightCells, { col: 0, which: 'y', value: '7' })).toBe(false);
    expect(predicates.cellIs?.(rightCells, { col: 0, which: 'x', value: '2' })).toBe(true);
    expect(predicates.cellIs?.(rightCells, { col: 5, which: 'y', value: '6' })).toBe(false);
    expect(predicates.cellIs?.(rightCells, { col: 0, which: 'z', value: '6' })).toBe(false);
    expect(predicates.cellIs?.(rightCells, { col: 0, which: 'y', value: 'abc' })).toBe(false);
  });

  it('hasMisconception', () => {
    expect(predicates.hasMisconception?.(wrong, { code: 'MC-PATTERN-ONE-PAIR' })).toBe(true);
    expect(predicates.hasMisconception?.(good, { code: 'MC-PATTERN-ONE-PAIR' })).toBe(false);
    expect(predicates.hasMisconception?.(wrong, {})).toBe(false);
  });
});

describe('장면과 규칙', () => {
  it('chairs-legs는 □ = ○ × 4, triangles-sticks는 □ = ○ × 2 + 1과 맞는다', () => {
    for (const scene of ['chairs-legs', 'triangles-sticks'] as const) {
      const rel = hiddenOf(SCENE_RULES[scene]);
      expect(rel).not.toBeNull();
      for (let x = 0; x <= 20; x += 1) {
        const y = rel === null ? null : solveBox(rel, Rational.of(x));
        expect(y?.equals(Rational.of(sceneParts(scene, x) ?? -1))).toBe(true);
      }
    }
    expect(SCENE_RULES['chairs-legs']).toBe('□ = ○ × 4');
    expect(SCENE_RULES['triangles-sticks']).toBe('□ = ○ × 2 + 1');
  });

  it('점 장면은 규칙에서 개수가 정해진다', () => {
    expect(sceneParts('dots', 3)).toBeNull();
  });
});
