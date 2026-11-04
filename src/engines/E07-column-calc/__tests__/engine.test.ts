import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import {
  alignedByPoint,
  complete,
  emit,
  estimateIs,
  flaggedCell,
  hasMisconception,
  linkMarked,
  noErrors,
  partialsAre,
  resultIs,
  signalIs,
} from '../events';
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

function mulState(config: ColumnCalcConfig = {}): ColumnCalcState {
  return stateOf({ mode: 'mul', a: '46', b: '27', ...config });
}

function enterPartial(
  state: ColumnCalcState,
  index: number,
  column: number,
  digit: string | null,
): ColumnCalcState {
  return apply(state, { type: 'enter', row: 'partial', column, digit, index });
}

/** 46×27의 부분곱 두 줄(322·920)을 채운다. 합 줄은 비워 둔다. */
function fillMulPartials(state: ColumnCalcState): ColumnCalcState {
  let current = state;
  for (const [column, digit] of [
    [0, '2'],
    [1, '2'],
    [2, '3'],
  ] as const) {
    current = enterPartial(current, 0, column, digit);
  }
  for (const [column, digit] of [
    [1, '2'],
    [2, '9'],
  ] as const) {
    current = enterPartial(current, 1, column, digit);
  }
  return current;
}

describe('E07 mul', () => {
  it('46×27은 첫째 부분곱 줄 일의 자리부터 고르고, 한 줄은 낮은 자리 → 높은 자리로 간다', () => {
    let state = mulState();
    expect(state.selected).toEqual({ row: 'partial', column: 0, index: 0 });

    state = enterPartial(state, 0, 0, '2');
    expect(state.selected).toEqual({ row: 'partial', column: 1, index: 0 });
    state = enterPartial(state, 0, 1, '2');
    expect(state.selected).toEqual({ row: 'partial', column: 2, index: 0 });
    state = enterPartial(state, 0, 2, '3');
    // 줄이 끝나면 다음 줄의 가장 낮은 칸(밀어 둔 0 자리 다음)으로 간다.
    expect(state.selected).toEqual({ row: 'partial', column: 1, index: 1 });
    state = enterPartial(state, 1, 1, '2');
    state = enterPartial(state, 1, 2, '9');
    // 정답(920)은 끝났어도 여분 앞자리 칸으로 간다. 커서가 답의 자릿수를 알려 주지 않는다.
    expect(state.selected).toEqual({ row: 'partial', column: 3, index: 1 });
    state = enterPartial(state, 1, 3, '0');
    expect(state.selected).toEqual({ row: 'result', column: 0 });
  });

  it('46×27을 끝까지 쓰면 complete·result 1242, 부분곱 값은 322·920이다', () => {
    let state = fillMulPartials(mulState());
    expect(observe(state)['rowsComplete']).toBe(true);
    expect(observe(state)['partials']).toEqual(['322', '920']);
    expect(observe(state)['complete']).toBe(false);

    state = fillResult(state, [
      [0, '2'],
      [1, '4'],
      [2, '2'],
      [3, '1'],
    ]);
    const observation = observe(state);
    expect(observation['complete']).toBe(true);
    expect(observation['result']).toBe('1242');
    expect(observation['expectedRowCount']).toBe(2);
    expect(observation['misconceptions']).toEqual([]);
    expect(resultIs(observation, { value: '1242' })).toBe(true);
    expect(partialsAre(observation, { values: [322, 920] })).toBe(true);
    expect(partialsAre(observation, { values: ['322', '902'] })).toBe(false);
  });

  it('부분곱 칸 입력은 줄 index를 붙여 cell-entered를 낸다', () => {
    const before = mulState();
    const after = enterPartial(before, 0, 0, '2');
    const events = emit(before, after, {
      type: 'enter',
      row: 'partial',
      column: 0,
      digit: '2',
      index: 0,
    });
    expect(events).toEqual([
      {
        name: 'cell-entered',
        payload: { row: 'partial', column: 0, digit: '2', index: 0 },
      },
    ]);
  });

  it('한 자리 곱셈은 받아올림 줄에 쓸 수 있고 carry-marked를 낸다', () => {
    const before = mulState({ a: '213', b: '4' });
    const after = apply(before, { type: 'enter', row: 'carry', column: 1, digit: '1' });
    expect(after.carries).toEqual({ '1': '1' });
    const events = emit(before, after, { type: 'enter', row: 'carry', column: 1, digit: '1' });
    expect(events.map((event) => event.name)).toEqual(['cell-entered', 'carry-marked']);
  });

  it('합 줄이 다 차면 value-changed로 1242를 알린다', () => {
    const before = fillResult(fillMulPartials(mulState()), [
      [0, '2'],
      [1, '4'],
      [2, '2'],
    ]);
    const after = enter(before, 'result', 3, '1');
    const events = emit(before, after, {
      type: 'enter',
      row: 'result',
      column: 3,
      digit: '1',
    });
    expect(events.map((event) => event.name)).toEqual(['cell-entered', 'value-changed']);
    expect(events[1]?.payload).toEqual({ value: '1242' });
  });

  it('틀린 칸 표시는 Action으로 남고 flaggedCell로 판정한다', () => {
    let state = fillMulPartials(mulState());
    state = apply(state, { type: 'flag-cell', row: 'partial', column: 1, index: 1 });
    let observation = observe(state);
    expect(observation['flaggedCells']).toEqual([{ row: 'partial', column: 1, index: 1 }]);
    expect(flaggedCell(observation, { row: 'partial', column: 1, index: 1 })).toBe(true);
    expect(flaggedCell(observation, { row: 'partial', column: 2, index: 1 })).toBe(false);

    // 다시 누르면 표시가 풀린다.
    state = apply(state, { type: 'flag-cell', row: 'partial', column: 1, index: 1 });
    observation = observe(state);
    expect(observation['flaggedCells']).toEqual([]);
  });

  it('add·sub에서는 flag-cell을 무시한다', () => {
    const state = stateOf({ mode: 'add' });
    expect(apply(state, { type: 'flag-cell', row: 'result', column: 0 })).toBe(state);
  });

  it('연결 강조는 linkHighlights에 남고, 다음 입력에서 지워진다', () => {
    let state = apply(mulState(), {
      type: 'link-mark',
      marks: [{ kind: 'carry', column: 1 }],
      fill: [],
      crosses: [],
      tens: [],
    });
    const observation = observe(state);
    expect(observation['linkHighlights']).toEqual(['carry:1']);
    expect(linkMarked(observation, { kind: 'carry', column: 1 })).toBe(true);
    expect(linkMarked(observation, { kind: 'carry', column: 2 })).toBe(false);

    state = enterPartial(state, 0, 0, '2');
    expect(observe(state)['linkHighlights']).toEqual([]);
  });

  it('E04 부분곱 색은 줄 index별로 남는다', () => {
    let state = apply(mulState(), {
      type: 'link-colors',
      colors: { '0': 2, '1': 1 },
    });
    expect(observe(state)['rowColors']).toEqual({ '0': 2, '1': 1 });
    state = apply(state, { type: 'link-colors', colors: {} });
    expect(observe(state)['rowColors']).toEqual({});
  });
});

