import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { canGroupTens, createInitialState, reduce, seededRandom } from '../reduce';
import type { BaseTenConfig, BaseTenState, BlockValue } from '../types';
import { countsOf, digitAt, placeValueOf, valueOf } from '../value';
import { ADD_SUM, SUB_TAKE } from '../layout';

function stateOf(config: BaseTenConfig): BaseTenState {
  return createInitialState(config);
}

function idsOf(state: BaseTenState, value: BlockValue): string[] {
  return state.blocks.filter((block) => block.value === value).map((block) => block.id);
}

function addMany(state: BaseTenState, value: BlockValue, count: number): BaseTenState {
  let next = state;
  for (let index = 0; index < count; index += 1) {
    next = reduce(next, { type: 'add', value, x: 120 + index * 40, y: 200 });
  }
  return next;
}

describe('E01 올가미 묶기', () => {
  it('같은 블록 10개를 묶으면 상위 블록 하나가 된다', () => {
    const start = stateOf({ mode: 'count' });
    const withOnes = addMany(start, 1, 10);
    expect(withOnes.blocks).toHaveLength(10);

    const grouped = reduce(withOnes, { type: 'lasso-group', ids: idsOf(withOnes, 1) });
    expect(grouped.blocks).toHaveLength(1);
    expect(grouped.blocks[0]?.value).toBe(10);
    expect(grouped.log).toEqual([{ kind: 'group', from: 1 }]);
    expect(countsOf(grouped)).toEqual({ thousands: 0, hundreds: 0, tens: 1, ones: 0 });
    expect(grouped.lastAttempt).toBeNull();
  });

  it('9개는 묶지 않고 시도 개수만 남긴다', () => {
    const withOnes = addMany(stateOf({ mode: 'count' }), 1, 9);
    const grouped = reduce(withOnes, { type: 'lasso-group', ids: idsOf(withOnes, 1) });
    expect(grouped.blocks).toHaveLength(9);
    expect(grouped.log).toHaveLength(0);
    expect(grouped.lastAttempt).toEqual({ count: 9, value: 1, ok: false });
  });

  it('11개도 묶지 않는다', () => {
    const withOnes = addMany(stateOf({ mode: 'count' }), 1, 11);
    const grouped = reduce(withOnes, { type: 'lasso-group', ids: idsOf(withOnes, 1) });
    expect(grouped.blocks).toHaveLength(11);
    expect(grouped.lastAttempt).toEqual({ count: 11, value: 1, ok: false });
  });

  it('값이 섞이면 묶지 않고 value는 null', () => {
    let state = addMany(stateOf({ mode: 'count' }), 1, 5);
    state = addMany(state, 10, 5);
    const ids = [...idsOf(state, 1), ...idsOf(state, 10)];
    const grouped = reduce(state, { type: 'lasso-group', ids });
    expect(grouped.blocks).toHaveLength(10);
    expect(grouped.lastAttempt).toEqual({ count: 10, value: null, ok: false });
  });

  it('1000 블록은 열 개라도 더 묶지 않는다', () => {
    const state = stateOf({
      mode: 'count',
      allowedBlocks: [1000],
      start: { thousands: 10 },
    });
    const grouped = reduce(state, { type: 'lasso-group', ids: idsOf(state, 1000) });
    expect(grouped.blocks).toHaveLength(10);
    expect(grouped.lastAttempt).toEqual({ count: 10, value: 1000, ok: false });
  });

  it('없는 id가 섞이면 상태를 바꾸지 않는다', () => {
    const withOnes = addMany(stateOf({ mode: 'count' }), 1, 10);
    const grouped = reduce(withOnes, {
      type: 'lasso-group',
      ids: [...idsOf(withOnes, 1).slice(1), 'nope'],
    });
    expect(grouped).toBe(withOnes);
  });
});

