import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { EngineEvent } from '../../../core/engine-sdk';
import { classifyDiv } from '../classify-div';
import { emit } from '../events';
import {
  computeDivPlan,
  divAlarm,
  divComplete,
  divRemainder,
  divStepReadings,
  estimateFit,
  estimateOver,
  estimatePartial,
  estimateRevised,
} from '../grid-div';
import { observe } from '../observe';
import { receive } from '../receive';
import { createInitialState, reduce } from '../reduce';
import type { CellRef, ColumnCalcAction, ColumnCalcState } from '../types';

function apply(state: ColumnCalcState, action: ColumnCalcAction): ColumnCalcState {
  const next = reduce(state, action);
  assertSerializable(next);
  return next;
}

function enter(
  state: ColumnCalcState,
  row: CellRef['row'],
  column: number,
  digit: string | null,
  index?: number,
): ColumnCalcState {
  return apply(state, {
    type: 'enter',
    row,
    column,
    digit,
    ...(index === undefined ? {} : { index }),
  });
}

/** 52÷4 정답 풀이를 채운다. */
function solved52(): ColumnCalcState {
  let state = createInitialState({ mode: 'div', dividend: 52, divisor: 4 });
  state = enter(state, 'quotient', 1, '1');
  state = enter(state, 'div-product', 1, '4', 1);
  state = enter(state, 'div-diff', 1, '1', 1);
  state = enter(state, 'div-diff', 0, '2', 1);
  state = enter(state, 'quotient', 0, '3');
  state = enter(state, 'div-product', 0, '2', 0);
  state = enter(state, 'div-product', 1, '1', 0);
  state = enter(state, 'div-diff', 0, '0', 0);
  state = enter(state, 'div-diff', 1, '0', 0);
  return state;
}

function event(name: string, payload: unknown): EngineEvent {
  return { name, payload: payload as EngineEvent['payload'] };
}

