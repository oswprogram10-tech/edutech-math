import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { alignedByPoint, complete, emit, hasMisconception, noErrors, resultIs } from '../events';
import { computeGrid } from '../grid';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { ColumnCalcAction, ColumnCalcConfig, ColumnCalcState, EditableRow } from '../types';

function apply(state: ColumnCalcState, action: ColumnCalcAction): ColumnCalcState {
  const next = reduce(state, action);
  assertSerializable(next);
  return next;
}

function enter(
  state: ColumnCalcState,
  row: EditableRow,
  column: number,
  digit: string | null,
): ColumnCalcState {
  return apply(state, { type: 'enter', row, column, digit });
}

function place(state: ColumnCalcState, number: 'a' | 'b', pointColumn: number): ColumnCalcState {
  return apply(state, { type: 'place', number, pointColumn });
}

function stateOf(config: ColumnCalcConfig): ColumnCalcState {
  return createInitialState(config);
}

function decimalState(a: string, b: string, op: 'add' | 'sub' = 'add'): ColumnCalcState {
  return stateOf({ mode: 'decimal', a, b, op });
}

function fillResult(
  state: ColumnCalcState,
  digits: ReadonlyArray<readonly [number, string]>,
): ColumnCalcState {
  return digits.reduce(
    (current, [column, digit]) => enter(current, 'result', column, digit),
    state,
  );
}

describe('E07 설정', () => {
  it('기본 add는 47과 25를 일의 자리에 맞춰 놓는다', () => {
    const state = stateOf({ mode: 'add' });
    expect(state.aText).toBe('47');
    expect(state.bText).toBe('25');
    expect(state.aPoint).toBe(0);
    expect(state.bPoint).toBe(0);
    expect(state.selected).toEqual({ row: 'result', column: 0 });
  });

  it('sub에서 a < b면 설정 오류로 보고 수를 바꾸지 않는다', () => {
    expect(() => stateOf({ mode: 'sub', a: '17', b: '52' })).toThrow(/설정/);
  });

  it('읽을 수 없는 수는 설정 오류다', () => {
    expect(() => stateOf({ mode: 'add', a: '4,7' })).toThrow(/설정/);
    expect(() => stateOf({ mode: 'decimal', a: '.5' })).toThrow(/설정/);
  });

  it('decimal은 카드를 놓기 전에는 소수점 판정이 없다', () => {
    const state = decimalState('3.5', '1.27');
    const observation = observe(state);
    expect(observation['alignment']).toBeNull();
    expect(observation['aligned']).toBe(false);
  });

  it('decimal은 카드를 놓기 전에도 놓을 수 있는 빈 열을 보여 준다', () => {
    const state = decimalState('3.5', '1.27');
    const grid = computeGrid(state);
    expect(grid.displayColumns.length).toBeGreaterThan(0);
    expect(grid.displayColumns).toContain(0);
    expect(grid.resultColumns).toEqual([]);
  });
});