describe('E01 "10개 묶기" 버튼', () => {
  it('낱개 34개를 세 번 묶으면 십 3·일 4가 된다', () => {
    let state = addMany(stateOf({ mode: 'regroup' }), 1, 34);
    expect(canGroupTens(state)).toBe(true);

    state = reduce(state, { type: 'group-tens' });
    state = reduce(state, { type: 'group-tens' });
    state = reduce(state, { type: 'group-tens' });

    expect(countsOf(state)).toEqual({ thousands: 0, hundreds: 0, tens: 3, ones: 4 });
    expect(valueOf(state)).toBe(34);
    expect(state.log.filter((entry) => entry.kind === 'group')).toHaveLength(3);
  });

  it('열 개가 모자라면 아무 일도 하지 않는다', () => {
    const state = addMany(stateOf({ mode: 'regroup' }), 1, 9);
    expect(canGroupTens(state)).toBe(false);
    expect(reduce(state, { type: 'group-tens' })).toBe(state);
  });

  it('lasso가 꺼져 있어도 버튼은 쓸 수 있다', () => {
    const base = stateOf({ mode: 'count', lasso: false });
    const state = addMany(base, 10, 10);
    expect(state.settings.lasso).toBe(false);
    const grouped = reduce(state, { type: 'group-tens' });
    expect(grouped.blocks).toHaveLength(1);
    expect(grouped.blocks[0]?.value).toBe(100);
  });

  it('여러 값이 있으면 작은 값부터 묶는다', () => {
    let state = addMany(stateOf({ mode: 'regroup' }), 10, 10);
    state = addMany(state, 1, 10);
    const grouped = reduce(state, { type: 'group-tens' });
    expect(countsOf(grouped)).toEqual({ thousands: 0, hundreds: 0, tens: 11, ones: 0 });
    expect(grouped.log).toEqual([{ kind: 'group', from: 1 }]);
  });
});

describe('E01 풀기', () => {
  it('백 블록을 풀면 십 10개가 되고 수는 그대로다', () => {
    const state = addMany(stateOf({ mode: 'regroup' }), 100, 1);
    const block = state.blocks[0];
    if (!block) throw new Error('블록이 없다');
    const broken = reduce(state, { type: 'break', id: block.id });
    expect(broken.blocks).toHaveLength(10);
    expect(broken.blocks.every((item) => item.value === 10)).toBe(true);
    expect(valueOf(broken)).toBe(valueOf(state));
    expect(broken.log).toEqual([{ kind: 'break', from: 100 }]);
  });

  it('낱개는 풀지 않는다', () => {
    const state = addMany(stateOf({ mode: 'count' }), 1, 1);
    const block = state.blocks[0];
    if (!block) throw new Error('블록이 없다');
    expect(reduce(state, { type: 'break', id: block.id })).toBe(state);
  });

  it('풀기 순서가 log에 남는다', () => {
    const state = addMany(stateOf({ mode: 'regroup' }), 100, 1);
    const hundred = state.blocks[0];
    if (!hundred) throw new Error('블록이 없다');
    const brokenHundred = reduce(state, { type: 'break', id: hundred.id });
    const ten = brokenHundred.blocks[0];
    if (!ten) throw new Error('십 블록이 없다');
    const brokenTen = reduce(brokenHundred, { type: 'break', id: ten.id });
    expect(brokenTen.log).toEqual([
      { kind: 'break', from: 100 },
      { kind: 'break', from: 10 },
    ]);
  });

  it('regroupAllowed=false인 add-sub에서는 상위 블록을 풀지 않는다', () => {
    const state = stateOf({ mode: 'add-sub', op: 'add', a: 23, b: 14, regroupAllowed: false });
    const ten = state.blocks.find((block) => block.value === 10);
    if (!ten) throw new Error('십 블록이 없다');
    expect(reduce(state, { type: 'break', id: ten.id })).toBe(state);
  });
});

