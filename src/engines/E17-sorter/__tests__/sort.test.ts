/** E17 sort 모드 reduce·observe·events·predicates 단위 테스트(T217). */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import { currentCard } from '../sort/reduce';
import type { SortState } from '../sort/types';
import type { SorterAction, SorterConfig, SorterState } from '../types';

function make(config: SorterConfig): SortState {
  const state = createInitialState(config);
  if (state.mode !== 'sort') throw new Error('sort 상태가 아니다');
  return state;
}

function run(state: SorterState, actions: readonly SorterAction[]): SortState {
  const next = actions.reduce<SorterState>((now, action) => reduce(now, action), state);
  if (next.mode !== 'sort') throw new Error('sort 상태가 아니다');
  return next;
}

function move(card: string, to: 'bin1' | 'bin2' | 'bin3' | 'bin4' | 'tray'): SorterAction {
  return { type: 'move', card, to };
}

function seen(state: SorterState): Observation {
  return observe(state);
}

function holds(name: string, observation: Observation, args?: JsonValue): boolean {
  const fn = predicates[name];
  if (!fn) throw new Error(`predicate ${name} 없음`);
  return fn(observation, args);
}

function list(observation: Observation, key: string): string[] {
  return observation[key] as string[];
}

const BY_COLOR: SorterConfig = {
  mode: 'sort',
  criterionChoice: ['color', 'shape', 'holes', 'pretty'],
};

describe('sort 설정', () => {
  it('기본은 단추 12장, 상자 이름 없음 3개, 카드는 모두 트레이', () => {
    const state = make({ mode: 'sort' });
    expect(state.settings.deck).toBe('buttons-12');
    expect(state.settings.cards).toHaveLength(12);
    const observation = seen(state);
    expect(Object.keys(observation['bins'] as object)).toEqual(['bin1', 'bin2', 'bin3']);
    expect(list(observation, 'tray')).toHaveLength(12);
    expect(observation['allPlaced']).toBe(false);
  });

  it.each<[string, SorterConfig]>([
    ['없는 묶음', { mode: 'sort', deck: 'nope' as never }],
    ['없는 카드 id', { mode: 'sort', cards: ['b01', 'zz'] }],
    ['중복 카드', { mode: 'sort', cards: ['b01', 'b01'] }],
    ['빈 카드 목록', { mode: 'sort', cards: [] }],
    ['묶음에 없는 기준', { mode: 'sort', criterionChoice: ['size'] }],
    [
      '사물 묶음의 pretty',
      { mode: 'sort', deck: 'classroom-objects-12', criterionChoice: ['pretty'] },
    ],
    ['기준 값 이름인데 기준 고르기 없음', { mode: 'sort', binLabels: 'criterion-values' }],
    ['상자 수 5', { mode: 'sort', bins: 5 }],
    ['prefill의 없는 카드', { mode: 'sort', prefill: { bin1: ['zz'] } }],
    ['prefill의 없는 상자', { mode: 'sort', bins: 2, prefill: { bin3: ['b01'] } }],
    [
      'prefill + 기준 고르기',
      { mode: 'sort', criterionChoice: ['color'], prefill: { bin1: ['b01'] } },
    ],
  ])('설정 오류: %s', (_name, config) => {
    const state = make(config);
    expect(state.settings.error).not.toBeNull();
    // 오류 설정에서는 아무 Action도 상태를 바꾸지 않는다.
    expect(reduce(state, move('b01', 'bin1'))).toBe(state);
  });
});

