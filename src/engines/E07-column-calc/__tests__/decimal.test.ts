import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { classifyDecimalMul } from '../classify-decimal';
import { emit, estimateIs, pointPlaced, shiftUsed, shiftValueIs } from '../events';
import {
  decimalEstimate,
  decimalMulComplete,
  decimalSignal,
  readDecimalResult,
  shiftFits,
  shiftValueText,
} from '../grid-decimal';
import { computeMulPlan } from '../grid-mul';
import { mulAlignment } from '../grid';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { ColumnCalcAction, ColumnCalcConfig, ColumnCalcState } from '../types';

function apply(state: ColumnCalcState, action: ColumnCalcAction): ColumnCalcState {
  const next = reduce(state, action);
  assertSerializable(next);
  return next;
}

function decimalMul(config: ColumnCalcConfig = {}): ColumnCalcState {
  return createInitialState({ mode: 'decimal', op: 'mul', a: '2.4', b: '1.3', ...config });
}

function enterResult(
  state: ColumnCalcState,
  entries: ReadonlyArray<readonly [number, string]>,
): ColumnCalcState {
  return entries.reduce(
    (current, [column, digit]) => apply(current, { type: 'enter', row: 'result', column, digit }),
    state,
  );
}

function enterPartial(
  state: ColumnCalcState,
  index: number,
  entries: ReadonlyArray<readonly [number, string]>,
): ColumnCalcState {
  return entries.reduce(
    (current, [column, digit]) =>
      apply(current, { type: 'enter', row: 'partial', column, digit, index }),
    state,
  );
}

function placePoint(state: ColumnCalcState, column: number | null): ColumnCalcState {
  return apply(state, { type: 'place-point', target: 'result', column });
}

function typeEstimate(state: ColumnCalcState, text: string): ColumnCalcState {
  return [...text].reduce(
    (current, digit) => apply(current, { type: 'enter-estimate', digit }),
    state,
  );
}

/** 2.4 × 1.3의 부분곱 줄과 결과 숫자를 채운 상태(어림값은 아직 없음). */
function filled2_4(): ColumnCalcState {
  let state = decimalMul();
  state = enterPartial(state, 0, [
    [0, '2'],
    [1, '7'],
  ]);
  state = enterPartial(state, 1, [
    [1, '4'],
    [2, '2'],
  ]);
  return enterResult(state, [
    [0, '2'],
    [1, '1'],
    [2, '3'],
  ]);
}

function lockWith(state: ColumnCalcState, text: string): ColumnCalcState {
  return apply(typeEstimate(state, text), { type: 'lock-estimate' });
}

describe('E07 소수 곱셈 격자(T077)', () => {
  it('2.4 × 1.3은 숫자열 24 × 13, 결과 312, 점 2자리에서 78/25로 읽는다', () => {
    const state = placePoint(filled2_4(), 2);
    const reading = readDecimalResult(state);

    expect(computeMulPlan(state)?.product).toBe(312n);
    expect(computeMulPlan(state)?.resultColumns).toEqual([0, 1, 2, 3]);
    expect(reading.complete).toBe(true);
    expect(reading.raw).toBe('3.12');
    expect(reading.value).toBe('78/25');
    expect(decimalMulComplete(state)).toBe(true);

    const observation = observe(state);
    expect(observation['result']).toBe('78/25');
    expect(observation['resultRaw']).toBe('3.12');
    expect(observation['resultPoint']).toBe(2);
    expect(observation['pointPlaced']).toBe(true);
    expect(observation['aligned']).toBe(true);
    expect(observation['alignment']).toBe('right-edge');
  });

  it('점 없이 312를 읽으면 312다', () => {
    const state = filled2_4();
    const reading = readDecimalResult(state);
    expect(reading.complete).toBe(true);
    expect(reading.raw).toBe('312');
    expect(reading.value).toBe('312');
    expect(decimalMulComplete(state)).toBe(false);
  });

  it('0.25 × 0.4는 결과 칸 0~3을 열고, 열 3의 0이 없으면 미완성이다', () => {
    let state = decimalMul({ a: '0.25', b: '0.4' });
    expect(computeMulPlan(state)?.resultColumns).toEqual([0, 1, 2, 3]);

    state = enterResult(state, [
      [0, '0'],
      [1, '0'],
      [2, '1'],
    ]);
    state = placePoint(state, 3);
    expect(readDecimalResult(state).complete).toBe(false);
    expect(decimalMulComplete(state)).toBe(false);

    state = apply(state, { type: 'enter', row: 'result', column: 3, digit: '0' });
    const reading = readDecimalResult(state);
    expect(reading.complete).toBe(true);
    expect(reading.raw).toBe('0.100');
    expect(reading.value).toBe('1/10');
    expect(observe(state)['result']).toBe('1/10');
  });

  it('12 × 0.5는 6, 0.5 × 0.5는 1/4로 읽는다', () => {
    let natural = decimalMul({ a: '12', b: '0.5' });
    natural = enterResult(natural, [
      [0, '0'],
      [1, '6'],
    ]);
    natural = placePoint(natural, 1);
    expect(readDecimalResult(natural).value).toBe('6');
    expect(decimalMulComplete(natural)).toBe(true);

    let half = decimalMul({ a: '0.5', b: '0.5' });
    half = enterResult(half, [
      [0, '5'],
      [1, '2'],
      [2, '0'],
    ]);
    half = placePoint(half, 2);
    expect(readDecimalResult(half).value).toBe('1/4');
    expect(decimalMulComplete(half)).toBe(true);
  });

  it('자연수 곱셈의 결과·Observation은 그대로 둔다', () => {
    const state = createInitialState({ mode: 'mul', a: 46, b: 27 });
    const observation = observe(state);
    expect(observation['resultPoint']).toBeNull();
    expect(observation['pointPlaced']).toBeNull();
    expect(observation['requireEstimate']).toBeNull();
    expect(observation['shiftValue']).toBeNull();
    expect(observation['shiftHistory']).toBeNull();
  });
});