describe('E01 createInitialState', () => {
  it('scattered 낱개는 seed가 같으면 같은 자리, 다르면 다른 자리', () => {
    const config: BaseTenConfig = {
      mode: 'count',
      start: { ones: 12, scattered: true, seed: 7 },
    };
    const first = createInitialState(config);
    const second = createInitialState(config);
    expect(first.blocks).toEqual(second.blocks);
    expect(first.blocks).not.toHaveLength(0);

    const other = createInitialState({
      mode: 'count',
      start: { ones: 12, scattered: true, seed: 8 },
    });
    expect(other.blocks.map((block) => block.y)).not.toEqual(first.blocks.map((block) => block.y));
  });

  it('seed 난수는 같은 seed에서 같은 수열을 낸다', () => {
    const a = seededRandom(3);
    const b = seededRandom(3);
    const first = [a(), a(), a()];
    const second = [b(), b(), b()];
    expect(first).toEqual(second);
  });

  it('start의 자리별 블록 수를 지킨다', () => {
    const state = stateOf({
      mode: 'count',
      start: { thousands: 1, hundreds: 2, tens: 3, ones: 4 },
    });
    expect(countsOf(state)).toEqual({ thousands: 1, hundreds: 2, tens: 3, ones: 4 });
    expect(valueOf(state)).toBe(1234);
    expect(observe(state, { mode: 'count' }).value).toBe(1234);
  });

  it('아무 설정이 없으면 count 모드로 시작한다', () => {
    expect(stateOf({}).mode).toBe('count');
    expect(stateOf({ op: 'add', a: 1, b: 2 }).mode).toBe('add-sub');
    expect(stateOf({ digits: [1, 2] }).mode).toBe('place-chart');
  });

  it('초기 상태는 JSON 직렬화할 수 있다', () => {
    const state = stateOf({
      mode: 'add-sub',
      op: 'add',
      a: 34,
      b: 27,
      start: { ones: 3 },
    });
    assertSerializable(state);
  });
});

describe('E01 add-sub', () => {
  it('add는 모으기 칸 값이 지금 수이고, 모으면 a+b가 된다', () => {
    const state = stateOf({ mode: 'add-sub', op: 'add', a: 23, b: 14 });
    expect(valueOf(state)).toBe(0);

    let next = state;
    for (const block of state.blocks) {
      next = reduce(next, { type: 'move', id: block.id, x: 500, y: 450 });
    }
    expect(valueOf(next)).toBe(37);
    expect(countsOf(next)).toEqual({ thousands: 0, hundreds: 0, tens: 3, ones: 7 });
    expect(next.blocks.every((block) => block.zone === 'sum')).toBe(true);
    expect(ADD_SUM.y).toBeLessThan(450);
  });

  it('sub는 빼기 접시에 놓은 만큼 줄어든다', () => {
    const state = stateOf({ mode: 'add-sub', op: 'sub', a: 32, b: 12 });
    expect(valueOf(state)).toBe(32);
    const ones = idsOf(state, 1);
    const first = ones[0];
    if (!first) throw new Error('낱개가 없다');
    const next = reduce(state, { type: 'move', id: first, x: 700, y: 300 });
    expect(next.blocks.find((block) => block.id === first)?.zone).toBe('take');
    expect(observe(next, { mode: 'add-sub' }).taken).toBe(1);
    expect(valueOf(next)).toBe(31);
    expect(SUB_TAKE.x).toBeLessThan(700);
  });

  it('no-negative-take: b의 그 자리 숫자보다 많이 놓지 못한다', () => {
    const state = stateOf({
      mode: 'add-sub',
      op: 'sub',
      a: 32,
      b: 12,
      constraint: 'no-negative-take',
    });
    let next = state;
    for (const id of idsOf(state, 1)) {
      next = reduce(next, { type: 'move', id, x: 700, y: 300 });
    }
    expect(next.blocks.filter((block) => block.zone === 'take' && block.value === 1)).toHaveLength(
      2,
    );

    const ten = idsOf(state, 10)[0];
    if (!ten) throw new Error('십 블록이 없다');
    next = reduce(next, { type: 'move', id: ten, x: 700, y: 300 });
    expect(next.blocks.filter((block) => block.zone === 'take' && block.value === 10)).toHaveLength(
      1,
    );
    // b의 십 자리 숫자가 1이므로 두 번째 십은 놓이지 않는다.
    const another = addMany(next, 10, 1);
    const extra = another.blocks.filter((block) => block.value === 10).at(-1);
    if (!extra) throw new Error('십 블록이 없다');
    const rejected = reduce(another, { type: 'move', id: extra.id, x: 700, y: 300 });
    expect(rejected.blocks.find((block) => block.id === extra.id)?.zone).not.toBe('take');
  });

  it('b를 빼지 않고 그대로 두면 처음 수가 유지된다', () => {
    const state = stateOf({ mode: 'add-sub', op: 'sub', a: 45, b: 27 });
    expect(state.blocks.some((block) => block.zone === 'b')).toBe(false);
    expect(valueOf(state)).toBe(45);
  });
});