describe('기준 고르기', () => {
  it('기준을 고르기 전에는 카드를 상자에 넣을 수 없다(트레이로는 가능)', () => {
    const state = make(BY_COLOR);
    expect(reduce(state, move('b01', 'bin1'))).toBe(state);
    expect(list(seen(state), 'tray')).toHaveLength(12);
    expect(seen(state)['bins']).toEqual({});
  });

  it('기준을 고르면 값 개수만큼 상자가 생긴다(색 3·구멍 2·예쁜 것 2)', () => {
    const bins = (criterion: string) =>
      Object.keys(
        seen(run(make(BY_COLOR), [{ type: 'choose-criterion', criterion }]))['bins'] as object,
      );
    expect(bins('color')).toEqual(['bin1', 'bin2', 'bin3']);
    expect(bins('holes')).toEqual(['bin1', 'bin2']);
    expect(bins('pretty')).toEqual(['bin1', 'bin2']);
  });

  it('상자 이름은 기준 값이다', () => {
    const state = run(make(BY_COLOR), [{ type: 'choose-criterion', criterion: 'shape' }]);
    expect(seen(state)['binLabels']).toEqual({
      bin1: 'circle',
      bin2: 'square',
      bin3: 'triangle',
    });
  });

  it('목록에 없는 기준·이미 고른 뒤의 선택은 거절한다', () => {
    const state = make({ mode: 'sort', criterionChoice: ['color'] });
    expect(reduce(state, { type: 'choose-criterion', criterion: 'shape' })).toBe(state);
    const chosen = run(state, [{ type: 'choose-criterion', criterion: 'color' }]);
    expect(reduce(chosen, { type: 'choose-criterion', criterion: 'color' })).toBe(chosen);
  });

  it('기준 바꾸기: 모든 카드가 판으로 돌아가고 기준이 비며 기록은 남는다', () => {
    const state = run(make(BY_COLOR), [
      { type: 'choose-criterion', criterion: 'color' },
      move('b01', 'bin1'),
      move('b06', 'bin2'),
      { type: 'change-criterion' },
    ]);
    const observation = seen(state);
    expect(observation['criterion']).toBeNull();
    expect(list(observation, 'tray')).toHaveLength(12);
    expect(observation['criterionHistory']).toEqual(['color']);
    expect(holds('criterionChanged', observation)).toBe(false);

    const again = run(state, [{ type: 'choose-criterion', criterion: 'shape' }]);
    expect(seen(again)['criterionHistory']).toEqual(['color', 'shape']);
    expect(holds('criterionChanged', seen(again))).toBe(true);
    expect(holds('criterionIs', seen(again), { c: 'shape' })).toBe(true);
    expect(holds('criterionIs', seen(again), { c: 'color' })).toBe(false);
  });

  it('기준 고르기가 없는 설정에서 기준 바꾸기는 아무것도 하지 않는다', () => {
    const state = make({ mode: 'sort' });
    expect(reduce(state, { type: 'change-criterion' })).toBe(state);
  });
});

describe('컨베이어', () => {
  const config: SorterConfig = {
    mode: 'sort',
    conveyor: true,
    cards: ['b03', 'b01', 'b02'],
    bins: 2,
  };

  it('지금 카드는 설정 카드 순서의 첫 카드이고, 넣어야 다음 카드가 온다', () => {
    let state = make(config);
    expect(currentCard(state)).toBe('b03');
    state = run(state, [move('b03', 'bin1')]);
    expect(currentCard(state)).toBe('b01');
    state = run(state, [move('b01', 'bin2')]);
    expect(currentCard(state)).toBe('b02');
    state = run(state, [move('b02', 'bin2')]);
    expect(currentCard(state)).toBeNull();
    expect(seen(state)['allPlaced']).toBe(true);
  });

  it('지금 카드가 아닌 벨트 카드는 넣을 수 없다', () => {
    const state = make(config);
    expect(reduce(state, move('b01', 'bin1'))).toBe(state);
  });

  it('상자에 든 카드는 벨트(트레이)로 되돌릴 수 있고, 되돌린 카드가 다시 먼저 온다', () => {
    const state = run(make(config), [
      move('b03', 'bin1'),
      move('b01', 'bin1'),
      move('b03', 'tray'),
    ]);
    expect(currentCard(state)).toBe('b03');
  });
});

