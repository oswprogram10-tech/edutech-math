import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { classifyDiv } from '../classify-div';
import { computeDivPlan, divComplete, divRemainderDetail } from '../grid-div';
import { divGridNumbers, firstQuotientColumn } from '../grid-div-decimal';
import { oneSideTried, quotientIs, remainderGridIs, remainderIs, scaleIs } from '../events';
import { observe } from '../observe';
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

function placePoint(state: ColumnCalcState, column: number | null): ColumnCalcState {
  return apply(state, { type: 'place-point', target: 'quotient', column });
}

function scaleBoth(state: ColumnCalcState, to: number): ColumnCalcState {
  return apply(state, { type: 'scale', side: 'both', to });
}

function appendZero(state: ColumnCalcState): ColumnCalcState {
  const numbers = divGridNumbers(state);
  return apply(state, { type: 'pad-zero', number: 'a', column: numbers.low - 1 });
}

/** 6.24 ÷ 3 = 2.08. */
function solved624(): ColumnCalcState {
  let state = createInitialState({
    mode: 'div',
    decimal: true,
    dividend: '6.24',
    divisor: 3,
    flagSkippedZero: true,
  });
  state = enter(state, 'quotient', 0, '2');
  state = enter(state, 'div-product', 0, '6', 0);
  state = enter(state, 'div-diff', 0, '0', 0);
  state = enter(state, 'quotient', -1, '0');
  state = enter(state, 'div-diff', -1, '2', 0);
  state = enter(state, 'div-diff', -2, '4', 0);
  state = enter(state, 'quotient', -2, '8');
  state = enter(state, 'div-product', -2, '4', -2);
  state = enter(state, 'div-product', -1, '2', -2);
  state = enter(state, 'div-diff', -2, '0', -2);
  state = enter(state, 'div-diff', -1, '0', -2);
  return placePoint(state, 0);
}

/** 9.3 ÷ 6을 1.55까지(0 하나 붙임). */
function solved93(): ColumnCalcState {
  let state = createInitialState({
    mode: 'div',
    decimal: true,
    dividend: '9.3',
    divisor: 6,
    extendZeros: 2,
  });
  state = enter(state, 'quotient', 0, '1');
  state = enter(state, 'div-product', 0, '6', 0);
  state = enter(state, 'div-diff', 0, '3', 0);
  state = enter(state, 'quotient', -1, '5');
  state = enter(state, 'div-diff', -1, '3', 0);
  state = enter(state, 'div-product', 0, '3', -1);
  state = enter(state, 'div-product', -1, '0', -1);
  state = enter(state, 'div-diff', -1, '3', -1);
  state = enter(state, 'div-diff', 0, '0', -1);
  state = appendZero(state);
  state = enter(state, 'quotient', -2, '5');
  state = enter(state, 'div-diff', -2, '0', -1);
  state = enter(state, 'div-product', -2, '0', -2);
  state = enter(state, 'div-product', -1, '3', -2);
  state = enter(state, 'div-diff', -2, '0', -2);
  state = enter(state, 'div-diff', -1, '0', -2);
  return placePoint(state, 0);
}

/** 0.45 ÷ 5 = 0.09. */
function solved045(): ColumnCalcState {
  let state = createInitialState({ mode: 'div', decimal: true, dividend: '0.45', divisor: 5 });
  state = enter(state, 'quotient', 0, '0');
  state = enter(state, 'quotient', -1, '0');
  state = enter(state, 'quotient', -2, '9');
  state = enter(state, 'div-product', -2, '5', -2);
  state = enter(state, 'div-product', -1, '4', -2);
  state = enter(state, 'div-diff', -2, '0', -2);
  state = enter(state, 'div-diff', -1, '0', -2);
  return placePoint(state, 0);
}

