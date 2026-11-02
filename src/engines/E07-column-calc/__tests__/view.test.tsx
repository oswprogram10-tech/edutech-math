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
});