describe('E07 requireEstimate(T077)', () => {
  it('어림값을 정하기 전에는 점을 놓지 않는다', () => {
    let state = decimalMul({ requireEstimate: true });
    expect(state.phase).toBe('estimate');
    expect(state.requireEstimate).toBe(true);

    state = enterResult(state, [
      [0, '2'],
      [1, '1'],
      [2, '3'],
    ]);
    state = placePoint(state, 2);
    expect(state.resultPoint).toBeNull();
    expect(observe(state)['phase']).toBe('estimate');
  });

  it('어림값 0과 소수점 두 개는 잠그지 않고, 0.1은 잠근다', () => {
    const zero = decimalMul({ requireEstimate: true });
    const zeroTyped = typeEstimate(zero, '0');
    expect(decimalEstimate(zeroTyped)).toBeNull();
    expect(apply(zeroTyped, { type: 'lock-estimate' }).phase).toBe('estimate');

    const twice: ColumnCalcState = { ...zero, estimate: '1.2.3' };
    expect(decimalEstimate(twice)).toBeNull();
    expect(apply(twice, { type: 'lock-estimate' }).phase).toBe('estimate');

    const tenth = lockWith(zero, '0.1');
    expect(tenth.phase).toBe('calc');
    expect(decimalEstimate(tenth)?.toString()).toBe('1/10');
    expect(estimateIs(observe(tenth), { value: '0.1' })).toBe(true);
  });

  it('신호등 경계: 2·1/2은 초록, 5·1/5은 노랑, 그 밖은 빨강이다', () => {
    const signalFor = (estimateText: string) => {
      let state = decimalMul({ requireEstimate: true });
      state = enterPartial(state, 0, [
        [0, '2'],
        [1, '7'],
      ]);
      state = enterPartial(state, 1, [
        [1, '4'],
        [2, '2'],
      ]);
      state = enterResult(state, [
        [0, '2'],
        [1, '1'],
        [2, '3'],
      ]);
      state = lockWith(state, estimateText);
      state = placePoint(state, 2);
      return decimalSignal(state);
    };

    expect(signalFor('1.56')).toBe('green'); // 3.12 ÷ 1.56 = 2
    expect(signalFor('1.5')).toBe('yellow'); // 2.08
    expect(signalFor('0.624')).toBe('yellow'); // 5
    expect(signalFor('0.6')).toBe('red'); // 5.2
    expect(signalFor('6.24')).toBe('green'); // 1/2
    expect(signalFor('15.6')).toBe('yellow'); // 1/5
  });

  it('결과가 0이면 빨강이다', () => {
    let state = decimalMul({ requireEstimate: true, a: '2.4', b: '0.0' });
    state = enterResult(state, [
      [0, '0'],
      [1, '0'],
      [2, '0'],
    ]);
    state = lockWith(state, '1');
    state = placePoint(state, 2);
    expect(readDecimalResult(state).value).toBe('0');
    expect(decimalSignal(state)).toBe('red');
  });
});

