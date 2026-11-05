/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../reduce';
import type { ColumnCalcConfig, ColumnCalcState } from '../types';
import { ColumnCalcView } from '../View';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function mount(config: ColumnCalcConfig, state: ColumnCalcState) {
  const dispatch = vi.fn();
  const view = render(
    <ColumnCalcView
      config={config}
      state={state}
      dispatch={dispatch}
      cpa="A"
      mode={state.mode}
      targetSize={48}
    />,
  );
  const outside = document.createElement('div');
  outside.tabIndex = 0;
  document.body.appendChild(outside);
  return { ...view, dispatch, outside };
}

function gridOf(container: HTMLElement): HTMLElement {
  const grid = container.querySelector<HTMLElement>('[data-testid="column-grid"]');
  if (!grid) throw new Error('격자를 찾지 못했습니다.');
  return grid;
}

describe('E07 키 입력은 엔진 안에서만 격자에 들어간다(T079)', () => {
  it('DivView는 엔진 밖 요소에 초점이 있으면 숫자를 받지 않는다', () => {
    const config: ColumnCalcConfig = {
      mode: 'div',
      decimal: true,
      dividend: '8.16',
      divisor: 4,
    };
    const state = createInitialState(config);
    const { container, dispatch, outside } = mount(config, state);

    outside.focus();
    fireEvent.keyDown(outside, { key: '3' });
    expect(dispatch).not.toHaveBeenCalled();

    const grid = gridOf(container);
    grid.focus();
    fireEvent.keyDown(grid, { key: '3' });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'enter', row: 'quotient', digit: '3' }),
    );
  });

  it('MulView는 엔진 밖 요소에 초점이 있으면 숫자를 받지 않는다', () => {
    const config: ColumnCalcConfig = { mode: 'mul', a: 46, b: 27 };
    const state = createInitialState(config);
    const { container, dispatch, outside } = mount(config, state);

    outside.focus();
    fireEvent.keyDown(outside, { key: '3' });
    expect(dispatch).not.toHaveBeenCalled();

    const grid = gridOf(container);
    grid.focus();
    fireEvent.keyDown(grid, { key: '3' });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'enter', digit: '3' }));
  });

  it('AddSubView는 엔진 밖 요소에 초점이 있으면 숫자를 받지 않는다', () => {
    const config: ColumnCalcConfig = { mode: 'add' };
    const state = createInitialState(config);
    const { container, dispatch, outside } = mount(config, state);

    outside.focus();
    fireEvent.keyDown(outside, { key: '3' });
    expect(dispatch).not.toHaveBeenCalled();

    const grid = gridOf(container);
    grid.focus();
    fireEvent.keyDown(grid, { key: '3' });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'enter', digit: '3' }));
  });
});
