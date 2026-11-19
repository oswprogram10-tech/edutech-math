/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import { stepSolverStrings as S } from '../strings.ko';
import type { OrderTreeState, StepSolverAction } from '../types';
import { StepSolverView } from '../View';

afterEach(cleanup);

function setup(expr: string, showTree = true) {
  const config = { mode: 'order-tree' as const, expr, showTree };
  let state = createInitialState(config);
  const actions: StepSolverAction[] = [];
  const view = render(
    <StepSolverView
      config={config}
      state={state}
      dispatch={(action) => {
        actions.push(action);
      }}
      cpa="A"
      mode="order-tree"
      readOnly={false}
      targetSize={48}
    />,
  );
  return {
    view,
    actions,
    getState: () => state,
    setState: (next: OrderTreeState) => (state = next),
  };
}

describe('order-tree 화면', () => {
  it('시작 화면 DOM에 끝값이 없다', () => {
    const { view } = setup('36 − 4 × 5');
    const text = view.container.textContent ?? '';
    expect(text).not.toContain('16');
    expect(text).not.toContain('20');
    expect(view.container.querySelectorAll('[data-op]')).toHaveLength(2);
  });

  it('showTree=false면 트리 그림이 없다', () => {
    const shown = setup('36 − 4 × 5');
    expect(shown.view.queryByTestId('order-tree-canvas')).not.toBeNull();
    cleanup();
    const hidden = setup('36 − 4 × 5', false);
    expect(hidden.view.queryByTestId('order-tree-canvas')).toBeNull();
    expect(hidden.view.queryByTestId('order-expr')).not.toBeNull();
  });

  it('연산 기호를 누르면 tap Action을 보낸다', () => {
    const { view, actions } = setup('36 − 4 × 5');
    fireEvent.click(view.getByTestId('op-1'));
    expect(actions).toEqual([{ type: 'tap', opIndex: 1 }]);
  });

  it('틀린 누름은 문구만 보이고 ✓ ✕ 표시는 없다', () => {
    const config = { mode: 'order-tree' as const, expr: '36 − 4 × 5' };
    const state = reduce(createInitialState(config), { type: 'tap', opIndex: 0 });
    if (state.mode !== 'order-tree') throw new Error('mode');
    const view = render(
      <StepSolverView
        config={config}
        state={state}
        dispatch={() => {}}
        cpa="A"
        mode="order-tree"
        readOnly={false}
        targetSize={48}
      />,
    );
    expect(view.getByTestId('order-wrong-message').textContent).toBe(S.orderTree.wrongTap);
    const text = view.container.textContent ?? '';
    expect(text).not.toMatch(/[✓✕✗]/);
    expect(view.container.querySelector('[data-shaking="true"]')).not.toBeNull();
  });

  it('단추 이름과 키보드 이동', () => {
    const { view, actions } = setup('48 ÷ 6 × 2');
    const first = view.getByTestId('op-0');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement?.getAttribute('data-op')).toBe('1');
    fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' });
    expect(actions).toEqual([{ type: 'tap', opIndex: 1 }]);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Backspace' });
    expect(actions.at(-1)).toEqual({ type: 'undo' });
    expect(view.getByLabelText(S.orderTree.opAria('÷'))).toBeTruthy();
  });
});