describe('E01 place-chart', () => {
  const config: BaseTenConfig = {
    mode: 'place-chart',
    columns: [1, 0],
    digits: [3, 7],
    chartFill: 'student',
  };

  it('숫자 카드를 놓으면 그 수만큼 블록이 생긴다', () => {
    const state = stateOf(config);
    expect(state.chart).toEqual([null, null]);

    const placed = reduce(state, { type: 'place-digit', index: 0, column: 1 });
    expect(countsOf(placed).tens).toBe(3);
    expect(valueOf(placed)).toBe(30);
    expect(placed.chart?.[0]).toBe('3');
  });

  it('양방향: 블록을 더하면 칸 숫자가 따라 바뀐다', () => {
    const state = reduce(stateOf(config), { type: 'place-digit', index: 0, column: 1 });
    const added = reduce(state, { type: 'add', value: 10, x: 300, y: 200 });
    expect(countsOf(added).tens).toBe(4);
    expect(added.chart?.[0]).toBe('4');
    expect(observe(added, config).chartValue).toBe(40);
  });

  it('양방향: 낱개 칸 숫자를 놓으면 블록도 그만큼 생긴다', () => {
    let state = reduce(stateOf(config), { type: 'place-digit', index: 1, column: 0 });
    expect(countsOf(state).ones).toBe(7);
    // 칸 숫자를 다시 쓰면(set-digit) 블록은 자동으로 따라오지 않는다(학생이 손으로 맞춘다).
    state = reduce(state, { type: 'set-digit', column: 0, digit: 2 });
    expect(state.chart?.[1]).toBe('2');
    expect(countsOf(state).ones).toBe(7);
  });

  it('한 칸에 10개가 되면 "10"을 그대로 보여 준다(자동 묶기 없음)', () => {
    let state = reduce(stateOf(config), { type: 'place-digit', index: 0, column: 1 });
    state = addMany(state, 10, 7);
    expect(countsOf(state).tens).toBe(10);
    expect(state.chart?.[0]).toBe('10');
  });

  it('카드를 다른 칸으로 옮기면 이전 칸의 블록은 사라진다', () => {
    let state = reduce(stateOf(config), { type: 'place-digit', index: 0, column: 1 });
    state = reduce(state, { type: 'place-digit', index: 0, column: 0 });
    expect(countsOf(state).tens).toBe(0);
    expect(countsOf(state).ones).toBe(3);
  });
});

describe('E01 값 계산과 한계', () => {
  it('digitAt과 placeValueOf가 자릿값을 읽는다', () => {
    expect(digitAt(5072, 3)).toBe(5);
    expect(digitAt(5072, 2)).toBe(0);
    expect(digitAt(5072, 1)).toBe(7);
    expect(digitAt(5072, 0)).toBe(2);
    expect(placeValueOf(4)).toBeNull();
  });

  it('maxValue를 넘게 만드는 add는 무시한다', () => {
    let state = stateOf({ mode: 'count', maxValue: 12, start: { ones: 2 } });
    state = reduce(state, { type: 'add', value: 10, x: 400, y: 200 });
    expect(valueOf(state)).toBe(12);
    const blocked = reduce(state, { type: 'add', value: 1, x: 400, y: 200 });
    expect(blocked).toBe(state);
  });

  it('allowedBlocks에 없는 블록은 놓을 수 없다', () => {
    const state = stateOf({ mode: 'count', allowedBlocks: [1, 10] });
    expect(reduce(state, { type: 'add', value: 100, x: 400, y: 200 })).toBe(state);
  });

  it('블록을 휴지통으로 옮기면 remove로 사라진다', () => {
    const state = addMany(stateOf({ mode: 'count' }), 10, 1);
    const block = state.blocks[0];
    if (!block) throw new Error('블록이 없다');
    const removed = reduce(state, { type: 'remove', id: block.id });
    expect(removed.blocks).toHaveLength(0);
  });

  it('모든 Action 뒤에도 상태는 직렬화 가능하다', () => {
    const state = addMany(stateOf({ mode: 'count', lasso: true }), 1, 10);
    const grouped = reduce(state, { type: 'group-tens' });
    const first = grouped.blocks[0];
    if (!first) throw new Error('블록이 없다');
    const broken = reduce(grouped, { type: 'break', id: first.id });
    assertSerializable(grouped);
    assertSerializable(broken);
    expect(JSON.parse(JSON.stringify(broken))).toEqual(broken);
  });
});