describe('grid-div 계산', () => {
  it('52÷4는 단계 열 [1, 0], 곱 4·12, 뺄셈 12·0, 나머지 0', () => {
    const plan = computeDivPlan(solved52());
    expect(plan.steps.map((step) => step.column)).toEqual([1, 0]);
    expect(plan.steps.map((step) => step.product.toString())).toEqual(['4', '12']);
    expect(plan.steps.map((step) => step.expectedRowValue?.toString())).toEqual(['12', '0']);
    expect(divRemainder(solved52(), plan)?.toString()).toBe('0');
  });

  it('408÷4는 십의 자리 몫이 0이어도 단계 두 개다', () => {
    let state = createInitialState({ mode: 'div', dividend: 408, divisor: 4 });
    state = enter(state, 'quotient', 2, '1');
    state = enter(state, 'div-product', 2, '4', 2);
    state = enter(state, 'div-diff', 1, '0', 2);
    state = enter(state, 'quotient', 1, '0');
    state = enter(state, 'div-diff', 0, '8', 2);
    state = enter(state, 'quotient', 0, '2');
    const plan = computeDivPlan(state);
    expect(plan.steps.map((step) => step.column)).toEqual([2, 0]);
    expect(plan.steps[0]?.bringColumns).toEqual([1, 0]);
    // 첫 단계 뺄셈 줄은 0을 내림 칸에 채운 08이다.
    expect(plan.steps[0]?.expectedRowValue?.toString()).toBe('8');
    expect(plan.steps[1]?.partial.toString()).toBe('8');
  });

  it('815÷40은 몫 20, 나머지 15', () => {
    let state = createInitialState({ mode: 'div', dividend: 815, divisor: 40 });
    state = enter(state, 'quotient', 1, '2');
    state = enter(state, 'quotient', 0, '0');
    state = enter(state, 'div-diff', 2, '0', 1);
    state = enter(state, 'div-diff', 1, '1', 1);
    state = enter(state, 'div-diff', 0, '5', 1);
    const plan = computeDivPlan(state);
    expect(plan.steps.map((step) => step.column)).toEqual([1]);
    expect(plan.steps[0]?.product.toString()).toBe('80');
    expect(plan.steps[0]?.diff.toString()).toBe('1');
    expect(divRemainder(state, plan)?.toString()).toBe('15');
    expect(plan.reading.skippedZero).toBe(false);
  });

  it('95÷23은 일의 자리 한 단계이고, 사다리 부분 피제수는 95다', () => {
    let state = createInitialState({ mode: 'div', dividend: 95, divisor: 23 });
    state = enter(state, 'quotient', 0, '4');
    const plan = computeDivPlan(state);
    expect(plan.steps.map((step) => step.column)).toEqual([0]);
    expect(plan.steps[0]?.product.toString()).toBe('92');
    expect(estimatePartial(state, plan.reading, 0).toString()).toBe('95');
    expect(estimateOver(state, plan.reading, 0, 5)).toBe(true);
    expect(estimateOver(state, plan.reading, 0, 4)).toBe(false);
  });

  it('168÷24 배수 사다리에서 7은 딱 맞고 8은 넘고 6은 모자란다', () => {
    const state = createInitialState({
      mode: 'div',
      dividend: 168,
      divisor: 24,
      estimateBar: { show: 'C-P', maxMultiple: 9 },
    });
    const plan = computeDivPlan(state);

    expect(estimateFit(state, plan.reading, 0, 7)).toBe('exact');
    expect(estimateFit(state, plan.reading, 0, 8)).toBe('over');
    expect(estimateFit(state, plan.reading, 0, 6)).toBe('short');
  });

  it('739÷36은 몫 20, 나머지 19', () => {
    let state = createInitialState({ mode: 'div', dividend: 739, divisor: 36 });
    state = enter(state, 'quotient', 1, '2');
    state = enter(state, 'quotient', 0, '0');
    state = enter(state, 'div-diff', 2, '0', 1);
    state = enter(state, 'div-diff', 1, '1', 1);
    state = enter(state, 'div-diff', 0, '9', 1);
    const plan = computeDivPlan(state);
    expect(plan.steps.map((step) => step.column)).toEqual([1]);
    expect(plan.steps[0]?.bringColumns).toEqual([0]);
    expect(divRemainder(state, plan)?.toString()).toBe('19');
  });

  it('9999÷99는 큰 수에서도 자리 계산이 맞는다', () => {
    let state = createInitialState({ mode: 'div', dividend: 9999, divisor: 99 });
    state = enter(state, 'quotient', 2, '1');
    state = enter(state, 'quotient', 1, '0');
    state = enter(state, 'quotient', 0, '1');
    state = enter(state, 'div-diff', 0, '9', 2);
    state = enter(state, 'div-diff', 1, '9', 2);
    state = enter(state, 'div-diff', 2, '0', 2);
    state = enter(state, 'div-diff', 0, '0', 0);
    state = enter(state, 'div-diff', 1, '0', 0);
    state = enter(state, 'div-diff', 2, '0', 0);
    const plan = computeDivPlan(state);
    expect(plan.steps.map((step) => step.column)).toEqual([2, 0]);
    expect(plan.steps[0]?.expectedRowValue?.toString()).toBe('99');
    expect(plan.steps[1]?.partial.toString()).toBe('99');
    expect(divRemainder(state, plan)?.toString()).toBe('0');
  });

  it('1÷7은 몫 0, 나머지 1이다(단계는 없다)', () => {
    let state = createInitialState({ mode: 'div', dividend: 1, divisor: 7 });
    state = enter(state, 'quotient', 0, '0');
    const plan = computeDivPlan(state);
    expect(plan.steps).toEqual([]);
    expect(plan.reading.quotientText).toBe('0');
    expect(divRemainder(state, plan)?.toString()).toBe('1');
    expect(divComplete(state, plan)).toBe(false);
  });

  it('위쪽 몫을 고쳐도 다른 단계 칸은 남아 있다', () => {
    const before = solved52();
    const after = enter(before, 'quotient', 1, '2');
    expect(after.divProducts['0']).toEqual(before.divProducts['0']);
    expect(after.divDiffs['0']).toEqual(before.divDiffs['0']);
  });

  it('divStepReadings는 학생 값을 문자열로 돌려준다', () => {
    const state = solved52();
    const plan = computeDivPlan(state);
    expect(divStepReadings(state, plan)).toEqual([
      { column: 1, q: '1', product: '4', diff: '12' },
      { column: 0, q: '3', product: '12', diff: '0' },
    ]);
  });

  it('범위를 벗어난 수는 기본값 52÷4로 고친다', () => {
    const state = createInitialState({ mode: 'div', dividend: 10000, divisor: 0 });
    expect(state.aText).toBe('52');
    expect(state.bText).toBe('4');
  });
});

