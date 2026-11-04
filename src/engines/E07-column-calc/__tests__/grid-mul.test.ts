import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { computeMulPlan, isPlaceholder, readRowValue, rowsComplete } from '../grid-mul';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { ColumnCalcAction, ColumnCalcConfig, ColumnCalcState } from '../types';

function mulState(config: ColumnCalcConfig): ColumnCalcState {
  return createInitialState({ mode: 'mul', ...config });
}

function apply(state: ColumnCalcState, action: ColumnCalcAction): ColumnCalcState {
  const next = reduce(state, action);
  assertSerializable(next);
  return next;
}

function enterPartial(
  state: ColumnCalcState,
  index: number,
  column: number,
  digit: string,
): ColumnCalcState {
  return apply(state, { type: 'enter', row: 'partial', column, digit, index });
}

function enterResult(state: ColumnCalcState, column: number, digit: string): ColumnCalcState {
  return apply(state, { type: 'enter', row: 'result', column, digit });
}

function enterDigits(
  state: ColumnCalcState,
  row: 'partial' | 'result',
  digits: Readonly<Record<number, string>>,
  index?: number,
): ColumnCalcState {
  let current = state;
  for (const [column, digit] of Object.entries(digits)) {
    current =
      row === 'result'
        ? enterResult(current, Number(column), digit)
        : enterPartial(current, index ?? 0, Number(column), digit);
  }
  return current;
}