describe('pureBy·mismatched·valueCounts', () => {
  it('색 기준: 같은 색끼리 넣으면 pureBy에 color가 들어가고 mismatched는 없다', () => {
    const state = run(make(BY_COLOR), [
      { type: 'choose-criterion', criterion: 'color' },
      move('b01', 'bin1'),
      move('b02', 'bin1'),
      move('b06', 'bin2'),
      move('b10', 'bin3'),
    ]);
    const observation = seen(state);
    expect(list(observation, 'pureBy')).toContain('color');
    expect(list(observation, 'mismatched')).toEqual([]);
    expect(holds('pureBy', observation, { attribute: 'color' })).toBe(true);
    expect(holds('noMismatch', observation)).toBe(true);
  });

  it('다른 색 카드를 빨강 상자에 넣으면 mismatched에 그 카드가 든다', () => {
    const state = run(make(BY_COLOR), [
      { type: 'choose-criterion', criterion: 'color' },
      move('b01', 'bin1'),
      move('b06', 'bin1'),
    ]);
    const observation = seen(state);
    expect(list(observation, 'mismatched')).toEqual(['b06']);
    expect(list(observation, 'pureBy')).not.toContain('color');
    expect(holds('noMismatch', observation)).toBe(false);
  });

  it('pureBy 판정은 상자 값이 서로 달라야 한다(두 상자가 같은 값이면 거짓)', () => {
    const state = run(make({ mode: 'sort', bins: 2 }), [move('b01', 'bin1'), move('b02', 'bin2')]);
    const observation = seen(state);
    // 두 상자 모두 빨강이라 pureBy(color)에는 들지만 값이 같아 predicate는 거짓이다.
    expect(list(observation, 'pureBy')).toContain('color');
    expect(holds('pureBy', observation, { attribute: 'color' })).toBe(false);
    // 구멍 수는 2와 4로 달라 predicate도 참이다.
    expect(holds('pureBy', observation, { attribute: 'holes' })).toBe(true);
  });

  it('아무 카드도 넣지 않았으면 pureBy·noMismatch는 거짓이다', () => {
    const state = run(make(BY_COLOR), [{ type: 'choose-criterion', criterion: 'color' }]);
    const observation = seen(state);
    expect(list(observation, 'pureBy')).toEqual([]);
    expect(holds('noMismatch', observation)).toBe(false);
  });

  it('valueCounts는 기준을 고른 뒤의 값별 실제 개수다(pretty는 비어 있다)', () => {
    const color = run(make(BY_COLOR), [{ type: 'choose-criterion', criterion: 'color' }]);
    expect(seen(color)['valueCounts']).toEqual({ red: 5, blue: 4, yellow: 3 });
    const holes = run(make(BY_COLOR), [{ type: 'choose-criterion', criterion: 'holes' }]);
    expect(seen(holes)['valueCounts']).toEqual({ '2': 7, '4': 5 });
    const pretty = run(make(BY_COLOR), [{ type: 'choose-criterion', criterion: 'pretty' }]);
    expect(seen(pretty)['valueCounts']).toEqual({});
    expect(seen(make(BY_COLOR))['valueCounts']).toEqual({});
  });

  it('pretty는 mismatched를 만들지 않는다', () => {
    const state = run(make(BY_COLOR), [
      { type: 'choose-criterion', criterion: 'pretty' },
      move('b01', 'bin1'),
      move('b06', 'bin1'),
    ]);
    expect(list(seen(state), 'mismatched')).toEqual([]);
  });
});