describe('div 커서', () => {
  it('52÷4를 1·4·1·2·3·2·1·0 순서로 끝까지 쓴다', () => {
    let state = createInitialState({ mode: 'div', dividend: 52, divisor: 4 });
    const digits = ['1', '4', '1', '2', '3', '2', '1', '0'];
    for (const digit of digits) {
      const cell = state.selected;
      expect(cell).not.toBeNull();
      state = apply(state, {
        type: 'enter',
        row: cell?.row ?? 'quotient',
        column: cell?.column ?? 0,
        digit,
        ...(cell?.index === undefined ? {} : { index: cell.index }),
      });
    }
    const plan = computeDivPlan(state);
    expect(plan.reading.quotientText).toBe('13');
    expect(divRemainder(state, plan)?.toString()).toBe('0');
    expect(divComplete(state, plan)).toBe(true);
    expect(plan.steps.map((step) => step.column)).toEqual([1, 0]);
    // 곱 2칸·뺄셈 2칸을 모두 지나 마지막 뺄셈 높은 칸에 머문다.
    expect(state.selected).toEqual({ row: 'div-diff', column: 1, index: 0 });
  });

  it('몫 0을 쓰면 이전 단계의 새 내림 칸으로 간다(408÷4)', () => {
    let state = createInitialState({ mode: 'div', dividend: 408, divisor: 4 });
    state = enter(state, 'quotient', 2, '1');
    state = enter(state, 'quotient', 1, '0');
    expect(state.selected).toEqual({ row: 'div-diff', column: 0, index: 2 });
  });

  it('0을 쓰면 바로 위 단계 중 가장 가까운 단계의 새 내림 칸으로 간다(4836÷4)', () => {
    let state = createInitialState({ mode: 'div', dividend: 4836, divisor: 4 });
    // 1·4·0·8 / 2·8·0·0·0·3 — 각 줄의 열린 칸을 키보드 순서대로 쓴 뒤
    // 몫 십의 자리에 0을 쓴다.
    for (const digit of ['1', '4', '0', '8', '2', '8', '0', '0', '0', '3', '0']) {
      const cell = state.selected;
      expect(cell).not.toBeNull();
      state = apply(state, {
        type: 'enter',
        row: cell?.row ?? 'quotient',
        column: cell?.column ?? 0,
        digit,
        ...(cell?.index === undefined ? {} : { index: cell.index }),
      });
    }
    // 위에 단계가 둘(열 3, 열 2) 있어도 열 2 단계의 내림 칸 0으로 가야 한다.
    expect(state.selected).toEqual({ row: 'div-diff', column: 0, index: 2 });

    state = enter(state, 'div-diff', 0, '6', 2);
    expect(state.divDiffs['2']?.['0']).toBe('6');
    expect(state.selected).toEqual({ row: 'quotient', column: 0 });
  });
});

describe('div Observation', () => {
  it('정답 풀이는 완성이고 오류가 없다', () => {
    const observation = observe(solved52());
    expect(observation['divComplete']).toBe(true);
    expect(observation['complete']).toBe(true);
    expect(observation['quotient']).toBe('13');
    expect(observation['remainder']).toBe('0');
    expect(observation['result']).toBe('13');
    expect(observation['misconceptions']).toEqual([]);
    expect(observation['alarm']).toBe(false);
  });

  it('1÷7은 몫 0·나머지 1을 읽는다', () => {
    let state = createInitialState({ mode: 'div', dividend: 1, divisor: 7 });
    state = enter(state, 'quotient', 0, '0');
    const observation = observe(state);
    expect(observation['quotient']).toBe('0');
    expect(observation['quotientRaw']).toBe('0');
    expect(observation['remainder']).toBe('1');
    expect(observation['divComplete']).toBe(false);
  });

  it('맨 앞 0은 값은 그대로 두고 quotientLeadingZero만 켠다', () => {
    let state = createInitialState({ mode: 'div', dividend: 52, divisor: 4 });
    state = enter(state, 'quotient', 1, '0');
    state = enter(state, 'quotient', 0, '1');
    const observation = observe(state);
    expect(observation['quotient']).toBe('1');
    expect(observation['quotientLeadingZero']).toBe(true);
  });
});

