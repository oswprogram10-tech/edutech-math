/** @vitest-environment jsdom */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import type { ColumnCalcConfig, ColumnCalcState } from '../types';
import { ColumnCalcView } from '../View';

afterEach(cleanup);

function renderDiv(config: ColumnCalcConfig, state?: ColumnCalcState, cpa: 'C' | 'P' | 'A' = 'A') {
  const current = state ?? createInitialState(config);
  return render(
    <ColumnCalcView
      config={config}
      state={current}
      dispatch={() => {}}
      cpa={cpa}
      mode="div"
      targetSize={48}
    />,
  );
}

function gridText(container: HTMLElement): string {
  return container.querySelector('[data-testid="column-grid"]')?.textContent ?? '';
}

describe('E07 div 화면은 정답 값을 드러내지 않는다', () => {
  it('52÷4 기본 화면에 몫 13·곱 12·나머지 0이 없다', () => {
    const config: ColumnCalcConfig = { mode: 'div', dividend: 52, divisor: 4 };
    const { container } = renderDiv(config);
    const text = gridText(container);
    expect(text).not.toContain('13');
    expect(text).not.toContain('12');
    expect(text).not.toContain('정답');
    // 몫 칸은 나누어지는 수의 모든 열(십·일)에 열린다.
    expect(container.querySelectorAll('[data-row="quotient"]').length).toBe(2);
  });

  it('408÷4 화면에 몫 102가 없다', () => {
    const config: ColumnCalcConfig = { mode: 'div', dividend: 408, divisor: 4 };
    const { container } = renderDiv(config);
    expect(gridText(container)).not.toContain('102');
    expect(container.querySelectorAll('[data-row="quotient"]').length).toBe(3);
  });

  it('83÷6 화면에 몫 13과 나머지 5가 없다', () => {
    const config: ColumnCalcConfig = { mode: 'div', dividend: 83, divisor: 6 };
    const { container } = renderDiv(config);
    const text = gridText(container);
    expect(text).not.toContain('13');
    expect(text).not.toContain('5');
  });

  it('95÷23 A 단계는 사다리를 숨겨 곱 92와 몫 4를 보이지 않는다', () => {
    const config: ColumnCalcConfig = {
      mode: 'div',
      dividend: 95,
      divisor: 23,
      estimateBar: { show: 'C-P', maxMultiple: 9 },
    };
    const { container } = renderDiv(config, undefined, 'A');
    const text = gridText(container);
    expect(text).not.toContain('92');
    expect(text).not.toContain('4');
    expect(container.querySelector('[aria-label="배수 사다리"]')).toBeNull();
  });

  it('95÷23 C 단계 사다리는 92를 숫자로 쓰지 않고 막대로만 보인다', () => {
    const config: ColumnCalcConfig = {
      mode: 'div',
      dividend: 95,
      divisor: 23,
      estimateBar: { show: 'C-P', maxMultiple: 9 },
    };
    const { container } = renderDiv(config, undefined, 'C');
    const ladder = container.querySelector('[aria-label="배수 사다리"]');
    expect(ladder).not.toBeNull();
    expect(ladder?.textContent ?? '').not.toContain('92');
  });

  it('빈 몫 칸은 flagSkippedZero가 켜졌을 때만 표시된다', () => {
    const config: ColumnCalcConfig = {
      mode: 'div',
      dividend: 408,
      divisor: 4,
      flagSkippedZero: true,
    };
    const state = createInitialState(config);
    // 십의 자리를 비우고 일의 자리에 2를 쓴 상태를 만든다.
    let next = state;
    next = { ...next, quotient: { '2': '1', '0': '2' } };
    const { container } = renderDiv(config, next, 'A');
    expect(container.querySelectorAll('[data-row="quotient"][data-gap]').length).toBeGreaterThan(0);
  });
});

describe('E07 배수 사다리는 고른 후보 하나만 넘침을 보인다', () => {
  const config: ColumnCalcConfig = {
    mode: 'div',
    dividend: 95,
    divisor: 23,
    estimateBar: { show: 'C-P', maxMultiple: 9 },
  };

  function atUnitsColumn(): ColumnCalcState {
    return reduce(createInitialState(config), {
      type: 'select',
      row: 'quotient',
      column: 0,
    });
  }

  it('아무것도 고르기 전에는 C·P 모두 넘침·모자람 표시가 없다', () => {
    const state = atUnitsColumn();
    for (const cpa of ['C', 'P'] as const) {
      const { container, unmount } = renderDiv(config, state, cpa);
      expect(container.querySelectorAll('[data-over]').length).toBe(0);
      expect(container.querySelector('[aria-label*="선을 넘었어요"]')).toBeNull();
      expect(container.querySelector('[aria-label*="선보다 모자라요"]')).toBeNull();
      expect(container.textContent).not.toContain('선을 넘었어요');
      expect(container.textContent).not.toContain('선보다 모자라요');
      // 후보 버튼은 모두 같은 크기의 숫자 버튼이다(막대 높이를 쓰지 않는다).
      const buttons = [...container.querySelectorAll('[aria-label$="배"]')];
      expect(buttons.length).toBe(9);
      for (const button of buttons) {
        const style = button.getAttribute('style') ?? '';
        expect(/(^|;)\s*height\s*:/.test(style)).toBe(false);
        expect(style).toContain('48px');
      }
      unmount();
    }
  });

  it('5를 고르면 그 후보 하나만 넘침으로 표시된다', () => {
    const state = reduce(atUnitsColumn(), { type: 'try-estimate', column: 0, k: 5 });
    const { container, unmount } = renderDiv(config, state, 'C');
    const over = [...container.querySelectorAll('[data-over]')];
    expect(over.length).toBe(1);
    expect(over[0]?.getAttribute('data-candidate')).toBe('5');
    expect(container.textContent).toContain('선을 넘었어요');
    expect(container.textContent).not.toContain('선보다 모자라요');
    unmount();

    // P 단계는 넘침 표시(data-over) 없이 문구만 보여 준다.
    const p = renderDiv(config, state, 'P');
    expect(p.container.querySelectorAll('[data-over]').length).toBe(0);
    expect(p.container.textContent).toContain('선을 넘었어요');
    p.unmount();
  });
});