describe('개수표', () => {
  const config: SorterConfig = { mode: 'sort', criterionChoice: ['color'], countTable: 'student' };
  const placeAll = (): SortState => {
    const actions: SorterAction[] = [{ type: 'choose-criterion', criterion: 'color' }];
    const bins: Record<string, 'bin1' | 'bin2' | 'bin3'> = {
      red: 'bin1',
      blue: 'bin2',
      yellow: 'bin3',
    };
    const colors = [
      'red',
      'red',
      'red',
      'red',
      'red',
      'blue',
      'blue',
      'blue',
      'blue',
      'yellow',
      'yellow',
      'yellow',
    ];
    colors.forEach((color, index) => {
      actions.push(move(`b${String(index + 1).padStart(2, '0')}`, bins[color] ?? 'bin1'));
    });
    return run(make(config), actions);
  };

  it('모든 카드를 넣기 전에는 개수를 쓸 수 없다', () => {
    const state = run(make(config), [
      { type: 'choose-criterion', criterion: 'color' },
      move('b01', 'bin1'),
    ]);
    expect(reduce(state, { type: 'count', bin: 'bin1', value: 1 })).toBe(state);
  });

  it('모든 칸을 맞게 쓰면 countsCorrect', () => {
    let state = placeAll();
    expect(seen(state)['allPlaced']).toBe(true);
    expect(holds('countsCorrect', seen(state))).toBe(false);
    state = run(state, [
      { type: 'count', bin: 'bin1', value: 5 },
      { type: 'count', bin: 'bin2', value: 4 },
    ]);
    expect(holds('countsCorrect', seen(state))).toBe(false);
    state = run(state, [{ type: 'count', bin: 'bin3', value: 3 }]);
    expect(holds('countsCorrect', seen(state))).toBe(true);
    expect(seen(state)['misconceptions']).toEqual([]);
  });

  it('0과 20은 쓸 수 있고 -1·21·소수는 거절한다', () => {
    const state = placeAll();
    expect(run(state, [{ type: 'count', bin: 'bin1', value: 0 }]).counts['bin1']).toBe(0);
    expect(run(state, [{ type: 'count', bin: 'bin1', value: 20 }]).counts['bin1']).toBe(20);
    expect(reduce(state, { type: 'count', bin: 'bin1', value: -1 })).toBe(state);
    expect(reduce(state, { type: 'count', bin: 'bin1', value: 21 })).toBe(state);
    expect(reduce(state, { type: 'count', bin: 'bin1', value: 2.5 })).toBe(state);
  });

  it('실제와 정확히 1 차이인 개수는 MC-COUNT-ONE-TO-ONE, 2 차이는 아니다', () => {
    const state = placeAll();
    const off = (bin: 'bin1' | 'bin2' | 'bin3', value: number) =>
      seen(run(state, [{ type: 'count', bin, value }]))['misconceptions'];
    expect(off('bin1', 4)).toEqual(['MC-COUNT-ONE-TO-ONE']);
    expect(off('bin1', 6)).toEqual(['MC-COUNT-ONE-TO-ONE']);
    expect(off('bin1', 3)).toEqual([]);
    expect(off('bin1', 5)).toEqual([]);
    expect(
      holds('countsCorrect', seen(run(state, [{ type: 'count', bin: 'bin1', value: 4 }]))),
    ).toBe(false);
  });

  it('개수표가 student가 아니면 count를 거절하고 auto는 모든 카드를 넣은 뒤 개수를 보인다', () => {
    const plain = make({ mode: 'sort', bins: 3 });
    expect(reduce(plain, { type: 'count', bin: 'bin1', value: 1 })).toBe(plain);

    const auto = run(
      make({ mode: 'sort', bins: 2, countTable: 'auto', cards: ['b01', 'b02', 'b03'] }),
      [move('b01', 'bin1'), move('b02', 'bin1')],
    );
    expect(seen(auto)['counts']).toEqual({ bin1: null, bin2: null });
    const done = run(auto, [move('b03', 'bin2')]);
    expect(seen(done)['counts']).toEqual({ bin1: 2, bin2: 1 });
    expect(holds('countsCorrect', seen(done))).toBe(false);
  });

  it('기준을 바꾸면 쓴 개수가 지워진다', () => {
    const state = run(placeAll(), [
      { type: 'count', bin: 'bin1', value: 5 },
      { type: 'change-criterion' },
    ]);
    expect(state.counts).toEqual({});
  });
});

