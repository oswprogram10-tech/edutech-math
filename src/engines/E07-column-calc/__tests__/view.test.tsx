/** @vitest-environment jsdom */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import type { ColumnCalcAction, ColumnCalcConfig, ColumnCalcState } from '../types';
import { ColumnCalcView } from '../View';

afterEach(cleanup);

function apply(state: ColumnCalcState, action: ColumnCalcAction): ColumnCalcState {
  return reduce(state, action);
}

function addWrong62(): ColumnCalcState {
  let state = createInitialState({ mode: 'add' });
  state = apply(state, { type: 'enter', row: 'result', column: 0, digit: '2' });
  state = apply(state, { type: 'enter', row: 'result', column: 1, digit: '6' });
  return state;
}

function subWrong45(): ColumnCalcState {
  let state = createInitialState({ mode: 'sub' });
  state = apply(state, { type: 'enter', row: 'result', column: 0, digit: '5' });
  state = apply(state, { type: 'enter', row: 'result', column: 1, digit: '4' });
  return state;
}

function renderView(config: ColumnCalcConfig, state: ColumnCalcState) {
  return render(
    <ColumnCalcView
      config={config}
      state={state}
      dispatch={() => {}}
      cpa="C"
      mode={state.mode}
      targetSize={48}
    />,
  );
}

function correctnessMarks(container: HTMLElement): Element[] {
  return [
    ...container.querySelectorAll(
      '[data-correct], [data-incorrect], [data-wrong], [data-expected], [aria-invalid="true"]',
    ),
  ];
}

describe('E07 화면은 칸별 정답·오답을 표시하지 않는다', () => {
  it('틀린 덧셈 62를 써도 결과 칸은 학생이 쓴 숫자만 보여 준다', () => {
    const { container } = renderView({ mode: 'add' }, addWrong62());
    expect(correctnessMarks(container)).toEqual([]);

    const resultCells = [...container.querySelectorAll('[data-row="result"]')];
    const texts = resultCells.map((cell) => cell.textContent);
    expect(texts).toContain('6');
    expect(texts).not.toContain('7');

    const resultButtons = resultCells.filter(
      (cell): cell is HTMLButtonElement => cell instanceof HTMLButtonElement,
    );
    expect(resultButtons.length).toBeGreaterThan(0);
    for (const button of resultButtons) {
      expect(/correct|wrong|error|invalid/i.test(button.className)).toBe(false);
      expect(button.getAttribute('style')).toBeNull();
    }
    expect(container.textContent).not.toContain('정답');
  });

  it('틀린 뺄셈 45를 써도 결과 칸에 기대값 3이 나타나지 않는다', () => {
    const { container } = renderView({ mode: 'sub' }, subWrong45());
    expect(correctnessMarks(container)).toEqual([]);

    const resultCells = [...container.querySelectorAll('[data-row="result"]')];
    const texts = resultCells.map((cell) => cell.textContent);
    expect(texts).toContain('4');
    expect(texts).not.toContain('3');
    expect(container.textContent).not.toContain('정답');
  });

  it('소수점을 맞춘 decimal 화면도 칸별 판정 표시가 없다', () => {
    let state = createInitialState({ mode: 'decimal', a: '3.5', b: '1.27' });
    state = apply(state, { type: 'place', number: 'a', pointColumn: 0 });
    state = apply(state, { type: 'place', number: 'b', pointColumn: 0 });
    state = apply(state, { type: 'enter', row: 'result', column: -2, digit: '7' });
    state = apply(state, { type: 'enter', row: 'result', column: -1, digit: '7' });
    state = apply(state, { type: 'enter', row: 'result', column: 0, digit: '4' });

    const { container } = renderView({ mode: 'decimal', a: '3.5', b: '1.27' }, state);
    expect(correctnessMarks(container)).toEqual([]);
    expect(container.querySelectorAll('[data-point="true"]').length).toBeGreaterThan(0);
  });

  it('틀린 곱셈 46×27을 써도 기대값 1242와 칸별 판정이 나타나지 않는다', () => {
    let state = createInitialState({ mode: 'mul', a: 46, b: 27 });
    for (const [column, digit] of [
      [0, '3'],
      [1, '2'],
      [2, '2'],
    ] as const) {
      state = apply(state, { type: 'enter', row: 'partial', column, digit, index: 0 });
    }
    // 자리 밀기를 잊고 92를 그대로 쓴 틀린 풀이(자리 밀기 0을 쓰지 않음).
    for (const [column, digit] of [
      [1, '2'],
      [2, '9'],
    ] as const) {
      state = apply(state, { type: 'enter', row: 'partial', column, digit, index: 1 });
    }
    for (const [column, digit] of [
      [0, '1'],
      [1, '5'],
      [2, '4'],
      [3, '2'],
    ] as const) {
      state = apply(state, { type: 'enter', row: 'result', column, digit });
    }

    const { container } = renderView({ mode: 'mul', a: 46, b: 27 }, state);
    expect(correctnessMarks(container)).toEqual([]);
    expect(container.querySelectorAll('[data-row="partial"]').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('1242');
    expect(container.textContent).not.toContain('정답');
  });

  it('어림 화면도 학생이 쓴 어림값·결과만 보여 주고 기대값 801을 쓰지 않는다', () => {
    let state = createInitialState({
      mode: 'estimate',
      op: 'add',
      a: 389,
      b: 412,
      sample: '500',
    });
    for (const digit of '800') {
      state = apply(state, { type: 'enter-estimate', digit });
    }
    state = apply(state, { type: 'lock-estimate' });
    // sample 500을 지우고 학생이 799를 쓴 상태(기대값 801).
    state = apply(state, { type: 'recheck' });
    for (const [column, digit] of [
      [0, '9'],
      [1, '9'],
      [2, '7'],
    ] as const) {
      state = apply(state, { type: 'enter', row: 'result', column, digit });
    }

    const { container } = renderView({ mode: 'estimate', op: 'add', a: 389, b: 412 }, state);
    expect(correctnessMarks(container)).toEqual([]);
    expect(container.textContent).not.toContain('801');
    expect(container.textContent).not.toContain('정답');

    const signal = container.querySelector('[data-testid="estimate-signal"]');
    expect(signal).not.toBeNull();
    expect(signal?.getAttribute('data-signal')).toBe('green');
    expect(signal?.textContent).toContain('가까워요');
  });
});