/** 1.68 ÷ 0.24 = 7 (양쪽 ×100). */
function solved168(): ColumnCalcState {
  let state = createInitialState({
    mode: 'div',
    decimal: true,
    dividend: '1.68',
    divisor: '0.24',
    magnifier: [10, 100],
    allowOneSideScale: true,
  });
  state = scaleBoth(state, 2);
  state = enter(state, 'quotient', 0, '7');
  state = enter(state, 'div-product', 0, '8', 0);
  state = enter(state, 'div-product', 1, '6', 0);
  state = enter(state, 'div-product', 2, '1', 0);
  state = enter(state, 'div-diff', 0, '0', 0);
  state = enter(state, 'div-diff', 1, '0', 0);
  state = enter(state, 'div-diff', 2, '0', 0);
  return state;
}

describe('grid-div-decimal 격자와 몫 읽기', () => {
  it('6.24 ÷ 3은 몫 52/25, 나머지 0, 점 0이다', () => {
    const state = solved624();
    const plan = computeDivPlan(state);
    expect(plan.reading.quotientText).toBe('52/25');
    expect(plan.reading.quotientPoint).toBe(0);
    expect(plan.reading.quotientRaw).toBe('2.08');
    expect(divComplete(state, plan)).toBe(true);
    expect(divRemainderDetail(state, plan)?.value.toString()).toBe('0');
  });

  it('9.3 ÷ 6은 0을 하나 붙여 31/20, 나머지 0', () => {
    const state = solved93();
    const plan = computeDivPlan(state);
    expect(plan.reading.appendedZeros).toBe(1);
    expect(plan.reading.quotientText).toBe('31/20');
    expect(divComplete(state, plan)).toBe(true);
    expect(divRemainderDetail(state, plan)?.value.toString()).toBe('0');
  });

  it('9.3 ÷ 6을 1.5에서 멈추면 나머지 3/10이다', () => {
    let state = createInitialState({ mode: 'div', decimal: true, dividend: '9.3', divisor: 6 });
    state = enter(state, 'quotient', 0, '1');
    state = enter(state, 'div-product', 0, '6', 0);
    state = enter(state, 'div-diff', 0, '3', 0);
    state = enter(state, 'quotient', -1, '5');
    state = enter(state, 'div-diff', -1, '3', 0);
    state = enter(state, 'div-product', 0, '3', -1);
    state = enter(state, 'div-product', -1, '0', -1);
    state = enter(state, 'div-diff', -1, '3', -1);
    state = enter(state, 'div-diff', 0, '0', -1);
    state = placePoint(state, 0);
    const plan = computeDivPlan(state);
    expect(plan.reading.quotientText).toBe('3/2');
    expect(divRemainderDetail(state, plan)?.value.toString()).toBe('3/10');
    expect(divRemainderDetail(state, plan)?.gridValue.toString()).toBe('3/10');
  });

  it('0.45 ÷ 5는 9/100이고 일의 자리·소수 첫째 자리에 0을 쓴다', () => {
    const state = solved045();
    const plan = computeDivPlan(state);
    expect(plan.reading.quotientText).toBe('9/100');
    expect(plan.reading.quotientCells).toBe('009');
    expect(divComplete(state, plan)).toBe(true);
  });

  it('3 ÷ 4는 0을 두 개 붙여 3/4이다', () => {
    let state = createInitialState({ mode: 'div', decimal: true, dividend: 3, divisor: 4 });
    state = enter(state, 'quotient', 0, '0');
    state = appendZero(state);
    state = enter(state, 'quotient', -1, '7');
    state = enter(state, 'div-product', -1, '8', -1);
    state = enter(state, 'div-product', 0, '2', -1);
    state = enter(state, 'div-diff', -1, '2', -1);
    state = enter(state, 'div-diff', 0, '0', -1);
    state = appendZero(state);
    state = enter(state, 'quotient', -2, '5');
    state = enter(state, 'div-diff', -2, '0', -1);
    state = enter(state, 'div-product', -2, '0', -2);
    state = enter(state, 'div-product', -1, '2', -2);
    state = enter(state, 'div-diff', -2, '0', -2);
    state = enter(state, 'div-diff', -1, '0', -2);
    state = placePoint(state, 0);
    const plan = computeDivPlan(state);
    expect(plan.reading.quotientText).toBe('3/4');
    expect(divComplete(state, plan)).toBe(true);
  });

  it('1.68 ÷ 0.24는 양쪽 ×100 뒤 7이다', () => {
    const state = solved168();
    const plan = computeDivPlan(state);
    expect(plan.reading.scaleA).toBe(2);
    expect(plan.reading.scaleB).toBe(2);
    expect(plan.reading.scaledDividend.toString()).toBe('168');
    expect(plan.reading.scaledDivisor.toString()).toBe('24');
    expect(plan.reading.quotientText).toBe('7');
    expect(divComplete(state, plan)).toBe(true);
  });

  it('7.4 ÷ 1.5는 scale 1에서 몫 4, 격자 나머지 14, 원래 나머지 7/5', () => {
    let state = createInitialState({
      mode: 'div',
      decimal: true,
      dividend: '7.4',
      divisor: '1.5',
      extendZeros: 0,
    });
    state = scaleBoth(state, 1);
    state = enter(state, 'quotient', 0, '4');
    state = enter(state, 'div-product', 0, '0', 0);
    state = enter(state, 'div-product', 1, '6', 0);
    state = enter(state, 'div-diff', 0, '4', 0);
    state = enter(state, 'div-diff', 1, '1', 0);
    const plan = computeDivPlan(state);
    expect(plan.reading.quotientText).toBe('4');
    expect(divRemainderDetail(state, plan)?.gridValue.toString()).toBe('14');
    expect(divRemainderDetail(state, plan)?.value.toString()).toBe('7/5');
  });

  it('5 ÷ 0.4는 scale 1 + 0 하나로 25/2다', () => {
    let state = createInitialState({
      mode: 'div',
      decimal: true,
      dividend: 5,
      divisor: '0.4',
      extendZeros: 2,
    });
    state = scaleBoth(state, 1);
    state = enter(state, 'quotient', 1, '1');
    state = enter(state, 'div-product', 1, '4', 1);
    state = enter(state, 'div-diff', 1, '1', 1);
    state = enter(state, 'div-diff', 0, '0', 1);
    state = enter(state, 'quotient', 0, '2');
    state = enter(state, 'div-product', 0, '8', 0);
    state = enter(state, 'div-product', 1, '0', 0);
    state = enter(state, 'div-diff', 0, '2', 0);
    state = enter(state, 'div-diff', 1, '0', 0);
    state = appendZero(state);
    state = enter(state, 'quotient', -1, '5');
    state = enter(state, 'div-diff', -1, '0', 0);
    state = enter(state, 'div-product', -1, '0', -1);
    state = enter(state, 'div-product', 0, '2', -1);
    state = enter(state, 'div-diff', -1, '0', -1);
    state = enter(state, 'div-diff', 0, '0', -1);
    state = placePoint(state, 0);
    const plan = computeDivPlan(state);
    expect(plan.reading.quotientText).toBe('25/2');
    expect(divComplete(state, plan)).toBe(true);
  });

  it('2.73 ÷ 1.3은 scale 1에서 21/10이다', () => {
    let state = createInitialState({
      mode: 'div',
      decimal: true,
      dividend: '2.73',
      divisor: '1.3',
      extendZeros: 0,
    });
    state = scaleBoth(state, 1);
    state = enter(state, 'quotient', 0, '2');
    state = enter(state, 'div-product', 0, '6', 0);
    state = enter(state, 'div-product', 1, '2', 0);
    state = enter(state, 'div-diff', 0, '1', 0);
    state = enter(state, 'div-diff', 1, '0', 0);
    state = enter(state, 'quotient', -1, '1');
    state = enter(state, 'div-diff', -1, '3', 0);
    state = enter(state, 'div-product', -1, '3', -1);
    state = enter(state, 'div-product', 0, '1', -1);
    state = enter(state, 'div-diff', -1, '0', -1);
    state = enter(state, 'div-diff', 0, '0', -1);
    state = placePoint(state, 0);
    const plan = computeDivPlan(state);
    expect(plan.reading.quotientText).toBe('21/10');
    expect(divComplete(state, plan)).toBe(true);
  });

  it('scale을 바꾸면 격자 칸이 모두 비고, 붙인 0을 떼면 그 열이 지워진다', () => {
    let state = solved624();
    state = apply(state, { type: 'scale', side: 'both', to: 1 });
    expect(state.quotient).toEqual({});
    expect(state.divProducts).toEqual({});
    expect(state.divDiffs).toEqual({});
    expect(state.quotientPoint).toBeNull();

    let appended = solved93();
    const low = divGridNumbers(appended).low;
    expect(low).toBe(-2);
    appended = apply(appended, { type: 'pad-zero', number: 'a', column: low });
    expect(divGridNumbers(appended).appended).toBe(0);
    expect(appended.quotient[String(low)]).toBeUndefined();
  });

  it('몫 읽기는 빈칸을 빼고 잇고, 점이 숫자보다 위면 0.을 붙인다', () => {
    const base = createInitialState({ mode: 'div', decimal: true, dividend: '6.24', divisor: 3 });
    expect(firstQuotientColumn(base)).toBe(0);
    const withPoint = placePoint(enter(base, 'quotient', -1, '2'), 0);
    const plan = computeDivPlan(withPoint);
    expect(plan.reading.quotientRaw).toBe('0.2');
    expect(plan.reading.quotientText).toBe('1/5');
  });

  it('{mode:decimal, op:div}은 div+decimal과 같은 상태다', () => {
    const left = createInitialState({ mode: 'decimal', op: 'div', a: '6.24', b: 3 });
    const right = createInitialState({ mode: 'div', decimal: true, dividend: '6.24', divisor: 3 });
    expect(left.mode).toBe('div');
    expect(left.op).toBe('div');
    expect(left.decimal).toBe(true);
    expect(left.aText).toBe(right.aText);
    expect(left.bText).toBe(right.bText);
  });

  it('나누는 수가 소수면 격자가 닫히고 칸을 쓸 수 없다', () => {
    const state = createInitialState({
      mode: 'div',
      decimal: true,
      dividend: '1.68',
      divisor: '0.24',
    });
    const numbers = divGridNumbers(state);
    expect(numbers.gridOpen).toBe(false);
    expect(observe(state)['gridOpen']).toBe(false);
    expect(enter(state, 'quotient', 2, '1')).toBe(state);
  });
});