describe('오개념 감지', () => {
  it('MC-SORT-INCONSISTENT: 네 장 이상 넣었고 어떤 속성으로도 한 값이 아닌 상자가 있다', () => {
    const mixed = run(make({ mode: 'sort', bins: 3 }), [
      move('b01', 'bin1'), // 빨강 동그라미 2
      move('b07', 'bin1'), // 파랑 네모 4
      move('b02', 'bin2'),
      move('b03', 'bin3'),
    ]);
    expect(seen(mixed)['misconceptions']).toContain('MC-SORT-INCONSISTENT');

    // 세 장만 넣으면 아직 아니다.
    const three = run(make({ mode: 'sort', bins: 3 }), [
      move('b01', 'bin1'),
      move('b07', 'bin1'),
      move('b02', 'bin2'),
    ]);
    expect(seen(three)['misconceptions']).not.toContain('MC-SORT-INCONSISTENT');

    // 한 속성(구멍 수 2)이라도 같으면 아니다: b01(2)·b03(2)·b06(2)·b08(2).
    const consistent = run(make({ mode: 'sort', bins: 2 }), [
      move('b01', 'bin1'),
      move('b06', 'bin1'),
      move('b03', 'bin1'),
      move('b08', 'bin1'),
    ]);
    expect(seen(consistent)['misconceptions']).not.toContain('MC-SORT-INCONSISTENT');
  });

  it('MC-SORT-INCONSISTENT: 색 상자에 모양과 색을 섞은 경우', () => {
    const state = run(make(BY_COLOR), [
      { type: 'choose-criterion', criterion: 'color' },
      move('b01', 'bin1'),
      move('b07', 'bin1'),
      move('b02', 'bin2'),
      move('b10', 'bin3'),
    ]);
    expect(seen(state)['misconceptions']).toContain('MC-SORT-INCONSISTENT');
  });

  const OBJECTS: SorterConfig = { mode: 'sort', deck: 'classroom-objects-12', bins: 3 };

  it('MC-SHAPE-BY-COLOR-SIZE: 빨간 것끼리(모양이 섞임)', () => {
    const state = run(make(OBJECTS), [
      move('o-eraser', 'bin1'),
      move('o-glue', 'bin1'),
      move('o-ball', 'bin1'),
    ]);
    const found = seen(state)['misconceptions'] as string[];
    expect(found).toContain('MC-SHAPE-BY-COLOR-SIZE');
  });

  it('MC-SHAPE-BY-COLOR-SIZE: 크기가 같은 것끼리(작은 것)도 감지한다', () => {
    const state = run(make(OBJECTS), [move('o-eraser', 'bin1'), move('o-marble', 'bin1')]);
    expect(seen(state)['misconceptions']).toContain('MC-SHAPE-BY-COLOR-SIZE');
  });

  it('모양 계열이 같은 것끼리 넣으면 MC-SHAPE-BY-COLOR-SIZE가 없다', () => {
    const state = run(make(OBJECTS), [
      move('o-eraser', 'bin1'),
      move('o-tissue', 'bin1'),
      move('o-glue', 'bin2'),
      move('o-roll', 'bin2'),
    ]);
    expect(seen(state)['misconceptions']).not.toContain('MC-SHAPE-BY-COLOR-SIZE');
  });

  it('단추 묶음에서는 MC-SHAPE-BY-COLOR-SIZE·MC-SHAPE-ORIENTATION을 만들지 않는다', () => {
    const state = run(make({ mode: 'sort', bins: 2 }), [move('b01', 'bin1'), move('b03', 'bin1')]);
    const found = seen(state)['misconceptions'] as string[];
    expect(found).not.toContain('MC-SHAPE-BY-COLOR-SIZE');
    expect(found).not.toContain('MC-SHAPE-ORIENTATION');
  });

  it('MC-SHAPE-ORIENTATION: 캔 둘을 다른 상자에 넣는다', () => {
    const split = run(make(OBJECTS), [move('o-can-up', 'bin1'), move('o-can-side', 'bin2')]);
    expect(seen(split)['misconceptions']).toContain('MC-SHAPE-ORIENTATION');

    const together = run(make(OBJECTS), [move('o-can-up', 'bin1'), move('o-can-side', 'bin1')]);
    expect(seen(together)['misconceptions']).not.toContain('MC-SHAPE-ORIENTATION');

    // 한쪽이 트레이에 있으면 아직 아니다.
    const tray = run(make(OBJECTS), [move('o-can-up', 'bin1')]);
    expect(seen(tray)['misconceptions']).not.toContain('MC-SHAPE-ORIENTATION');
  });

  it('hasMisconception predicate는 sort 관찰에서도 코드를 찾는다', () => {
    const state = run(make(OBJECTS), [move('o-can-up', 'bin1'), move('o-can-side', 'bin2')]);
    expect(holds('hasMisconception', seen(state), { code: 'MC-SHAPE-ORIENTATION' })).toBe(true);
    expect(holds('hasMisconception', seen(state), { code: 'MC-COUNT-ONE-TO-ONE' })).toBe(false);
  });
});