describe('E07 add', () => {
  it('47 + 25 = 72를 칸마다 넣으면 완성된다', () => {
    let state = stateOf({ mode: 'add' });
    state = fillResult(state, [
      [0, '2'],
      [1, '7'],
    ]);

    const observation = observe(state);
    expect(observation['mode']).toBe('add');
    expect(observation['op']).toBe('add');
    expect(observation['a']).toBe('47');
    expect(observation['b']).toBe('25');
    expect(observation['alignment']).toBeNull();
    expect(observation['aligned']).toBe(true);
    expect(observation['complete']).toBe(true);
    expect(observation['resultRaw']).toBe('72');
    expect(observation['result']).toBe('72');
    expect(observation['wrongColumns']).toEqual([]);
    expect(observation['errors']).toEqual([]);
    expect(observation['misconceptions']).toEqual([]);
  });

  it('받아올림을 잊고 62를 쓰면 십의 자리에 MC-PV-NO-CARRY가 붙는다', () => {
    let state = stateOf({ mode: 'add' });
    state = fillResult(state, [
      [0, '2'],
      [1, '6'],
    ]);
    const observation = observe(state);
    expect(observation['wrongColumns']).toEqual([1]);
    expect(observation['errors']).toEqual([{ column: 1, code: 'MC-PV-NO-CARRY' }]);
    expect(observation['misconceptions']).toEqual(['MC-PV-NO-CARRY']);
    expect(observation['complete']).toBe(true);
    expect(observation['result']).toBe('62');
  });

  it('받아올림 수를 결과 칸에 그대로 써도 MC-PV-NO-CARRY다', () => {
    let state = stateOf({ mode: 'add' });
    state = fillResult(state, [
      [0, '2'],
      [1, '1'],
    ]);
    expect(observe(state)['misconceptions']).toEqual(['MC-PV-NO-CARRY']);
  });

  it('어떤 규칙에도 맞지 않으면 unknown이다', () => {
    let state = stateOf({ mode: 'add' });
    state = fillResult(state, [
      [0, '2'],
      [1, '9'],
    ]);
    expect(observe(state)['errors']).toEqual([{ column: 1, code: 'unknown' }]);
  });

  it('빈칸이 있으면 complete가 아니고 결과 값이 없다', () => {
    let state = stateOf({ mode: 'add' });
    state = enter(state, 'result', 0, '2');
    const observation = observe(state);
    expect(observation['complete']).toBe(false);
    expect(observation['result']).toBeNull();
    expect(observation['resultRaw']).toBe('2');
  });

  it('받아올림 칸은 Observation의 carries에 남는다', () => {
    let state = stateOf({ mode: 'add' });
    state = enter(state, 'carry', 1, '1');
    expect(state.carries).toEqual({ '1': '1' });
    expect(observe(state)['carries']).toEqual({ '1': '1' });
  });

  it('sub의 표시는 add에서 무시된다', () => {
    let state = stateOf({ mode: 'add' });
    state = apply(state, { type: 'toggle-cross', column: 0 });
    state = apply(state, { type: 'toggle-ten', column: 0 });
    expect(state.crosses).toEqual([]);
    expect(state.tens).toEqual([]);
  });
});

describe('E07 sub', () => {
  it('52 − 17 = 35를 바르게 넣으면 오류가 없다', () => {
    let state = stateOf({ mode: 'sub' });
    state = fillResult(state, [
      [0, '5'],
      [1, '3'],
    ]);
    const observation = observe(state);
    expect(observation['result']).toBe('35');
    expect(observation['wrongColumns']).toEqual([]);
    expect(observation['misconceptions']).toEqual([]);
  });

  it('받아내림 뒤 윗수를 줄이지 않은 45는 MC-PV-BORROW-NO-DECREMENT다', () => {
    let state = stateOf({ mode: 'sub' });
    state = fillResult(state, [
      [0, '5'],
      [1, '4'],
    ]);
    expect(observe(state)['errors']).toEqual([{ column: 1, code: 'MC-PV-BORROW-NO-DECREMENT' }]);
  });

  it('작은 수에서 큰 수를 거꾸로 뺀 26은 MC-SUB-SMALLER-FROM-LARGER다', () => {
    let state = stateOf({ mode: 'sub', a: '41', b: '17' });
    state = fillResult(state, [
      [0, '6'],
      [1, '2'],
    ]);
    expect(observe(state)['errors']).toEqual([{ column: 0, code: 'MC-SUB-SMALLER-FROM-LARGER' }]);
  });

  it('302 − 158 = 144처럼 받아내림이 이어져도 계산한다', () => {
    let state = stateOf({ mode: 'sub', a: '302', b: '158' });
    state = fillResult(state, [
      [0, '4'],
      [1, '4'],
      [2, '1'],
    ]);
    const observation = observe(state);
    expect(observation['result']).toBe('144');
    expect(observation['complete']).toBe(true);
    expect(observation['wrongColumns']).toEqual([]);
  });

  it('고친 수와 10 표시를 Action으로 기록한다', () => {
    let state = stateOf({ mode: 'sub' });
    state = apply(state, { type: 'toggle-cross', column: 1 });
    state = apply(state, { type: 'toggle-ten', column: 0 });
    state = enter(state, 'regroup', 1, '4');
    expect(state.crosses).toEqual([1]);
    expect(state.tens).toEqual([0]);
    expect(observe(state)['regroups']).toEqual({ '1': '4' });
    expect(state.regroups).toEqual({ '1': '4' });
  });
});

