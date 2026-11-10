/**
 * E17 reduce·observe·events·predicates 단위 테스트.
 * 카드(T108) 결정 8~10의 판정과 경계 사례를 고정한다.
 */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { Observation } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type {
  AngleCondition,
  ConstraintToggle,
  HierarchyState,
  QuadName,
  SecretRuleState,
  SideCondition,
  SorterAction,
  SorterConfig,
  SorterState,
  VennState,
} from '../types';
import { ALL_QUESTIONS } from '../types';

function apply(config: SorterConfig, actions: readonly SorterAction[]): SorterState {
  return actions.reduce<SorterState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

function asVenn(state: SorterState): VennState {
  if (state.mode !== 'venn') throw new Error('venn 상태가 아니다');
  return state;
}

function asSecret(state: SorterState): SecretRuleState {
  if (state.mode !== 'secret-rule') throw new Error('secret-rule 상태가 아니다');
  return state;
}

function asHierarchy(state: SorterState): HierarchyState {
  if (state.mode !== 'hierarchy') throw new Error('hierarchy 상태가 아니다');
  return state;
}

function wrongCards(observation: Observation): string[] {
  const value = observation['wrongCards'];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function stringsOf(observation: Observation, key: string): string[] {
  const value = observation[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

const CORRECT: readonly (readonly [string, AngleCondition, SideCondition])[] = [
  ['t04', 'acute', 'equilateral'],
  ['t09', 'acute', 'equilateral'],
  ['t01', 'acute', 'isosceles-only'],
  ['t12', 'acute', 'isosceles-only'],
  ['t07', 'acute', 'scalene'],
  ['t03', 'right', 'isosceles-only'],
  ['t08', 'right', 'isosceles-only'],
  ['t05', 'right', 'scalene'],
  ['t11', 'right', 'scalene'],
  ['t06', 'obtuse', 'isosceles-only'],
  ['t10', 'obtuse', 'isosceles-only'],
  ['t02', 'obtuse', 'scalene'],
];

const CORRECT_ACTIONS: SorterAction[] = CORRECT.map(([card, row, col]) => ({
  type: 'place',
  card,
  cell: `${row}|${col}`,
}));

describe('E17 venn', () => {
  it('카드를 놓고 옮기고 카드 칸으로 돌려놓는다', () => {
    const state = asVenn(
      apply({ mode: 'venn' }, [
        { type: 'place', card: 't04', cell: 'acute|equilateral' },
        { type: 'place', card: 't04', cell: 'right|scalene' },
        { type: 'place', card: 't04', cell: null },
      ]),
    );
    expect(state.placements['t04']).toBeNull();
    expect(state.lastPlaced).toBeNull();
  });

  it('정답 배치면 allCorrect이고 wrongCards가 비어 있다', () => {
    const observation = observe(apply({ mode: 'venn' }, CORRECT_ACTIONS));
    expect(observation['placedCount']).toBe(12);
    expect(observation['allPlaced']).toBe(true);
    expect(observation['allCorrect']).toBe(true);
    expect(wrongCards(observation)).toEqual([]);
  });

  it('t10을 acute|isosceles-only에 두면 안 맞고 둔각 오개념이다', () => {
    const observation = observe(
      apply({ mode: 'venn' }, [{ type: 'place', card: 't10', cell: 'acute|isosceles-only' }]),
    );
    expect(wrongCards(observation)).toContain('t10');
    expect(stringsOf(observation, 'misconceptions')).toContain('MC-GEO-ACUTE-TRI-ONE-ANGLE');
  });

  it('t02를 acute|scalene에 두면 안 맞고 둔각 오개념이다', () => {
    const observation = observe(
      apply({ mode: 'venn' }, [{ type: 'place', card: 't02', cell: 'acute|scalene' }]),
    );
    expect(wrongCards(observation)).toContain('t02');
    expect(stringsOf(observation, 'misconceptions')).toContain('MC-GEO-ACUTE-TRI-ONE-ANGLE');
  });

  it('t12를 acute|scalene에 두면 방향 오개념이다', () => {
    const observation = observe(
      apply({ mode: 'venn' }, [{ type: 'place', card: 't12', cell: 'acute|scalene' }]),
    );
    expect(wrongCards(observation)).toContain('t12');
    expect(stringsOf(observation, 'misconceptions')).toEqual(['MC-GEO-TRI-ISOSCELES-ORIENT']);
  });

  it('check 뒤에 옮기면 그 카드의 checked 표시가 사라진다', () => {
    const state = asVenn(
      apply({ mode: 'venn' }, [
        { type: 'place', card: 't04', cell: 'acute|equilateral' },
        { type: 'check' },
        { type: 'place', card: 't04', cell: 'acute|isosceles-only' },
      ]),
    );
    expect(state.checks).toBe(1);
    expect(state.checked['t04']).toBeUndefined();
  });

  it('불가능한 칸 표시는 정렬되고 판정 집합과 정확히 같다', () => {
    const state = apply({ mode: 'venn' }, [
      { type: 'toggle-impossible', cell: 'right|equilateral' },
      { type: 'toggle-impossible', cell: 'obtuse|equilateral' },
    ]);
    const observation = observe(state);
    expect(stringsOf(observation, 'impossibleMarked')).toEqual([
      'obtuse|equilateral',
      'right|equilateral',
    ]);
    expect(
      predicates['impossibleMarkedAre']?.(observation, {
        cells: ['obtuse|equilateral', 'right|equilateral'],
      }),
    ).toBe(true);
    expect(predicates['impossibleMarkedAre']?.(observation, { cells: ['right|equilateral'] })).toBe(
      false,
    );
    expect(
      predicates['cardInCell']?.(observation, { card: 't04', cell: 'acute|equilateral' }),
    ).toBe(false);
  });

  it('cardInCell·allCardsCorrect 판정', () => {
    const partial = apply({ mode: 'venn' }, [
      { type: 'place', card: 't04', cell: 'acute|equilateral' },
    ]);
    expect(
      predicates['cardInCell']?.(observe(partial), { card: 't04', cell: 'acute|equilateral' }),
    ).toBe(true);
    expect(predicates['allCardsCorrect']?.(observe(partial), undefined)).toBe(false);
    expect(
      predicates['allCardsCorrect']?.(observe(apply({ mode: 'venn' }, CORRECT_ACTIONS)), undefined),
    ).toBe(true);
  });

  it('설정은 모르는 행·열을 버리고 1~3개만 받는다', () => {
    const state = asVenn(
      apply(
        {
          mode: 'venn',
          rows: ['acute', 'nope', 'right', 'obtuse', 'acute'],
          cols: ['scalene', 'scalene', 'equilateral', 'isosceles'],
        },
        [],
      ),
    );
    expect(state.settings.rows).toEqual(['acute', 'right', 'obtuse']);
    expect(state.settings.cols).toEqual(['scalene', 'equilateral', 'isosceles']);
  });
});

describe('E17 secret-rule seed', () => {
  it('같은 설정이면 초기 상태가 같고 seed 1 비밀 카드는 q11이다', () => {
    const first = asSecret(createInitialState({ mode: 'secret-rule', seed: 1 }));
    const second = asSecret(createInitialState({ mode: 'secret-rule', seed: 1 }));
    expect(first).toEqual(second);
    expect(first.secret).toBe('q11');
  });

  it('seed 1~50에서 비밀 카드가 8종 이상 나온다', () => {
    const secrets = new Set<string>();
    for (let seed = 1; seed <= 50; seed += 1) {
      secrets.add(asSecret(createInitialState({ mode: 'secret-rule', seed })).secret);
    }
    expect(secrets.size).toBeGreaterThanOrEqual(8);
  });

  it('new-round는 결정적이고 비밀 카드가 바뀐다', () => {
    const initial = createInitialState({ mode: 'secret-rule', seed: 1 });
    const once = asSecret(reduce(initial, { type: 'new-round' }));
    const again = asSecret(reduce(initial, { type: 'new-round' }));
    expect(once).toEqual(again);
    expect(once.round).toBe(1);
    expect(once.secret).toBe('q04');
    expect(asSecret(reduce(once, { type: 'new-round' })).secret).toBe('q12');
  });
});

describe('E17 secret-rule 모순 판정', () => {
  it('질문 없이 지운 카드는 모두 wrongEliminations다', () => {
    const observation = observe(
      apply({ mode: 'secret-rule', seed: 1 }, [
        { type: 'eliminate', card: 'q01' },
        { type: 'eliminate', card: 'q02' },
      ]),
    );
    expect(stringsOf(observation, 'wrongEliminations')).toEqual(['q01', 'q02']);
  });

  it('답이 다른 질문을 물으면 그 카드는 모순에서 빠진다', () => {
    const observation = observe(
      apply({ mode: 'secret-rule', seed: 1 }, [
        { type: 'eliminate', card: 'q04' },
        { type: 'ask', question: 'parallel-pairs>=1' },
      ]),
    );
    expect(stringsOf(observation, 'wrongEliminations')).toEqual([]);
  });

  it('비밀 카드와 서명이 같은 카드를 지우면 끝까지 남는다', () => {
    const actions: SorterAction[] = [
      { type: 'eliminate', card: 'q01' },
      ...ALL_QUESTIONS.map((question) => ({ type: 'ask' as const, question })),
    ];
    const observation = observe(apply({ mode: 'secret-rule', seed: 1 }, actions));
    expect(stringsOf(observation, 'wrongEliminations')).toEqual(['q01']);
  });

  it('같은 질문은 두 번 묻지 않고, 지운 카드는 맞힐 수 없다', () => {
    const state = asSecret(
      apply({ mode: 'secret-rule', seed: 1 }, [
        { type: 'ask', question: 'parallel-pairs==2' },
        { type: 'ask', question: 'parallel-pairs==2' },
        { type: 'eliminate', card: 'q05' },
        { type: 'guess', card: 'q05' },
      ]),
    );
    expect(state.asked).toHaveLength(1);
    expect(state.guesses).toEqual([]);
    expect(state.solved).toBe(false);
  });

  it('서명이 같은 다른 카드를 맞히면 solved다', () => {
    const state = asSecret(
      apply({ mode: 'secret-rule', seed: 1 }, [{ type: 'guess', card: 'q01' }]),
    );
    expect(state.solved).toBe(true);
    expect(observe(state)['solved']).toBe(true);
  });

  it('studentEliminates: false면 답과 다른 카드를 자동으로 지운다', () => {
    const state = asSecret(
      apply({ mode: 'secret-rule', seed: 1, studentEliminates: false }, [
        { type: 'ask', question: 'parallel-pairs>=1' },
      ]),
    );
    expect(state.eliminated).toEqual(['q04', 'q07', 'q10', 'q16']);
  });

  it('solvedWithin·solvedConsistently·askedSetIs 판정', () => {
    const observation = observe(
      apply({ mode: 'secret-rule', seed: 1 }, [
        { type: 'ask', question: 'parallel-pairs==2' },
        { type: 'guess', card: 'q11' },
      ]),
    );
    expect(predicates['solvedConsistently']?.(observation, undefined)).toBe(true);
    expect(predicates['solvedWithin']?.(observation, { max: 1 })).toBe(true);
    expect(predicates['solvedWithin']?.(observation, { max: 0 })).toBe(false);
    expect(predicates['askedSetIs']?.(observation, { questions: ['parallel-pairs==2'] })).toBe(
      true,
    );
  });
});

describe('E17 역할 바꾸기', () => {
  const config: SorterConfig = {
    mode: 'secret-rule',
    seed: 1,
    roleSwap: true,
    startRole: 'answerer',
  };

  it('q12를 고르면 역할 바꾸기 질문 순서 전체가 고정된다', () => {
    let state = asSecret(apply(config, [{ type: 'swap-pick', card: 'q12' }]));
    expect(state.swap.secret).toBe('q12');
    const order: string[] = [];
    while (state.swap.pending !== null) {
      order.push(state.swap.pending);
      state = asSecret(reduce(state, { type: 'swap-answer', answer: true }));
    }
    expect(order).toEqual(['parallel-pairs==2', 'all-sides-equal', 'has-right-angle']);
    expect(state.swap.done).toBe(true);
    expect(state.swap.candidates).toHaveLength(3);
  });

  it('틀린 답은 swapErrors 1로 기록하고 후보는 truth로 거른다', () => {
    const state = asSecret(
      apply(config, [
        { type: 'swap-pick', card: 'q12' },
        { type: 'swap-answer', answer: false },
      ]),
    );
    expect(state.swap.log[0]).toEqual({
      question: 'parallel-pairs==2',
      answer: false,
      truth: true,
    });
    expect(state.swap.candidates).toHaveLength(9);
    const observation = observe(state);
    expect(observation['swapErrors']).toBe(1);
    expect(predicates['swapNoErrors']?.(observation, undefined)).toBe(false);
  });

  it('roleSwap: false면 switch-role이 역할을 바꾸지 않는다', () => {
    const state = asSecret(
      createInitialState({ mode: 'secret-rule', seed: 1, roleSwap: false, startRole: 'answerer' }),
    );
    const next = asSecret(reduce(state, { type: 'switch-role', role: 'guesser' }));
    expect(next.role).toBe('answerer');
  });

  it('나머지를 모두 맞히면 done이고 후보가 남는다', () => {
    let state = asSecret(apply(config, [{ type: 'swap-pick', card: 'q12' }]));
    for (let step = 0; step < 10 && state.swap.pending !== null; step += 1) {
      state = asSecret(reduce(state, { type: 'swap-answer', answer: true }));
    }
    expect(state.swap.done).toBe(true);
    expect(state.swap.log.length).toBeGreaterThan(1);
    expect(state.swap.candidates.length).toBeGreaterThan(0);
    expect(observe(state)['swapDone']).toBe(true);
  });
});

describe('E17 hierarchy', () => {
  const cases: readonly (readonly [ConstraintToggle[], QuadName])[] = [
    [[], 'quadrilateral'],
    [['right-angle'], 'quadrilateral'],
    [['one-parallel-pair'], 'trapezoid'],
    [['one-parallel-pair', 'right-angle'], 'trapezoid'],
    [['two-parallel-pairs'], 'parallelogram'],
    [['two-parallel-pairs', 'right-angle'], 'rectangle'],
    [['equal-sides'], 'rhombus'],
    [['equal-sides', 'right-angle'], 'square'],
  ];

  it('여덟 토글 조합의 currentNode가 좌표표와 같다', () => {
    for (const [toggles, node] of cases) {
      const state = toggles.reduce<HierarchyState>(
        (current, toggle) => asHierarchy(reduce(current, { type: 'toggle', toggle })),
        asHierarchy(createInitialState({ mode: 'hierarchy' })),
      );
      expect(observe(state)['currentNode'], toggles.join(',')).toBe(node);
    }
  });

  it('equal-sides만 켜면 마름모다', () => {
    const state = asHierarchy(
      apply({ mode: 'hierarchy' }, [{ type: 'toggle', toggle: 'equal-sides' }]),
    );
    expect(observe(state)['currentNode']).toBe('rhombus');
    expect(observe(state)['allSidesEqual']).toBe(true);
  });

  it('평행사변형은 inclusive면 사다리꼴 이름을 갖고 exclusive면 갖지 않는다', () => {
    const inclusiveObservation = observe(
      apply({ mode: 'hierarchy' }, [{ type: 'toggle', toggle: 'two-parallel-pairs' }]),
    );
    expect(stringsOf(inclusiveObservation, 'names')).toContain('trapezoid');
    const exclusiveObservation = observe(
      apply({ mode: 'hierarchy', trapezoidDefinition: 'exclusive' }, [
        { type: 'toggle', toggle: 'two-parallel-pairs' },
      ]),
    );
    expect(stringsOf(exclusiveObservation, 'names')).not.toContain('trapezoid');
    expect(exclusiveObservation['currentNode']).toBe('parallelogram');
  });

  it('마름모·직사각형 빈칸을 맞바꿔도 blanksCorrect다', () => {
    const filled = apply({ mode: 'hierarchy' }, [
      { type: 'fill-blank', node: 'trapezoid', name: 'trapezoid' },
      { type: 'fill-blank', node: 'parallelogram', name: 'parallelogram' },
      { type: 'fill-blank', node: 'rhombus', name: 'rectangle' },
      { type: 'fill-blank', node: 'rectangle', name: 'rhombus' },
      { type: 'fill-blank', node: 'square', name: 'square' },
    ]);
    const observation = observe(filled);
    expect(observation['blanksFilled']).toBe(5);
    expect(observation['blanksCorrect']).toBe(true);
    expect(stringsOf(observation, 'wrongBlanks')).toEqual([]);
    expect(predicates['treeComplete']?.(observation, undefined)).toBe(true);
  });

  it('fill-blank는 같은 이름을 다른 빈칸에서 옮긴다', () => {
    const state = asHierarchy(
      apply({ mode: 'hierarchy' }, [
        { type: 'fill-blank', node: 'trapezoid', name: 'square' },
        { type: 'fill-blank', node: 'square', name: 'square' },
      ]),
    );
    expect(state.blanks['trapezoid']).toBeNull();
    expect(state.blanks['square']).toBe('square');
  });

  it('설정에 없는 토글과 빈칸은 무시한다', () => {
    const state = asHierarchy(
      apply({ mode: 'hierarchy', constraintToggles: ['right-angle'], treeBlanks: ['square'] }, [
        { type: 'toggle', toggle: 'equal-sides' },
        { type: 'toggle', toggle: 'right-angle' },
        { type: 'fill-blank', node: 'trapezoid', name: 'trapezoid' },
      ]),
    );
    expect(state.toggles).toEqual(['right-angle']);
    expect(state.blanks['trapezoid']).toBeUndefined();
  });
});

describe('E17 이벤트', () => {
  it('카드 놓기·질문·정답·역할 답·모양·트리 완성 이벤트', () => {
    const venn = createInitialState({ mode: 'venn' });
    const placed = reduce(venn, { type: 'place', card: 't04', cell: 'acute|equilateral' });
    expect(emit(venn, placed, { type: 'place', card: 't04', cell: 'acute|equilateral' })).toEqual([
      { name: 'card-placed', payload: { card: 't04', cell: 'acute|equilateral' } },
    ]);

    const secret = createInitialState({ mode: 'secret-rule', seed: 1 });
    const asked = reduce(secret, { type: 'ask', question: 'parallel-pairs==2' });
    expect(emit(secret, asked, { type: 'ask', question: 'parallel-pairs==2' })).toEqual([
      { name: 'question-asked', payload: { question: 'parallel-pairs==2' } },
    ]);
    const solved = reduce(asked, { type: 'guess', card: 'q11' });
    expect(emit(asked, solved, { type: 'guess', card: 'q11' })).toEqual([
      { name: 'secret-found', payload: { questionCount: 1 } },
    ]);

    const answerer = createInitialState({
      mode: 'secret-rule',
      seed: 1,
      roleSwap: true,
      startRole: 'answerer',
    });
    const mine = reduce(answerer, { type: 'swap-pick', card: 'q12' });
    const answered = reduce(mine, { type: 'swap-answer', answer: false });
    expect(emit(mine, answered, { type: 'swap-answer', answer: false })).toEqual([
      { name: 'swap-answered', payload: { correct: false } },
    ]);

    const hierarchy = createInitialState({ mode: 'hierarchy' });
    const toggled = reduce(hierarchy, { type: 'toggle', toggle: 'two-parallel-pairs' });
    expect(emit(hierarchy, toggled, { type: 'toggle', toggle: 'two-parallel-pairs' })).toEqual([
      { name: 'shape-changed', payload: { node: 'parallelogram' } },
    ]);

    const complete = reduce(
      reduce(hierarchy, { type: 'fill-blank', node: 'trapezoid', name: 'trapezoid' }),
      { type: 'fill-blank', node: 'parallelogram', name: 'parallelogram' },
    );
    const finished = [
      ['rhombus', 'rhombus'],
      ['rectangle', 'rectangle'],
      ['square', 'square'],
    ].reduce<SorterState>(
      (state, [node, name]) =>
        reduce(state, {
          type: 'fill-blank',
          node: node as QuadName,
          name: name as QuadName,
        }),
      complete,
    );
    expect(
      emit(complete, finished, {
        type: 'fill-blank',
        node: 'square',
        name: 'square',
      }),
    ).toEqual([{ name: 'tree-complete' }]);
  });
});

describe('E17 상태 직렬화', () => {
  it('세 모드 모두 JSON 직렬화 가능하다', () => {
    assertSerializable(createInitialState({ mode: 'venn' }));
    assertSerializable(createInitialState({ mode: 'secret-rule', seed: 1 }));
    assertSerializable(createInitialState({ mode: 'hierarchy' }));
    assertSerializable(apply({ mode: 'venn' }, CORRECT_ACTIONS));
  });
});
