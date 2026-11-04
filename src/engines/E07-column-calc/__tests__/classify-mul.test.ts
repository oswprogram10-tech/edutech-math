import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { classifyMul } from '../classify-mul';
import { computeMulPlan } from '../grid-mul';
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

function fillPartial(
  state: ColumnCalcState,
  index: number,
  digits: Readonly<Record<number, string>>,
): ColumnCalcState {
  let current = state;
  for (const [column, digit] of Object.entries(digits)) {
    current = apply(current, {
      type: 'enter',
      row: 'partial',
      column: Number(column),
      digit,
      index,
    });
  }
  return current;
}

function fillResult(
  state: ColumnCalcState,
  digits: Readonly<Record<number, string>>,
): ColumnCalcState {
  let current = state;
  for (const [column, digit] of Object.entries(digits)) {
    current = apply(current, {
      type: 'enter',
      row: 'result',
      column: Number(column),
      digit,
    });
  }
  return current;
}

function codeOf(state: ColumnCalcState): string | null {
  const plan = computeMulPlan(state);
  if (!plan) return null;
  return classifyMul(state, plan)?.code ?? null;
}

describe('E07 곱셈 오류 분류', () => {
  it('MC-MUL-PARTIAL-SHIFT: 46×27 둘째 줄에 92를 쓴 경우', () => {
    let state = mulState({ a: 46, b: 27, showZeroPlaceholder: false });
    state = fillPartial(state, 0, { 0: '2', 1: '2', 2: '3' });
    state = fillPartial(state, 1, { 0: '2', 1: '9' });
    expect(codeOf(state)).toBe('MC-MUL-PARTIAL-SHIFT');
  });

  it('MC-MUL-PARTIAL-MISSING: 합 줄에 부분곱 322만 쓴 경우', () => {
    let state = mulState({ a: 46, b: 27 });
    state = fillPartial(state, 0, { 0: '2', 1: '2', 2: '3' });
    state = fillPartial(state, 1, { 1: '2', 2: '9' });
    state = fillResult(state, { 0: '2', 1: '2', 2: '3' });
    expect(codeOf(state)).toBe('MC-MUL-PARTIAL-MISSING');
  });

  it('MC-MUL-CARRY-ADD-BEFORE: 46×7에서 받은 올림을 곱하기 전에 더한 경우', () => {
    let state = mulState({ a: 46, b: 7 });
    // 46×7 = 322. 십의 자리는 4×7+4 = 32 → 2인데 (4+4)×7 = 56 → 6으로 썼다.
    state = fillResult(state, { 0: '2', 1: '6', 2: '3' });
    const plan = computeMulPlan(state);
    expect(plan?.product).toBe(322n);
    expect(codeOf(state)).toBe('MC-MUL-CARRY-ADD-BEFORE');
  });

  it('MC-PV-NO-CARRY: 27×3에서 올림 없이 61을 쓴 경우', () => {
    let state = mulState({ a: 27, b: 3 });
    state = fillResult(state, { 0: '1', 1: '6' });
    expect(codeOf(state)).toBe('MC-PV-NO-CARRY');
  });

  it('MC-MUL-NO-PLACE-VALUE: 23×4에서 자리값 없이 8+12=20을 쓴 경우', () => {
    let state = mulState({ a: 23, b: 4 });
    state = fillResult(state, { 0: '0', 1: '2' });
    const plan = computeMulPlan(state);
    expect(plan?.product).toBe(92n);
    expect(codeOf(state)).toBe('MC-MUL-NO-PLACE-VALUE');
  });

  it('바른 값은 어떤 곱셈 오개념에도 걸리지 않는다', () => {
    let state = mulState({ a: 46, b: 27 });
    state = fillPartial(state, 0, { 0: '2', 1: '2', 2: '3' });
    state = fillPartial(state, 1, { 1: '2', 2: '9' });
    state = fillResult(state, { 0: '2', 1: '4', 2: '2', 3: '1' });
    expect(observe(state)['misconceptions']).toEqual([]);
  });

  it('MC-PV-BORROW-ACROSS-ZERO: 403−158의 십의 자리를 5로 쓴 경우', () => {
    let state = createInitialState({ mode: 'sub', a: '403', b: '158' });
    state = fillResult(state, { 0: '5', 1: '5', 2: '2' });
    const observation = observe(state);
    expect(observation['wrongColumns']).toEqual([1]);
    expect(observation['errors']).toEqual([{ column: 1, code: 'MC-PV-BORROW-ACROSS-ZERO' }]);
    expect(observation['misconceptions']).toEqual(['MC-PV-BORROW-ACROSS-ZERO']);
  });
});