describe('E07 decimal', () => {
  it('소수점을 맞춰 3.5 + 1.27 = 4.77을 쓴다', () => {
    let state = decimalState('3.5', '1.27');
    expect(computeGrid(state).resultColumns).toEqual([]);

    state = place(state, 'a', 0);
    state = place(state, 'b', 0);
    const placed = observe(state);
    expect(placed['alignment']).toBe('point');
    expect(placed['aligned']).toBe(true);
    expect(state.selected).toEqual({ row: 'result', column: -2 });

    state = fillResult(state, [
      [-2, '7'],
      [-1, '7'],
      [0, '4'],
    ]);
    const observation = observe(state);
    expect(observation['complete']).toBe(true);
    expect(observation['resultRaw']).toBe('4.77');
    expect(observation['result']).toBe('4.77');
    expect(observation['wrongColumns']).toEqual([]);
    expect(observation['misconceptions']).toEqual([]);
  });

  it('오른쪽 끝을 맞춘 3.5와 1.27은 MC-DEC-ALIGN-RIGHT다', () => {
    let state = decimalState('3.5', '1.27');
    state = place(state, 'a', -1);
    state = place(state, 'b', 0);
    expect(observe(state)['alignment']).toBe('right-edge');
    expect(observe(state)['aligned']).toBe(false);

    state = fillResult(state, [
      [-2, '7'],
      [-1, '7'],
      [0, '4'],
    ]);
    const observation = observe(state);
    expect(observation['wrongColumns']).toEqual([-2, -1, 0]);
    expect(observation['misconceptions']).toEqual(['MC-DEC-ALIGN-RIGHT']);
    expect(observation['aligned']).toBe(false);
  });

  it('12.08 + 0.9처럼 자리 수가 달라도 계산한다', () => {
    let state = decimalState('12.08', '0.9');
    state = place(state, 'a', 0);
    state = place(state, 'b', 0);
    state = fillResult(state, [
      [-2, '8'],
      [-1, '9'],
      [0, '2'],
      [1, '1'],
    ]);
    const observation = observe(state);
    expect(observation['complete']).toBe(true);
    expect(observation['resultRaw']).toBe('12.98');
    expect(observation['result']).toBe('12.98');
    expect(observation['misconceptions']).toEqual([]);
  });

  it('5 − 1.36처럼 자리 수가 달라도 받아내림이 이어진다', () => {
    let state = decimalState('5', '1.36', 'sub');
    state = place(state, 'a', 0);
    state = place(state, 'b', 0);
    state = fillResult(state, [
      [-2, '4'],
      [-1, '6'],
      [0, '3'],
    ]);
    const observation = observe(state);
    expect(observation['resultRaw']).toBe('3.64');
    expect(observation['result']).toBe('3.64');
    expect(observation['wrongColumns']).toEqual([]);
    expect(observation['complete']).toBe(true);
  });

  it('소수점이 어긋나 다른 자리에 놓이면 alignment가 other다', () => {
    let state = decimalState('3.5', '1.27');
    state = place(state, 'a', 2);
    state = place(state, 'b', 0);
    expect(observe(state)['alignment']).toBe('other');
    expect(observe(state)['aligned']).toBe(false);
  });
});

describe('E07 0 채우기', () => {
  it('optional은 빈칸을 눌러 0을 채운다', () => {
    let state = decimalState('3.5', '1.27');
    state = place(state, 'a', 0);
    state = place(state, 'b', 0);
    expect(state.aPads).toEqual([]);
    state = apply(state, { type: 'pad-zero', number: 'a', column: -2 });
    expect(state.aPads).toEqual([-2]);
    // 이미 0을 채운 칸은 다시 바뀌지 않는다.
    expect(apply(state, { type: 'pad-zero', number: 'a', column: -2 })).toBe(state);
    // 숫자가 이미 있는 칸도 바뀌지 않는다.
    expect(apply(state, { type: 'pad-zero', number: 'b', column: 0 })).toBe(state);
  });

  it('off는 0 채우기를 막는다', () => {
    let state = decimalState('3.5', '1.27');
    state = place(state, 'a', 0);
    state = place(state, 'b', 0);
    const off = { ...state, padZeros: 'off' as const };
    expect(apply(off, { type: 'pad-zero', number: 'a', column: -2 })).toBe(off);
  });

  it('auto는 카드를 놓을 때 빈 자리를 0으로 채운다', () => {
    let state = stateOf({ mode: 'decimal', a: '3.5', b: '1.27', padZeros: 'auto' });
    state = place(state, 'a', 0);
    state = place(state, 'b', 0);
    expect(state.aPads).toEqual([-2]);
    expect(state.bPads).toEqual([]);
    // 채운 0은 계산에서도 0으로 읽힌다.
    state = fillResult(state, [
      [-2, '7'],
      [-1, '7'],
      [0, '4'],
    ]);
    expect(observe(state)['result']).toBe('4.77');
  });

  it('카드를 옮기면 이전 결과와 0 채우기를 비운다', () => {
    let state = decimalState('3.5', '1.27');
    state = place(state, 'a', 0);
    state = place(state, 'b', 0);
    state = fillResult(state, [
      [-2, '7'],
      [-1, '7'],
      [0, '4'],
    ]);
    state = place(state, 'a', -1);
    expect(state.result).toEqual({});
    expect(state.aPads).toEqual([]);
    expect(state.bPads).toEqual([]);
  });
});

