import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { emit, predicates, receive } from '../events';
import { observe } from '../observe';
import { canDealRound, createInitialState, reduce } from '../reduce';
import type { BaseTenConfig, BaseTenState, BlockValue } from '../types';
import { countsOf, valueOf } from '../value';

function stateOf(config: BaseTenConfig): BaseTenState {
  return createInitialState(config);
}

function pileIds(state: BaseTenState, value: BlockValue): string[] {
  return state.blocks
    .filter((block) => block.plate === undefined && block.value === value)
    .map((block) => block.id);
}

function dealRoundMany(state: BaseTenState, value: BlockValue, count: number): BaseTenState {
  let next = state;
  for (let index = 0; index < count; index += 1) {
    next = reduce(next, { type: 'deal-round', value });
  }
  return next;
}

describe('E01 decimal 해석', () => {
  it('start.value "6.24"를 판 6·막대 2·낱개 4로 놓는다', () => {
    const state = stateOf({ mode: 'decimal', start: { value: '6.24' } });
    expect(countsOf(state)).toEqual({ thousands: 0, hundreds: 6, tens: 2, ones: 4 });
    expect(state.blocks.filter((block) => block.value === 100)).toHaveLength(6);
    expect(state.blocks.filter((block) => block.value === 10)).toHaveLength(2);
    expect(state.blocks.filter((block) => block.value === 1)).toHaveLength(4);
    expect(valueOf(state)).toBe(624);

    const observation = observe(state, { mode: 'decimal' });
    expect(observation.value).toBe('6.24');
    expect(observation.counts).toEqual({ ones: 6, tenths: 2, hundredths: 4 });
    expect(observation.canonical).toBe(true);
    expect(predicates.valueIs?.(observation, { value: '6.24' })).toBe(true);
    expect(predicates.valueIs?.(observation, { value: 6.24 })).toBe(true);
    expect(predicates.valueIs?.(observation, { value: 624 })).toBe(false);
    expect(predicates.countsAre?.(observation, { hundredths: 4 })).toBe(true);
    expect(predicates.blocksAtLeast?.(observation, { value: 100, min: 6 })).toBe(true);
  });

  it('막대 하나를 풀어도 값은 그대로이고 broken 이벤트는 소수 문자열이다', () => {
    const state = stateOf({ mode: 'decimal', start: { value: '6.24' } });
    const bar = state.blocks.find((block) => block.value === 10);
    if (!bar) throw new Error('막대가 없습니다.');
    const broken = reduce(state, { type: 'break', id: bar.id });

    expect(countsOf(broken)).toEqual({ thousands: 0, hundreds: 6, tens: 1, ones: 14 });
    expect(observe(broken, { mode: 'decimal' }).value).toBe('6.24');
    expect(emit(state, broken)).toEqual([
      {
        name: 'broken',
        payload: { from: '0.1', to: '0.01', column: -1 },
      },
    ]);
  });

  it('0.1 + 0.2를 부동소수 없이 정확히 "0.3"으로 읽는다', () => {
    let state = stateOf({ mode: 'decimal', start: { value: '0.2' } });
    state = reduce(state, { type: 'add', value: 10, x: 200, y: 200 });
    expect(observe(state, { mode: 'decimal' }).value).toBe('0.3');
    expect(observe(state, { mode: 'decimal' }).counts).toEqual({
      ones: 0,
      tenths: 3,
      hundredths: 0,
    });
  });

  it('decimal에서는 1000 블록을 쓰지 않고 100 열 개도 더 묶지 않는다', () => {
    const state = stateOf({
      mode: 'decimal',
      allowedBlocks: [1, 10, 100, 1000],
      start: { hundreds: 10 },
    });
    expect(state.settings.allowedBlocks).toEqual([1, 10, 100]);
    expect(state.blocks.every((block) => block.value !== 1000)).toBe(true);

    const grouped = reduce(state, { type: 'group-tens' });
    expect(grouped).toBe(state);
    const lasso = reduce(state, {
      type: 'lasso-group',
      ids: state.blocks.map((block) => block.id),
    });
    expect(lasso.lastAttempt?.ok).toBe(false);
  });

  it('start.value가 자리별 개수보다 이기고 잘못된 값은 빈 판이 된다', () => {
    const state = stateOf({
      mode: 'decimal',
      start: { ones: 7, value: '1.02' },
    });
    expect(countsOf(state)).toEqual({ thousands: 0, hundreds: 1, tens: 0, ones: 2 });

    const invalid = stateOf({ mode: 'decimal', start: { value: '1.234' } });
    expect(invalid.blocks).toHaveLength(0);
    const negative = stateOf({ mode: 'decimal', start: { value: '-1.2' } });
    expect(negative.blocks).toHaveLength(0);
  });

  it('decimal 자릿값 표는 소수 문자열을 읽는다', () => {
    let state = stateOf({ mode: 'decimal' });
    expect(state.settings.chartColumns).toEqual([0, -1, -2]);
    state = reduce(state, { type: 'set-digit', column: 0, digit: 6 });
    state = reduce(state, { type: 'set-digit', column: -1, digit: 2 });
    state = reduce(state, { type: 'set-digit', column: -2, digit: 4 });
    const observation = observe(state, { mode: 'decimal' });
    expect(observation.chartValue).toBe('6.24');
    expect(predicates.chartIs?.(observation, { value: '6.24' })).toBe(true);
  });
});