describe('div decimal 오류 분류', () => {
  it('가운데 0을 빠뜨린 2.8은 MC-DIV-QUOTIENT-ZERO', () => {
    const state = createInitialState({
      mode: 'div',
      decimal: true,
      dividend: '6.24',
      divisor: 3,
      debugSample: { quotientRaw: '2. 8' },
    });
    const plan = computeDivPlan(state);
    expect(plan.reading.quotientText).toBe('14/5');
    expect(classifyDiv(state, plan).map((error) => error.code)).toContain('MC-DIV-QUOTIENT-ZERO');
  });

  it('2.08인데 점이 없으면 MC-DEC-POINT-PLACEMENT', () => {
    const state = { ...solved624(), quotientPoint: null };
    const plan = computeDivPlan(state);
    expect(classifyDiv(state, plan).map((error) => error.code)).toContain('MC-DEC-POINT-PLACEMENT');
  });

  it('열 0에 7을 쓰고 점을 열 1에 놓으면 0.7로 읽어 MC-DEC-POINT-PLACEMENT', () => {
    // 1.68 ÷ 0.24 → 양쪽 ×100 → 168 ÷ 24. 열 0 아래 몫 칸이 없어도 점 위치가 틀리면 기록한다.
    let state = createInitialState({
      mode: 'div',
      decimal: true,
      dividend: '1.68',
      divisor: '0.24',
    });
    state = scaleBoth(state, 2);
    state = enter(state, 'quotient', 0, '7');
    state = placePoint(state, 1);
    const plan = computeDivPlan(state);
    expect(plan.reading.quotientPoint).toBe(1);
    // 열 0 아래(소수 자리)에 쓴 몫 칸이 없어도 점 위치만으로 기록한다.
    expect(plan.reading.quotientLowest).toBe(0);
    const pointErrors = classifyDiv(state, plan).filter(
      (error) => error.code === 'MC-DEC-POINT-PLACEMENT',
    );
    expect(pointErrors).toHaveLength(1);
    expect(pointErrors[0]?.column).toBe(1);
  });

  it('9.3 ÷ 6을 1.5에서 멈추면 MC-DIV-NO-EXTEND-ZERO', () => {
    let state = createInitialState({
      mode: 'div',
      decimal: true,
      dividend: '9.3',
      divisor: 6,
      extendZeros: 2,
    });
    state = enter(state, 'quotient', 0, '1');
    state = enter(state, 'div-product', 0, '6', 0);
    state = enter(state, 'div-diff', 0, '3', 0);
    state = enter(state, 'quotient', -1, '5');
    state = enter(state, 'div-diff', -1, '3', 0);
    state = enter(state, 'div-product', -1, '3', -1);
    state = enter(state, 'div-product', 0, '0', -1);
    state = enter(state, 'div-diff', -1, '3', -1);
    state = enter(state, 'div-diff', 0, '0', -1);
    state = placePoint(state, 0);
    expect(classifyDiv(state, computeDivPlan(state)).map((error) => error.code)).toContain(
      'MC-DIV-NO-EXTEND-ZERO',
    );

    const noExtend = { ...state, extendLimit: 0 };
    expect(
      classifyDiv(noExtend, computeDivPlan(noExtend)).map((error) => error.code),
    ).not.toContain('MC-DIV-NO-EXTEND-ZERO');
  });

  it('나누는 수만 두 칸 옮기고 몫을 쓰면 MC-DEC-DIV-SCALE-ONE-SIDE', () => {
    let state = createInitialState({
      mode: 'div',
      decimal: true,
      dividend: '1.68',
      divisor: '0.24',
      allowOneSideScale: true,
    });
    state = apply(state, { type: 'scale', side: 'divisor', to: 2 });
    state = enter(state, 'quotient', -2, '7');
    expect(classifyDiv(state, computeDivPlan(state)).map((error) => error.code)).toContain(
      'MC-DEC-DIV-SCALE-ONE-SIDE',
    );

    let experiment = createInitialState({
      mode: 'div',
      decimal: true,
      dividend: '1.68',
      divisor: '0.24',
      allowOneSideScale: true,
    });
    experiment = apply(experiment, { type: 'scale', side: 'divisor', to: 2 });
    expect(
      classifyDiv(experiment, computeDivPlan(experiment)).map((error) => error.code),
    ).not.toContain('MC-DEC-DIV-SCALE-ONE-SIDE');
  });

  it('바른 풀이에는 오개념 코드가 없다', () => {
    for (const state of [solved624(), solved93(), solved045(), solved168()]) {
      expect(observe(state)['misconceptions']).toEqual([]);
    }
  });
});