describe('E01 observe와 predicates', () => {
  it('관찰 값에 판정에 필요한 것만 담는다', () => {
    const state = addMany(stateOf({ mode: 'count' }), 1, 10);
    const grouped = reduce(state, { type: 'group-tens' });
    const observation = observe(grouped, { mode: 'count' });
    expect(observation.value).toBe(10);
    expect(observation.groups).toBe(1);
    expect(observation.breaks).toBe(0);
    expect(observation.canonical).toBe(true);
    expect(observation.chartDigits).toBeNull();
    expect(observation.reachedHundred).toBeNull();

    const withReveal = observe(grouped, { mode: 'count', allowHundredReveal: true });
    expect(withReveal.reachedHundred).toBe(false);
  });

  it('valueIs·countsAre·groupedAtLeast·brokeAtLeast가 동작한다', () => {
    const grouped = reduce(addMany(stateOf({ mode: 'count' }), 1, 10), { type: 'group-tens' });
    const observation = observe(grouped, { mode: 'count' });

    expect(predicates.valueIs?.(observation, { value: 10 })).toBe(true);
    expect(predicates.valueIs?.(observation, { value: 11 })).toBe(false);
    expect(predicates.countsAre?.(observation, { tens: 1, ones: 0 })).toBe(true);
    expect(predicates.countsAre?.(observation, { ones: 1 })).toBe(false);
    expect(predicates.groupedAtLeast?.(observation, { from: 1, count: 1 })).toBe(true);
    expect(predicates.groupedAtLeast?.(observation, { from: 1, count: 2 })).toBe(false);
    expect(predicates.brokeAtLeast?.(observation, { from: 10, count: 1 })).toBe(false);
    expect(predicates.canonical?.(observation, undefined)).toBe(true);
  });

  it('brokeBefore가 풀기 순서를 본다', () => {
    let state = addMany(stateOf({ mode: 'regroup' }), 100, 1);
    const hundred = state.blocks[0];
    if (!hundred) throw new Error('블록이 없다');
    state = reduce(state, { type: 'break', id: hundred.id });
    const ten = state.blocks[0];
    if (!ten) throw new Error('십 블록이 없다');
    state = reduce(state, { type: 'break', id: ten.id });

    const observation = observe(state, { mode: 'regroup' });
    expect(predicates.brokeBefore?.(observation, { first: 100, then: 10 })).toBe(true);
    expect(predicates.brokeBefore?.(observation, { first: 10, then: 100 })).toBe(false);
  });

  it('chartIs가 표의 수를 읽는다', () => {
    const config: BaseTenConfig = { mode: 'place-chart', columns: [1, 0], digits: [3, 4] };
    let state = reduce(stateOf(config), { type: 'place-digit', index: 0, column: 1 });
    state = reduce(state, { type: 'place-digit', index: 1, column: 0 });
    const observation = observe(state, config);
    expect(observation.chartDigits).toEqual(['3', '4']);
    expect(predicates.chartIs?.(observation, { value: 34 })).toBe(true);
    expect(predicates.chartIs?.(observation, { value: 43 })).toBe(false);
  });
});

describe('E01 이벤트', () => {
  it('grouped 이벤트를 낸다(묶어도 수는 그대로라 value-changed는 없다)', () => {
    const before = addMany(stateOf({ mode: 'count' }), 1, 10);
    const after = reduce(before, { type: 'group-tens' });
    const events = emit(before, after);
    expect(events).toEqual([{ name: 'grouped', payload: { from: 1, to: 10, column: 0 } }]);
  });

  it('수를 바꾸면 value-changed를 낸다', () => {
    const before = stateOf({ mode: 'count' });
    const after = reduce(before, { type: 'add', value: 10, x: 300, y: 300 });
    expect(emit(before, after)).toEqual([{ name: 'value-changed', payload: { value: 10 } }]);
  });

  it('broken 이벤트를 낸다', () => {
    const before = addMany(stateOf({ mode: 'regroup' }), 100, 1);
    const block = before.blocks[0];
    if (!block) throw new Error('블록이 없다');
    const after = reduce(before, { type: 'break', id: block.id });
    expect(emit(before, after)).toEqual([
      { name: 'broken', payload: { from: 100, to: 10, column: 2 } },
    ]);
  });

  it('바뀐 것이 없으면 이벤트가 없다', () => {
    const state = stateOf({ mode: 'count' });
    expect(emit(state, state)).toEqual([]);
  });
});
