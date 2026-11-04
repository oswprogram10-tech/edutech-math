import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { estimateDigits, estimateIsMultiple, estimateSignal } from '../estimate';
import { createInitialState, reduce } from '../reduce';
import type { ColumnCalcAction, ColumnCalcConfig, ColumnCalcState } from '../types';

function estimateState(config: ColumnCalcConfig = {}): ColumnCalcState {
  return createInitialState({ mode: 'estimate', op: 'add', a: 389, b: 412, ...config });
}

function apply(state: ColumnCalcState, action: ColumnCalcAction): ColumnCalcState {
  const next = reduce(state, action);
  assertSerializable(next);
  return next;
}

function typeEstimate(state: ColumnCalcState, text: string): ColumnCalcState {
  let current = state;
  for (const digit of text) {
    current = apply(current, { type: 'enter-estimate', digit });
  }
  return current;
}

function fillResult(
  state: ColumnCalcState,
  digits: Readonly<Record<number, string>>,
): ColumnCalcState {
  let current = state;
  for (const [column, digit] of Object.entries(digits)) {
    current = apply(current, { type: 'enter', row: 'result', column: Number(column), digit });
  }
  return current;
}

function locked(estimate: string, config: ColumnCalcConfig = {}): ColumnCalcState {
  const state = typeEstimate(estimateState(config), estimate);
  return apply(state, { type: 'lock-estimate' });
}

describe('E07 어림', () => {
  it('어림값을 정하기 전에는 격자 입력을 무시한다', () => {
    const state = estimateState();
    expect(state.phase).toBe('estimate');
    expect(state.estimate).toBeNull();
    expect(apply(state, { type: 'enter', row: 'result', column: 0, digit: '1' })).toBe(state);
  });

  it('어림값이 없으면 잠그지 않는다', () => {
    const state = estimateState();
    expect(apply(state, { type: 'lock-estimate' })).toBe(state);
  });

  it('어림값 800을 정하고 801을 계산하면 초록 신호다', () => {
    let state = locked('800');
    expect(state.phase).toBe('calc');
    expect(estimateDigits(state)).toBe('800');
    expect(estimateIsMultiple(state)).toBe(true);

    state = fillResult(state, { 0: '1', 1: '0', 2: '8' });
    expect(estimateSignal(state)).toBe('green');
  });

  it('신호 경계: 차이가 green과 같으면 초록, yellow와 같으면 노랑, 넘으면 빨강', () => {
    const green = fillResult(locked('800'), { 0: '0', 1: '0', 2: '7' });
    expect(estimateSignal(green)).toBe('green');

    const yellow = fillResult(locked('800'), { 0: '0', 1: '0', 2: '6' });
    expect(estimateSignal(yellow)).toBe('yellow');

    const red = fillResult(locked('800'), { 0: '9', 1: '9', 2: '5' });
    expect(estimateSignal(red)).toBe('red');
  });

  it('결과가 완성되기 전에는 신호가 없다', () => {
    let state = locked('800');
    state = fillResult(state, { 0: '1' });
    expect(estimateSignal(state)).toBeNull();
  });

  it('roundTo·tolerance 설정을 쓴다', () => {
    const state = typeEstimate(estimateState({ roundTo: 10 }), '800');
    expect(estimateIsMultiple(state)).toBe(true);
    expect(estimateSignal(state)).toBeNull();
    expect(state.roundTo).toBe(10);
    expect(state.toleranceGreen).toBe('10');
    expect(state.toleranceYellow).toBe('20');
  });

  it('sample은 결과를 미리 채우고, 잠근 뒤 신호를 보여 준다', () => {
    let state = estimateState({ sample: '500' });
    expect(state.hasSample).toBe(true);
    expect(state.result).toEqual({ '0': '0', '1': '0', '2': '5' });
    expect(estimateSignal(state)).toBeNull();

    state = typeEstimate(state, '800');
    state = apply(state, { type: 'lock-estimate' });
    expect(estimateSignal(state)).toBe('red');

    const rechecked = apply(state, { type: 'recheck' });
    expect(rechecked.rechecked).toBe(true);
    expect(rechecked.result).toEqual({});
    expect(estimateSignal(rechecked)).toBeNull();
  });

  it('곱셈 sample은 부분곱 줄을 채우지 않아도 결과만으로 신호를 낸다', () => {
    let state = createInitialState({
      mode: 'estimate',
      op: 'mul',
      a: 48,
      b: 6,
      roundTo: 10,
      tolerance: { green: 60, yellow: 120 },
      sample: '2448',
    });
    state = typeEstimate(state, '2000');
    state = apply(state, { type: 'lock-estimate' });
    expect(state.phase).toBe('calc');
    expect(state.result).toEqual({ '0': '8', '1': '4', '2': '4', '3': '2' });
    expect(estimateSignal(state)).toBe('red');
  });
});