describe('E07 estimate', () => {
  function estimateState(config: ColumnCalcConfig = {}): ColumnCalcState {
    return stateOf({ mode: 'estimate', op: 'add', a: '389', b: '412', ...config });
  }

  function typeEstimate(state: ColumnCalcState, text: string): ColumnCalcState {
    return [...text].reduce(
      (current, digit) => apply(current, { type: 'enter-estimate', digit }),
      state,
    );
  }

  it('어림값을 잠그면 estimate-locked를 내고 격자를 연다', () => {
    const before = typeEstimate(estimateState(), '800');
    expect(before.phase).toBe('estimate');
    const after = apply(before, { type: 'lock-estimate' });
    expect(after.phase).toBe('calc');
    expect(after.selected).toEqual({ row: 'result', column: 0 });

    const events = emit(before, after, { type: 'lock-estimate' });
    expect(events).toContainEqual({
      name: 'estimate-locked',
      payload: { estimate: '800' },
    });
  });

  it('어림값이 없으면 잠그지 않고 이벤트도 없다', () => {
    const state = estimateState();
    expect(apply(state, { type: 'lock-estimate' })).toBe(state);
    expect(emit(state, state, { type: 'lock-estimate' })).toEqual([]);
  });

  it('결과가 완성되면 signal-changed로 초록을 알린다', () => {
    let state = apply(typeEstimate(estimateState(), '800'), { type: 'lock-estimate' });
    state = apply(state, { type: 'enter', row: 'result', column: 0, digit: '1' });
    state = apply(state, { type: 'enter', row: 'result', column: 1, digit: '0' });
    const before = state;
    const after = apply(state, { type: 'enter', row: 'result', column: 2, digit: '8' });

    const observation = observe(after);
    expect(observation['phase']).toBe('calc');
    expect(observation['estimate']).toBe('800');
    expect(observation['signal']).toBe('green');
    expect(observation['result']).toBe('801');
    expect(signalIs(observation, { value: 'green' })).toBe(true);
    expect(signalIs(observation, { value: 'red' })).toBe(false);
    expect(estimateIs(observation, { value: 800 })).toBe(true);
    expect(estimateIs(observation, { value: '800' })).toBe(true);
    expect(estimateIs(observation, { value: '700' })).toBe(false);

    const events = emit(before, after, {
      type: 'enter',
      row: 'result',
      column: 2,
      digit: '8',
    });
    expect(events.map((event) => event.name)).toEqual([
      'cell-entered',
      'value-changed',
      'signal-changed',
    ]);
    expect(events[2]?.payload).toEqual({ signal: 'green' });
  });

  it('어림값을 다시 고치면 격자 입력을 잠시 막고, 잠그면 이어서 쓴다', () => {
    let state = apply(typeEstimate(estimateState(), '800'), { type: 'lock-estimate' });
    state = apply(state, { type: 'enter', row: 'result', column: 0, digit: '1' });

    state = apply(state, { type: 'unlock-estimate' });
    expect(state.phase).toBe('estimate');
    expect(state.selected).toBeNull();
    // 다시 어림 단계로 돌아가도 이미 쓴 결과는 지우지 않는다.
    expect(state.result).toEqual({ '0': '1' });
    expect(apply(state, { type: 'enter', row: 'result', column: 1, digit: '0' })).toBe(state);

    state = apply(state, { type: 'enter-estimate', digit: null });
    state = apply(state, { type: 'enter-estimate', digit: null });
    state = apply(state, { type: 'enter-estimate', digit: null });
    expect(state.estimate).toBeNull();
    state = typeEstimate(state, '900');
    state = apply(state, { type: 'lock-estimate' });
    expect(state.phase).toBe('calc');
    expect(observe(state)['estimate']).toBe('900');
  });

  it('sample은 틀린 결과를 그대로 두고, recheck로 지운 뒤 다시 푼다', () => {
    let state = estimateState({ sample: '500' });
    expect(state.hasSample).toBe(true);
    state = apply(typeEstimate(state, '800'), { type: 'lock-estimate' });
    expect(observe(state)['signal']).toBe('red');

    const before = state;
    state = apply(state, { type: 'recheck' });
    expect(state.rechecked).toBe(true);
    expect(state.result).toEqual({});
    expect(observe(state)['signal']).toBeNull();
    const events = emit(before, state, { type: 'recheck' });
    expect(events).toContainEqual({ name: 'signal-changed', payload: { signal: null } });
  });

  it('sample이 없는 과제는 recheck를 무시한다', () => {
    const state = apply(typeEstimate(estimateState(), '800'), { type: 'lock-estimate' });
    expect(apply(state, { type: 'recheck' })).toBe(state);
  });
});

describe('E07 상태 직렬화', () => {
  it('곱셈·어림 상태는 JSON으로 그대로 되돌아온다', () => {
    let mul = fillMulPartials(mulState());
    mul = apply(mul, { type: 'flag-cell', row: 'partial', column: 1, index: 0 });
    mul = apply(mul, { type: 'link-colors', colors: { '0': 3 } });
    assertSerializable(mul);
    expect(JSON.parse(JSON.stringify(mul))).toEqual(mul);

    let estimate = stateOf({
      mode: 'estimate',
      op: 'add',
      a: '389',
      b: '412',
      sample: '500',
    });
    for (const digit of '800') {
      estimate = apply(estimate, { type: 'enter-estimate', digit });
    }
    estimate = apply(estimate, { type: 'lock-estimate' });
    assertSerializable(estimate);
    expect(JSON.parse(JSON.stringify(estimate))).toEqual(estimate);
  });
});