describe('E07 판정 함수와 이벤트', () => {
  it('events 목록의 payload를 만든다', () => {
    let state = stateOf({ mode: 'add' });
    const before = state;
    state = enter(state, 'result', 0, '2');
    const entered = emit(before, state, { type: 'enter', row: 'result', column: 0, digit: '2' });
    expect(entered[0]).toEqual({
      name: 'cell-entered',
      payload: { row: 'result', column: 0, digit: '2' },
    });

    const beforeCarry = state;
    state = enter(state, 'carry', 1, '1');
    const carried = emit(beforeCarry, state, {
      type: 'enter',
      row: 'carry',
      column: 1,
      digit: '1',
    });
    expect(carried.map((event) => event.name)).toEqual(['cell-entered', 'carry-marked']);

    const beforeLast = state;
    state = enter(state, 'result', 1, '7');
    const finished = emit(beforeLast, state, {
      type: 'enter',
      row: 'result',
      column: 1,
      digit: '7',
    });
    expect(finished.map((event) => event.name)).toEqual(['cell-entered', 'value-changed']);
    expect(finished[finished.length - 1]?.payload).toEqual({ value: '72' });
  });

  it('decimal 카드를 놓으면 aligned 이벤트를 낸다', () => {
    let state = decimalState('3.5', '1.27');
    state = place(state, 'a', 0);
    const before = state;
    state = place(state, 'b', 0);
    const events = emit(before, state, { type: 'place', number: 'b', pointColumn: 0 });
    expect(events[0]).toEqual({ name: 'aligned', payload: { alignment: 'point' } });
  });

  it('sub 표시도 carry-marked 이벤트를 낸다', () => {
    const state = stateOf({ mode: 'sub' });
    const crossed = apply(state, { type: 'toggle-cross', column: 1 });
    const events = emit(state, crossed, { type: 'toggle-cross', column: 1 });
    expect(events[0]).toEqual({
      name: 'carry-marked',
      payload: { column: 1, kind: 'cross', marked: true },
    });
  });

  it('결과 값·자리 맞춤·오개념·완성을 판정한다', () => {
    let state = decimalState('3.5', '1.27');
    state = place(state, 'a', 0);
    state = place(state, 'b', 0);
    state = fillResult(state, [
      [-2, '7'],
      [-1, '7'],
      [0, '4'],
    ]);
    const observation = observe(state);
    expect(resultIs(observation, { value: '4.77' })).toBe(true);
    expect(resultIs(observation, { value: '477/100' })).toBe(true);
    expect(resultIs(observation, { value: '4.76' })).toBe(false);
    expect(alignedByPoint(observation, undefined)).toBe(true);
    expect(complete(observation, undefined)).toBe(true);
    expect(noErrors(observation, undefined)).toBe(true);
    expect(hasMisconception(observation, { code: 'MC-DEC-ALIGN-RIGHT' })).toBe(false);
  });

  it('틀린 칸이 있으면 noErrors가 거짓이고 hasMisconception이 참이다', () => {
    let state = stateOf({ mode: 'add' });
    state = fillResult(state, [
      [0, '2'],
      [1, '6'],
    ]);
    const observation = observe(state);
    expect(noErrors(observation, undefined)).toBe(false);
    expect(hasMisconception(observation, { code: 'MC-PV-NO-CARRY' })).toBe(true);
  });
});