describe('E07 곱셈 격자 계획', () => {
  it('213×4는 받아올림 한 줄 방식으로 결과 852를 만든다', () => {
    const state = mulState({ a: 213, b: 4 });
    const plan = computeMulPlan(state);
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.style).toBe('carry');
    expect(plan.singleDigit).toBe(true);
    expect(plan.rows).toEqual([]);
    expect(plan.product).toBe(852n);
    expect(plan.requiredColumns).toEqual([0, 1, 2]);

    const withCarry = apply(state, { type: 'enter', row: 'carry', column: 1, digit: '1' });
    const filled = enterDigits(withCarry, 'result', { 0: '2', 1: '5', 2: '8' });
    expect(filled.carries).toEqual({ '1': '1' });
    const observation = observe(filled);
    expect(observation['complete']).toBe(true);
    expect(observation['result']).toBe('852');
    expect(observation['misconceptions']).toEqual([]);
  });

  it('46×27은 부분곱 줄 322·920과 합 1242, 둘째 줄 일의 자리는 점선 0이다', () => {
    const state = mulState({ a: 46, b: 27 });
    const plan = computeMulPlan(state);
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.style).toBe('carry');
    expect(plan.rows.map((row) => row.value)).toEqual([322n, 92n]);
    expect(plan.rows.map((row) => row.shiftedValue)).toEqual([322n, 920n]);
    expect(plan.rows[0]?.carryColumns).toEqual([1, 2]);
    expect(plan.rows[1]?.placeholderColumns).toEqual([0]);
    // 92가 아니라 그 줄이 가질 수 있는 최대 자릿수(a 2자리 + 1)만큼 연다(십~천).
    expect(plan.rows[1]?.columns).toEqual([1, 2, 3]);
    expect(plan.resultColumns).toEqual([0, 1, 2, 3]);
    const second = plan.rows[1];
    if (!second) return;
    expect(isPlaceholder(second, 0)).toBe(true);
    expect(plan.product).toBe(1242n);
    expect(plan.requiredColumns).toEqual([0, 1, 2, 3]);

    let filled = enterDigits(state, 'partial', { 0: '2', 1: '2', 2: '3' }, 0);
    filled = enterDigits(filled, 'partial', { 1: '2', 2: '9' }, 1);
    expect(readRowValue(filled, second)).toBe('920');
    expect(rowsComplete(filled, plan)).toBe(true);
    filled = enterDigits(filled, 'result', { 0: '2', 1: '4', 2: '2', 3: '1' });

    const observation = observe(filled);
    expect(observation['partials']).toEqual(['322', '920']);
    expect(observation['expectedRowCount']).toBe(2);
    expect(observation['rowsComplete']).toBe(true);
    expect(observation['complete']).toBe(true);
    expect(observation['result']).toBe('1242');
    expect(observation['misconceptions']).toEqual([]);
  });

  it('46×27 둘째 줄은 92든 920이든 열린 칸 수가 같다(천~일)', () => {
    const base = mulState({ a: 46, b: 27 });
    const plan = computeMulPlan(base);
    expect(plan).not.toBeNull();
    if (!plan) return;
    const second = plan.rows[1];
    if (!second) return;
    // 일(0)은 자리 밀기 0이라 점선 칸, 십~천 3칸을 열어 모두 4칸이다.
    expect(second.end + 1).toBe(4);
    expect(second.columns).toEqual([1, 2, 3]);

    const shifted = enterDigits(base, 'partial', { 1: '2', 2: '9' }, 1);
    expect(readRowValue(shifted, second)).toBe('920');
    expect(computeMulPlan(shifted)?.rows[1]?.columns).toEqual(second.columns);

    const shiftForgotten = enterDigits(
      mulState({ a: 46, b: 27, showZeroPlaceholder: false }),
      'partial',
      { 0: '2', 1: '9' },
      1,
    );
    expect(readRowValue(shiftForgotten, second)).toBe('92');
    const forgottenRow = computeMulPlan(shiftForgotten)?.rows[1];
    expect(forgottenRow?.end).toBe(second.end);
    expect((forgottenRow?.end ?? -1) + 1).toBe(4);
  });

  it('partial-products 줄도 그 자리 곱의 최대 자릿수만큼 연다', () => {
    const plan = computeMulPlan(mulState({ a: 46, b: 5, style: 'partial-products' }));
    expect(plan).not.toBeNull();
    if (!plan) return;
    // 6×5(30)는 0~1, 4×5를 십의 자리로 민 200은 0~2까지 연다.
    expect(plan.rows[0]?.columns).toEqual([0, 1]);
    expect(plan.rows[1]?.columns).toEqual([0, 1, 2]);
  });

  it('46×5 partial-products는 30·200 부분곱과 합 230을 만든다', () => {
    const state = mulState({ a: 46, b: 5, style: 'partial-products' });
    const plan = computeMulPlan(state);
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.style).toBe('partial-products');
    expect(plan.rows.map((row) => row.value)).toEqual([30n, 200n]);
    expect(plan.rows.map((row) => row.placeholderColumns)).toEqual([[], []]);
    expect(plan.product).toBe(230n);

    let filled = enterDigits(state, 'partial', { 0: '0', 1: '3' }, 0);
    filled = enterDigits(filled, 'partial', { 0: '0', 1: '0', 2: '2' }, 1);
    filled = enterDigits(filled, 'result', { 0: '0', 1: '3', 2: '2' });

    const observation = observe(filled);
    expect(observation['partials']).toEqual(['30', '200']);
    expect(observation['complete']).toBe(true);
    expect(observation['result']).toBe('230');
  });

  it('0이 든 508×34는 2032·15240과 합 17272를 만든다', () => {
    const state = mulState({ a: 508, b: 34 });
    const plan = computeMulPlan(state);
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.rows.map((row) => row.value)).toEqual([2032n, 1524n]);
    expect(plan.rows.map((row) => row.shiftedValue)).toEqual([2032n, 15240n]);
    expect(plan.rows[1]?.placeholderColumns).toEqual([0]);
    expect(plan.product).toBe(17272n);
    expect(plan.requiredColumns).toEqual([0, 1, 2, 3, 4]);
  });

  it('9999×9도 받아올림 한 줄로 89991을 만든다', () => {
    const state = mulState({ a: 9999, b: 9 });
    const plan = computeMulPlan(state);
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.rows).toEqual([]);
    expect(plan.product).toBe(89991n);
    expect(plan.requiredColumns).toEqual([0, 1, 2, 3, 4]);
  });

  it('b가 두 자리면 partial-products 설정도 받아올림 방식으로 바꾼다', () => {
    const plan = computeMulPlan(mulState({ a: 46, b: 27, style: 'partial-products' }));
    expect(plan?.style).toBe('carry');
  });
});