describe('div 오류 분류', () => {
  it('408÷4=12는 몫의 0 누락이다', () => {
    let state = createInitialState({ mode: 'div', dividend: 408, divisor: 4 });
    state = enter(state, 'quotient', 2, '1');
    state = enter(state, 'quotient', 0, '2');
    const codes = classifyDiv(state, computeDivPlan(state)).map((error) => error.code);
    expect(codes).toContain('MC-DIV-QUOTIENT-ZERO');
  });

  it('가운데 몫 칸을 비워도 몫의 0 누락이다', () => {
    let state = createInitialState({ mode: 'div', dividend: 408, divisor: 4 });
    state = enter(state, 'quotient', 2, '1');
    state = enter(state, 'quotient', 0, '2');
    const observation = observe(state);
    expect(observation['skippedZero']).toBe(true);
    expect(observation['misconceptions']).toContain('MC-DIV-QUOTIENT-ZERO');
  });

  it('83÷6에서 12, 뺄셈 11은 나머지가 너무 크다', () => {
    let state = createInitialState({ mode: 'div', dividend: 83, divisor: 6 });
    state = enter(state, 'quotient', 1, '1');
    state = enter(state, 'div-diff', 1, '2', 1);
    state = enter(state, 'div-diff', 0, '3', 1);
    state = enter(state, 'quotient', 0, '2');
    state = enter(state, 'div-diff', 1, '1', 0);
    state = enter(state, 'div-diff', 0, '1', 0);
    const codes = classifyDiv(state, computeDivPlan(state)).map((error) => error.code);
    expect(codes).toContain('MC-DIV-REMAINDER-TOO-BIG');
  });

  it('52÷4에서 십의 자리 1을 버리면 내림 누락이다', () => {
    let state = createInitialState({ mode: 'div', dividend: 52, divisor: 4 });
    state = enter(state, 'quotient', 1, '1');
    state = enter(state, 'div-product', 1, '4', 1);
    state = enter(state, 'div-diff', 0, '2', 1);
    state = enter(state, 'quotient', 0, '3');
    const codes = classifyDiv(state, computeDivPlan(state)).map((error) => error.code);
    expect(codes).toContain('MC-DIV-BRING-DOWN');
  });

  it('168÷24에서 몫 8, 곱 192는 어림이 틀렸다', () => {
    let state = createInitialState({ mode: 'div', dividend: 168, divisor: 24 });
    state = enter(state, 'quotient', 0, '8');
    const codes = classifyDiv(state, computeDivPlan(state)).map((error) => error.code);
    expect(codes).toContain('MC-DIV-ESTIMATE-OFF');
  });

  it('맞은 풀이는 분류하지 않는다', () => {
    expect(classifyDiv(solved52(), computeDivPlan(solved52()))).toEqual([]);
  });
});