describe('div decimal debugSample', () => {
  it('quotientRaw "2. 8"은 친구 풀이 단계(내림 24)와 skippedZero를 만든다', () => {
    const state = createInitialState({
      mode: 'div',
      decimal: true,
      dividend: '6.24',
      divisor: 3,
      debugSample: { quotientRaw: '2. 8' },
    });
    const plan = computeDivPlan(state);
    expect(plan.reading.skippedZero).toBe(true);
    expect(plan.reading.quotientRaw).toBe('2. 8');
    expect(plan.steps[0]?.expectedRowValue?.toString()).toBe('24');
    expect(state.divDiffs['0']).toEqual({ '0': '0', '-1': '2', '-2': '4' });
  });
});

describe('div decimal predicates와 events', () => {
  it('quotientIs·remainderIs·remainderGridIs·scaleIs·oneSideTried', () => {
    const observation = observe(solved624());
    expect(quotientIs(observation, { value: '2.08' })).toBe(true);
    expect(quotientIs(observation, { value: '52/25' })).toBe(true);
    expect(remainderIs(observation, { value: 0 })).toBe(true);
    expect(remainderGridIs(observation, { value: '0' })).toBe(true);

    const scaled = observe(solved168());
    expect(scaleIs(scaled, { factor: 100 })).toBe(true);
    expect(scaleIs(scaled, { factor: 10 })).toBe(false);
    expect(oneSideTried(observe(solved624()), undefined)).toBe(false);
  });
});