describe('E07 자릿값 기둥 시프트(T077)', () => {
  const shiftConfig: ColumnCalcConfig = {
    mode: 'decimal',
    op: 'mul',
    a: '3.75',
    b: '10',
    shiftDemo: { value: '3.75', ops: ['×10', '×0.1'] },
  };

  it('3.75 ×10 = 75/2, 처음으로 뒤 ×0.1 = 3/8이다', () => {
    let state = createInitialState(shiftConfig);
    expect(shiftValueText(state)).toBe('15/4');

    state = apply(state, { type: 'shift', op: '×10' });
    expect(shiftValueText(state)).toBe('75/2');
    expect(observe(state)['shiftValue']).toBe('75/2');
    expect(shiftValueIs(observe(state), { value: 37.5 })).toBe(true);
    expect(shiftUsed(observe(state), { op: '×10' })).toBe(true);

    state = apply(state, { type: 'shift-reset' });
    expect(state.shiftExponent).toBe(0);
    expect(state.shiftHistory).toEqual(['×10']);

    state = apply(state, { type: 'shift', op: '×0.1' });
    expect(shiftValueText(state)).toBe('3/8');
    expect(state.shiftHistory).toEqual(['×10', '×0.1']);
  });

  it('기둥 밖으로 나가는 걸음은 막고 기록하지 않는다', () => {
    let state = createInitialState({
      ...shiftConfig,
      shiftDemo: { value: '3.75', ops: ['×1000', '×10', '×0.001'] },
    });
    expect(shiftFits(state, '×0.001')).toBe(false);

    state = apply(state, { type: 'shift', op: '×1000' });
    expect(state.shiftExponent).toBe(3);
    state = apply(state, { type: 'shift', op: '×10' });
    expect(state.shiftExponent).toBe(3);
    expect(state.shiftHistory).toEqual(['×1000']);

    state = apply(state, { type: 'shift', op: '×0.001' });
    expect(state.shiftExponent).toBe(0);
  });

  it('시프트 이벤트에 op와 Rational 값을 싣는다', () => {
    const before = createInitialState(shiftConfig);
    const after = apply(before, { type: 'shift', op: '×10' });
    const events = emit(before, after, { type: 'shift', op: '×10' });
    expect(events).toContainEqual({
      name: 'shifted',
      payload: { op: '×10', value: '75/2' },
    });
  });
});

describe('E07 소수 곱셈 오류 분류(T077)', () => {
  it('결과 숫자가 맞고 점만 틀리면 MC-DEC-POINT-PLACEMENT다', () => {
    const wrong = placePoint(filled2_4(), 1);
    const codes = classifyDecimalMul(wrong).map((error) => error.code);
    expect(codes).toContain('MC-DEC-POINT-PLACEMENT');
    expect(codes).not.toContain('MC-PV-NO-CARRY');

    const right = placePoint(filled2_4(), 2);
    expect(classifyDecimalMul(right).map((error) => error.code)).not.toContain(
      'MC-DEC-POINT-PLACEMENT',
    );
  });

  it('placeCards에서 소수점끼리 맞추면 ALIGN-POINT가 나고 칸이 닫힌다', () => {
    let state = decimalMul({ a: '0.25', b: '0.4', placeCards: true });
    expect(state.aPoint).toBe(2);
    expect(state.bPoint).toBeNull();
    expect(mulAlignment(state).aligned).toBe(false);

    const blocked = apply(state, { type: 'enter', row: 'result', column: 0, digit: '1' });
    expect(blocked.result).toEqual({});

    state = apply(state, { type: 'place', number: 'b', pointColumn: 2 });
    expect(mulAlignment(state).alignment).toBe('point');
    expect(mulAlignment(state).aligned).toBe(false);
    expect(classifyDecimalMul(state).map((error) => error.code)).toContain(
      'MC-DEC-MULT-ALIGN-POINT',
    );

    const stillBlocked = apply(state, { type: 'enter', row: 'result', column: 0, digit: '1' });
    expect(stillBlocked.result).toEqual({});
  });

  it('placeCards에서 오른쪽 끝을 맞추면 ALIGN-POINT가 사라진다', () => {
    let state = decimalMul({ a: '0.25', b: '0.4', placeCards: true });
    state = apply(state, { type: 'place', number: 'b', pointColumn: 1 });
    expect(mulAlignment(state).alignment).toBe('right-edge');
    expect(mulAlignment(state).aligned).toBe(true);

    state = enterResult(state, [
      [0, '0'],
      [1, '0'],
      [2, '1'],
      [3, '0'],
    ]);
    state = placePoint(state, 3);
    expect(decimalMulComplete(state)).toBe(true);
    expect(classifyDecimalMul(state).map((error) => error.code)).not.toContain(
      'MC-DEC-MULT-ALIGN-POINT',
    );
  });
});

describe('E07 소수 곱셈 이벤트(T077)', () => {
  it('점을 놓으면 point-placed가 나고 pointPlaced가 참이 된다', () => {
    const before = filled2_4();
    const after = placePoint(before, 2);
    const events = emit(before, after, { type: 'place-point', target: 'result', column: 2 });
    expect(events).toContainEqual({
      name: 'point-placed',
      payload: { target: 'result', column: 2 },
    });
    expect(pointPlaced(observe(after), undefined)).toBe(true);
  });
});