describe('E01 big-number', () => {
  it('오른쪽에서 센 위치로 자르고 정렬·중복을 정리한다', () => {
    let state = stateOf({ mode: 'big-number', value: '52840000' });
    expect(state.bigNumber?.cuts).toEqual([]);
    state = reduce(state, { type: 'cut', position: 4 });
    state = reduce(state, { type: 'cut', position: 4 });
    state = reduce(state, { type: 'cut', position: 8 });
    state = reduce(state, { type: 'cut', position: 0 });
    expect(state.bigNumber?.cuts).toEqual([4]);
    expect(observe(state, { mode: 'big-number' }).cutsCorrect).toBe(true);
    expect(predicates.cutsAre?.(observe(state, { mode: 'big-number' }), { positions: [4] })).toBe(
      true,
    );

    state = reduce(state, { type: 'uncut', position: 4 });
    expect(state.bigNumber?.cuts).toEqual([]);
    expect(observe(state, { mode: 'big-number' }).cutsCorrect).toBe(false);
  });

  it('16자리 값은 4·8·12에서 잘라야 맞고 4자리 이하는 자르지 않는 것이 정답이다', () => {
    const auto = stateOf({ mode: 'big-number', value: '1234567890123456', slicer: 'auto' });
    expect(auto.bigNumber?.cuts).toEqual([4, 8, 12]);
    expect(observe(auto, { mode: 'big-number' }).cutsCorrect).toBe(true);

    const short = stateOf({ mode: 'big-number', value: '5284' });
    expect(observe(short, { mode: 'big-number' }).cutsCorrect).toBe(true);
    const oneCut = reduce(short, { type: 'cut', position: 2 });
    expect(observe(oneCut, { mode: 'big-number' }).cutsCorrect).toBe(false);
  });

  it('자릿수를 고르고 덩어리를 펼친다', () => {
    let state = stateOf({ mode: 'big-number', value: '52840000' });
    state = reduce(state, { type: 'select-digit', position: 7 });
    state = reduce(state, { type: 'expand', group: 1 });
    const observation = observe(state, { mode: 'big-number' });
    expect(observation.selectedPlace).toBe(7);
    expect(predicates.selectedPlaceIs?.(observation, { exponent: 7 })).toBe(true);
    expect(observation.expanded).toBe(1);
    state = reduce(state, { type: 'expand', group: 1 });
    expect(observe(state, { mode: 'big-number' }).expanded).toBeNull();
  });

  it('reverse는 16칸에 숫자를 놓고 가운데 빈칸을 읽는다', () => {
    let state = stateOf({ mode: 'big-number', reverse: { spoken: '이천삼십만 오' } });
    const observation = observe(state, { mode: 'big-number' });
    expect(observation.digits).toBe('');
    expect(observation.built).toBeNull();
    expect(observation.builtHasGap).toBe(true);

    state = reduce(state, { type: 'place-card', cell: 15, digit: 5 });
    expect(observe(state, { mode: 'big-number' }).built).toBe('5');
    state = reduce(state, { type: 'place-card', cell: 13, digit: 2 });
    expect(observe(state, { mode: 'big-number' }).built).toBeNull();
    expect(observe(state, { mode: 'big-number' }).builtHasGap).toBe(true);
    state = reduce(state, { type: 'place-card', cell: 14, digit: 3 });
    const filled = observe(state, { mode: 'big-number' });
    expect(filled.built).toBe('235');
    expect(filled.builtHasGap).toBe(false);
    expect(predicates.builtIs?.(filled, { value: '235' })).toBe(true);

    state = reduce(state, { type: 'clear-cell', cell: 14 });
    expect(observe(state, { mode: 'big-number' }).built).toBeNull();
  });

  it('상태는 JSON으로 저장할 수 있다', () => {
    const state = stateOf({ mode: 'big-number', value: '1234567890123456', slicer: 'auto' });
    assertSerializable(state);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('E01 divide', () => {
  it('52÷4를 한 바퀴·풀기로 끝내면 접시가 모두 13이고 나머지는 0이다', () => {
    const start = stateOf({ mode: 'divide', dividend: 52, divisor: 4 });
    let state = start;
    expect(state.divide).toEqual({ plates: 4, rewound: false });
    expect(countsOf(state)).toEqual({ thousands: 0, hundreds: 0, tens: 5, ones: 2 });

    state = dealRoundMany(state, 10, 1);
    let observation = observe(state, { mode: 'divide' });
    expect(observation.plateValues).toEqual([10, 10, 10, 10]);
    expect(observation.equal).toBe(true);
    // 십 5개 중 4개를 나눠 주고, 무더기에는 십 1개 + 낱개 2개 = 12가 남는다.
    expect(observation.pileValue).toBe(12);
    expect(canDealRound(state, 10)).toBe(false);
    // 낱개는 아직 2개뿐이라 한 바퀴(접시 4개)를 돌 수 없다.
    expect(canDealRound(state, 1)).toBe(false);

    const progress = emit(start, state).find((event) => event.name === 'divide-progress');
    const payload = progress?.payload as
      { columns: { column: number; perPlate: number | null; pile: number }[] } | undefined;
    // 접시마다 십이 하나씩 놓였으므로, 무더기에 하나가 남아도 perPlate는 1이다.
    expect(payload?.columns.find((row) => row.column === 1)).toEqual({
      column: 1,
      perPlate: 1,
      pile: 1,
    });

    const ten = pileIds(state, 10)[0];
    if (!ten) throw new Error('무더기 십이 없습니다.');
    state = reduce(state, { type: 'break', id: ten });
    expect(observe(state, { mode: 'divide' }).pileCounts).toEqual({
      thousands: 0,
      hundreds: 0,
      tens: 0,
      ones: 12,
    });

    state = dealRoundMany(state, 1, 3);
    observation = observe(state, { mode: 'divide' });
    expect(observation.plateValues).toEqual([13, 13, 13, 13]);
    expect(observation.pileValue).toBe(0);
    expect(observation.equal).toBe(true);
    expect(predicates.platesEqual?.(observation, undefined)).toBe(true);
    expect(predicates.plateValueIs?.(observation, { value: 13 })).toBe(true);
    expect(predicates.pileValueIs?.(observation, { value: 0 })).toBe(true);
    expect(predicates.valueIs?.(observation, { value: 52 })).toBe(true);

    // 접시 값은 높이 막대로만 비교하지 숫자로 쓰지 않는다(Observation으로만 확인한다).
    expect(state.blocks.filter((block) => block.plate !== undefined)).toHaveLength(16);
  });

  it('47÷3은 접시마다 15, 무더기에 2가 남는다', () => {
    let state = stateOf({ mode: 'divide', dividend: 47, divisor: 3 });
    state = dealRoundMany(state, 10, 1);
    const ten = pileIds(state, 10)[0];
    if (!ten) throw new Error('무더기 십이 없습니다.');
    state = reduce(state, { type: 'break', id: ten });
    state = dealRoundMany(state, 1, 5);

    const observation = observe(state, { mode: 'divide' });
    expect(observation.plateValues).toEqual([15, 15, 15]);
    expect(observation.pileValue).toBe(2);
    expect(predicates.pileValueIs?.(observation, { value: 2 })).toBe(true);
    expect(predicates.platesEqual?.(observation, undefined)).toBe(true);
  });

  it('408÷4에서 십 자리는 접시마다 0으로 읽힌다', () => {
    let state = stateOf({ mode: 'divide', dividend: 408, divisor: 4 });
    const before = state;
    state = dealRoundMany(state, 100, 1);
    state = dealRoundMany(state, 1, 2);
    const observation = observe(state, { mode: 'divide' });
    expect(observation.plateValues).toEqual([102, 102, 102, 102]);

    const progress = emit(before, state).find((event) => event.name === 'divide-progress');
    const payload = progress?.payload as
      { columns: { column: number; perPlate: number | null; pile: number }[] } | undefined;
    const tens = payload?.columns.find((row) => row.column === 1);
    expect(tens).toEqual({ column: 1, perPlate: 0, pile: 0 });
  });

  it('6.24÷3을 소수로 나누면 접시마다 2.08이다', () => {
    let state = stateOf({
      mode: 'divide',
      interpretation: 'decimal',
      dividend: '6.24',
      divisor: 3,
    });
    state = dealRoundMany(state, 100, 2);
    for (const id of pileIds(state, 10)) {
      state = reduce(state, { type: 'break', id });
    }
    state = dealRoundMany(state, 1, 8);

    const observation = observe(state, { mode: 'divide' });
    expect(observation.plateValues).toEqual(['2.08', '2.08', '2.08']);
    expect(observation.pileValue).toBe('0');
    expect(observation.value).toBe('6.24');
    expect(predicates.plateValueIs?.(observation, { value: '2.08' })).toBe(true);
    expect(predicates.valueIs?.(observation, { value: '6.24' })).toBe(true);
  });

  it('접시에 놓인 블록은 풀리지 않고 무더기 블록만 풀린다', () => {
    let state = stateOf({ mode: 'divide', dividend: 52, divisor: 4 });
    state = reduce(state, { type: 'deal-round', value: 10 });
    const plated = state.blocks.find((block) => block.plate !== undefined && block.value === 10);
    if (!plated) throw new Error('접시 십이 없습니다.');
    expect(reduce(state, { type: 'break', id: plated.id })).toBe(state);
  });

  it('되감기는 접시 블록을 모두 무더기로 모으고 값을 바꾸지 않는다', () => {
    let state = stateOf({
      mode: 'divide',
      dividend: 52,
      divisor: 4,
      rewindCheck: true,
    });
    state = reduce(state, { type: 'deal-round', value: 10 });
    const before = observe(state, { mode: 'divide' }).value;
    state = reduce(state, { type: 'rewind' });

    const observation = observe(state, { mode: 'divide' });
    expect(observation.rewound).toBe(true);
    expect(observation.value).toBe(before);
    expect(observation.plateValues).toEqual([0, 0, 0, 0]);
    expect(state.blocks.every((block) => block.plate === undefined)).toBe(true);
    expect(state.log.at(-1)).toEqual({ kind: 'rewind' });
    expect(predicates.rewound?.(observation, undefined)).toBe(true);

    state = reduce(state, { type: 'deal-block', id: pileIds(state, 10)[0] as string, plate: 0 });
    expect(observe(state, { mode: 'divide' }).rewound).toBe(false);
  });

  it('receive는 rewind-requested만 되감기로 바꾸고 상태는 저장 가능하다', () => {
    const state = stateOf({ mode: 'divide', dividend: 52, divisor: 4, rewindCheck: true });
    expect(receive(state, { name: 'rewind-requested' })).toEqual({ type: 'rewind' });
    expect(receive(state, { name: 'value-changed' })).toBeNull();
    expect(receive(stateOf({ mode: 'count' }), { name: 'rewind-requested' })).toBeNull();
    assertSerializable(state);
  });
});
