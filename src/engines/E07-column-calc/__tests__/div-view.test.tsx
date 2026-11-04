/** @vitest-environment jsdom */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../reduce';
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