describe('상자 이름 아이콘', () => {
  const NAMING: SorterConfig = {
    mode: 'sort',
    deck: 'classroom-objects-12',
    binLabels: 'student-choice-icon',
    bins: 3,
  };
  const grouped: SorterAction[] = [
    move('o-eraser', 'bin1'),
    move('o-milk', 'bin1'),
    move('o-glue', 'bin2'),
    move('o-roll', 'bin2'),
    move('o-ball', 'bin3'),
    move('o-orange', 'bin3'),
  ];

  it('labelsMatchBy: 이름 아이콘이 상자 카드의 값과 같으면 참', () => {
    const state = run(make(NAMING), [
      ...grouped,
      { type: 'label-bin', bin: 'bin1', icon: 'shapeFamily:box' },
      { type: 'label-bin', bin: 'bin2', icon: 'shapeFamily:cylinder' },
      { type: 'label-bin', bin: 'bin3', icon: 'shapeFamily:sphere' },
    ]);
    const observation = seen(state);
    expect(holds('labelsMatchBy', observation, { attribute: 'shapeFamily' })).toBe(true);
    expect(holds('labelsMatchBy', observation, { attribute: 'color' })).toBe(false);
    expect(observation['binLabels']).toEqual({
      bin1: 'shapeFamily:box',
      bin2: 'shapeFamily:cylinder',
      bin3: 'shapeFamily:sphere',
    });
  });

  it('아이콘이 틀리거나 빠지면 거짓', () => {
    const wrong = run(make(NAMING), [
      ...grouped,
      { type: 'label-bin', bin: 'bin1', icon: 'shapeFamily:cylinder' },
      { type: 'label-bin', bin: 'bin2', icon: 'shapeFamily:cylinder' },
      { type: 'label-bin', bin: 'bin3', icon: 'shapeFamily:sphere' },
    ]);
    expect(holds('labelsMatchBy', seen(wrong), { attribute: 'shapeFamily' })).toBe(false);
    const missing = run(make(NAMING), [
      ...grouped,
      { type: 'label-bin', bin: 'bin1', icon: 'shapeFamily:box' },
    ]);
    expect(holds('labelsMatchBy', seen(missing), { attribute: 'shapeFamily' })).toBe(false);
  });

  it('두 상자에 같은 아이콘을 붙이면 거짓(상자 값이 서로 달라야 한다)', () => {
    const state = run(make(NAMING), [
      move('o-eraser', 'bin1'),
      move('o-milk', 'bin2'),
      { type: 'label-bin', bin: 'bin1', icon: 'shapeFamily:box' },
      { type: 'label-bin', bin: 'bin2', icon: 'shapeFamily:box' },
    ]);
    expect(holds('labelsMatchBy', seen(state), { attribute: 'shapeFamily' })).toBe(false);
  });

  it('단추 묶음의 아이콘(색·모양·구멍)은 모두 받고, 모르는 아이콘이나 같은 값 다시 누르기는 무시한다', () => {
    const state = make({ mode: 'sort', binLabels: 'student-choice-icon' });
    for (const icon of ['color:red', 'shape:square', 'holes:4']) {
      const next = reduce(state, { type: 'label-bin', bin: 'bin1', icon });
      expect(next).not.toBe(state);
    }
    expect(reduce(state, { type: 'label-bin', bin: 'bin1', icon: 'shapeFamily:box' })).toBe(state);
    expect(reduce(state, { type: 'label-bin', bin: 'bin4', icon: 'color:red' })).toBe(state);
    const named = run(state, [{ type: 'label-bin', bin: 'bin1', icon: 'color:red' }]);
    expect(reduce(named, { type: 'label-bin', bin: 'bin1', icon: 'color:red' })).toBe(named);
    expect(run(named, [{ type: 'label-bin', bin: 'bin1', icon: null }]).icons['bin1']).toBeNull();
  });

  it('이름 아이콘이 아닌 설정에서는 label-bin을 거절한다', () => {
    const state = make({ mode: 'sort' });
    expect(reduce(state, { type: 'label-bin', bin: 'bin1', icon: 'color:red' })).toBe(state);
  });
});