describe('나머지 경고등·배수 사다리·되감기·디버그', () => {
  it('나머지가 나누는 수와 같으면 경고등을 켜고, 하나 작으면 끈다', () => {
    const atLimit = createInitialState({
      mode: 'div',
      dividend: 83,
      divisor: 6,
      remainderAlarm: true,
      debugSample: { quotient: '12' },
    });
    expect(divRemainder(atLimit, computeDivPlan(atLimit))?.toString()).toBe('11');
    expect(divAlarm(atLimit, computeDivPlan(atLimit), atLimit.alarmEnabled)).toBe(true);

    // 52÷4 정답의 마지막 뺄셈은 0이라 경계 아래다.
    const below = createInitialState({
      mode: 'div',
      dividend: 52,
      divisor: 4,
      remainderAlarm: true,
    });
    const solved = solved52();
    expect(divAlarm(solved, computeDivPlan(solved), below.alarmEnabled)).toBe(false);
  });

  it('estimateTries에 고른 순서가 남고 5→4는 estimateRevised다', () => {
    let state = createInitialState({
      mode: 'div',
      dividend: 95,
      divisor: 23,
      estimateBar: { show: 'C-P', maxMultiple: 9 },
    });
    state = apply(state, { type: 'try-estimate', column: 0, k: 5 });
    state = apply(state, { type: 'try-estimate', column: 0, k: 4 });
    const observation = observe(state);
    expect(observation['estimateTries']).toEqual({ '0': [5, 4] });
    expect(observation['estimateRevised']).toBe(true);
    expect(estimateRevised(state, computeDivPlan(state))).toBe(true);
  });

  it('debugSample 83÷6 "12"는 나머지 11·경고등을 채운 채 시작한다', () => {
    const state = createInitialState({
      mode: 'div',
      dividend: 83,
      divisor: 6,
      remainderAlarm: true,
      debugSample: { quotient: '12' },
    });
    const observation = observe(state);
    expect(observation['quotient']).toBe('12');
    expect(observation['remainder']).toBe('11');
    expect(observation['alarm']).toBe(true);
    expect(observation['divComplete']).toBe(true);
  });

  it('rewindCheck가 있으면 완성 뒤 되감기 Action과 이벤트가 난다', () => {
    let state = createInitialState({ mode: 'div', dividend: 52, divisor: 4, rewindCheck: true });
    const incomplete = state;
    expect(reduce(incomplete, { type: 'rewind' })).toBe(incomplete);

    state = solved52();
    state = { ...state, rewindEnabled: true };
    const next = apply(state, { type: 'rewind' });
    expect(next.rewound).toBe(true);
    const events = emitRewind(state, next);
    expect(events.map((entry) => entry.name)).toContain('rewind-requested');
  });

  it('경고등이 바뀌면 alarm-changed 이벤트가 난다', () => {
    let state = createInitialState({
      mode: 'div',
      dividend: 83,
      divisor: 6,
      remainderAlarm: true,
    });
    state = enter(state, 'quotient', 1, '1');
    state = enter(state, 'div-diff', 1, '2', 1);
    state = enter(state, 'div-diff', 0, '3', 1);
    state = enter(state, 'quotient', 0, '2');
    const before = state;
    state = enter(state, 'div-diff', 1, '1', 0);
    const after = enter(state, 'div-diff', 0, '1', 0);
    const events = emitFor(before, after, {
      type: 'enter',
      row: 'div-diff',
      column: 0,
      digit: '1',
      index: 0,
    });
    expect(events.map((entry) => entry.name)).toContain('alarm-changed');
  });
});

describe('receive divide-progress', () => {
  it('auto는 몫 칸에 perPlate를 쓰고, hint는 강조만 한다', () => {
    const auto = createInitialState({ mode: 'div', dividend: 52, divisor: 4, linkMarks: 'auto' });
    const action = receive(
      auto,
      event('divide-progress', {
        columns: [
          { column: 1, perPlate: 1, pile: 0 },
          { column: 0, perPlate: 1, pile: 1 },
        ],
        equal: false,
        pileValue: 2,
      }),
    );
    expect(action).not.toBeNull();
    const filled = reduce(auto, action as ColumnCalcAction);
    expect(filled.quotient['1']).toBe('1');
    expect(filled.quotient['0']).toBeUndefined();

    const hint = createInitialState({ mode: 'div', dividend: 52, divisor: 4, linkMarks: 'hint' });
    const hintAction = receive(
      hint,
      event('divide-progress', {
        columns: [{ column: 1, perPlate: 1, pile: 0 }],
        equal: false,
        pileValue: 2,
      }),
    );
    const marked = reduce(hint, hintAction as ColumnCalcAction);
    expect(marked.quotient['1']).toBeUndefined();
    expect(marked.linkHighlights).toContain('quotient:1');
  });

  it('pile > 0이면 아무것도 하지 않고, 다른 모드에서는 null이다', () => {
    const div = createInitialState({ mode: 'div', dividend: 52, divisor: 4, linkMarks: 'auto' });
    expect(
      receive(
        div,
        event('divide-progress', {
          columns: [{ column: 1, perPlate: 0, pile: 1 }],
          equal: false,
          pileValue: 1,
        }),
      ),
    ).toBeNull();
    const add = createInitialState({ mode: 'add', a: 47, b: 25 });
    expect(
      receive(add, event('divide-progress', { columns: [], equal: false, pileValue: 0 })),
    ).toBeNull();
  });
});

// emit은 reduce 결과와 Action을 받는다. 테스트 도우미로 감싼다.
function emitFor(
  prev: ColumnCalcState,
  next: ColumnCalcState,
  action: ColumnCalcAction,
): EngineEvent[] {
  return emit(prev, next, action);
}

function emitRewind(prev: ColumnCalcState, next: ColumnCalcState): EngineEvent[] {
  return emitFor(prev, next, { type: 'rewind' });
}