describe('sameBin·prefill·removedOnly', () => {
  it('sameBin', () => {
    const state = run(make({ mode: 'sort', bins: 2 }), [
      move('b01', 'bin1'),
      move('b02', 'bin1'),
      move('b03', 'bin2'),
    ]);
    expect(holds('sameBin', seen(state), { a: 'b01', b: 'b02' })).toBe(true);
    expect(holds('sameBin', seen(state), { a: 'b01', b: 'b03' })).toBe(false);
    // 둘 다 트레이면 같은 상자가 아니다.
    expect(holds('sameBin', seen(state), { a: 'b04', b: 'b05' })).toBe(false);
  });

  it('prefill은 시작할 때 상자에 든 카드이고, 꺼낸 카드만 removed에 든다', () => {
    const config: SorterConfig = {
      mode: 'sort',
      bins: 2,
      prefill: { bin1: ['b01', 'b02', 'b06'], bin2: ['b03'] },
    };
    const start = make(config);
    expect(seen(start)['bins']).toEqual({ bin1: ['b01', 'b02', 'b06'], bin2: ['b03'] });
    expect(seen(start)['removed']).toEqual([]);

    const taken = run(start, [move('b06', 'tray')]);
    expect(seen(taken)['removed']).toEqual(['b06']);
    expect(holds('removedOnly', seen(taken), { cards: ['b06'] })).toBe(true);
    expect(holds('removedOnly', seen(taken), { cards: ['b06', 'b01'] })).toBe(false);
    expect(holds('removedOnly', seen(start), { cards: [] })).toBe(true);

    const twice = run(taken, [move('b01', 'tray')]);
    expect(holds('removedOnly', seen(twice), { cards: ['b06'] })).toBe(false);
    expect(holds('removedOnly', seen(twice), { cards: ['b01', 'b06'] })).toBe(true);

    // 꺼낸 카드를 다른 상자에 넣으면 꺼낸 카드가 아니다.
    const moved = run(taken, [move('b06', 'bin2')]);
    expect(seen(moved)['removed']).toEqual([]);
  });
});

describe('reset·직렬화·이벤트', () => {
  it('reset은 처음 상태로 돌린다(기준·기록·개수 포함)', () => {
    const start = make(BY_COLOR);
    const after = run(start, [
      { type: 'choose-criterion', criterion: 'color' },
      move('b01', 'bin1'),
      { type: 'reset' },
    ]);
    expect(after).toEqual(start);
  });

  it('상태는 JSON 왕복을 거쳐도 같은 결과를 낸다', () => {
    const state = run(
      make({
        mode: 'sort',
        deck: 'classroom-objects-12',
        criterionChoice: ['shapeFamily', 'color'],
        countTable: 'student',
      }),
      [
        { type: 'choose-criterion', criterion: 'shapeFamily' },
        move('o-eraser', 'bin1'),
        move('o-glue', 'bin2'),
      ],
    );
    assertSerializable(state);
    assertSerializable(seen(state));
    const copy = JSON.parse(JSON.stringify(state)) as SorterState;
    expect(copy).toEqual(state);
    expect(seen(copy)).toEqual(seen(state));
    expect(reduce(copy, move('o-ball', 'bin3'))).toEqual(reduce(state, move('o-ball', 'bin3')));
  });

  it('관찰 결과에는 정답 개수 표시가 없다(valueCounts는 기준을 고른 뒤에만)', () => {
    const observation = seen(make(BY_COLOR));
    expect(Object.keys(observation)).not.toContain('answer');
    expect(observation['valueCounts']).toEqual({});
  });

  it('이벤트: 카드를 넣으면 card-placed, 기준을 고르면 criterion-chosen, 다 넣으면 all-placed', () => {
    const start = make({ mode: 'sort', bins: 2, cards: ['b01', 'b02'] });
    const first = reduce(start, move('b01', 'bin1'));
    expect(emit(start, first, move('b01', 'bin1')).map((event) => event.name)).toEqual([
      'card-placed',
    ]);
    const last = reduce(first, move('b02', 'bin2'));
    expect(emit(first, last, move('b02', 'bin2')).map((event) => event.name)).toEqual([
      'card-placed',
      'all-placed',
    ]);
    expect(emit(first, first, move('b01', 'bin1'))).toEqual([]);

    const chooser = make(BY_COLOR);
    const chosen = reduce(chooser, { type: 'choose-criterion', criterion: 'color' });
    expect(emit(chooser, chosen, { type: 'choose-criterion', criterion: 'color' })).toEqual([
      { name: 'criterion-chosen', payload: { criterion: 'color' } },
    ]);
  });

  it('allPlaced predicate', () => {
    const start = make({ mode: 'sort', bins: 1, cards: ['b01'] });
    expect(holds('allPlaced', seen(start))).toBe(false);
    expect(holds('allPlaced', seen(run(start, [move('b01', 'bin1')])))).toBe(true);
  });
});
