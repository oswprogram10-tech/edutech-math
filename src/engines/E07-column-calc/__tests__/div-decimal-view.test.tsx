/** @vitest-environment jsdom */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import type { ColumnCalcConfig } from '../types';
import { ColumnCalcView } from '../View';

afterEach(cleanup);

function renderDiv(config: ColumnCalcConfig, cpa: 'C' | 'P' | 'A' = 'A') {
  const state = createInitialState(config);
  return render(
    <ColumnCalcView
      config={config}
      state={state}
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

function quotientText(container: HTMLElement): string {
  return container.querySelector('[data-testid="quotient-row"]')?.textContent ?? '';
}

describe('E07 소수 나눗셈 화면은 정답 값을 드러내지 않는다', () => {
  it('6.24÷3 기본 화면에 몫 2.08·208이 없다', () => {
    const { container } = renderDiv({
      mode: 'div',
      decimal: true,
      dividend: '6.24',
      divisor: 3,
      flagSkippedZero: true,
    });
    const text = gridText(container);
    expect(text).not.toContain('2.08');
    expect(text).not.toContain('208');
    expect(quotientText(container)).not.toContain('208');
    expect(container.textContent).not.toContain('52/25');
  });

  it('9.3÷6 기본 화면에 몫 1.55·155가 없다', () => {
    const { container } = renderDiv({
      mode: 'div',
      decimal: true,
      dividend: '9.3',
      divisor: 6,
      extendZeros: 2,
    });
    const text = gridText(container);
    expect(text).not.toContain('1.55');
    expect(text).not.toContain('155');
    expect(container.textContent).not.toContain('31/20');
  });

  it('0.45÷5 기본 화면에 몫 0.09·9/100이 없다', () => {
    const { container } = renderDiv({
      mode: 'div',
      decimal: true,
      dividend: '0.45',
      divisor: 5,
    });
    const text = gridText(container);
    expect(text).not.toContain('0.09');
    expect(text).not.toContain('009');
    expect(container.textContent).not.toContain('9/100');
  });

  it('7.4÷1.5 기본 화면에 몫 1.4·나머지 14가 없다', () => {
    const { container } = renderDiv({
      mode: 'div',
      decimal: true,
      dividend: '7.4',
      divisor: '1.5',
      extendZeros: 0,
    });
    const text = gridText(container);
    expect(text).not.toContain('1.4');
    expect(text).not.toContain('14');
    expect(container.textContent).not.toContain('7/5');
  });

  it('1.68÷0.24는 ×100 뒤 168÷24를 보이지만 몫 7은 글자로 쓰지 않는다', () => {
    const config: ColumnCalcConfig = {
      mode: 'div',
      decimal: true,
      dividend: '1.68',
      divisor: '0.24',
      magnifier: [10, 100],
      allowOneSideScale: true,
    };
    const state = reduce(createInitialState(config), {
      type: 'scale',
      side: 'both',
      to: 2,
    });
    const { container } = render(
      <ColumnCalcView
        config={config}
        state={state}
        dispatch={() => {}}
        cpa="C"
        mode="div"
        targetSize={48}
      />,
    );
    const text = gridText(container);
    expect(text).toContain('168');
    expect(text).toContain('24');
    expect(text).not.toContain('7');
    const magnifier = container.querySelector('[data-testid="magnifier"]');
    expect(magnifier?.textContent ?? '').toContain('168');
    expect(magnifier?.textContent ?? '').toContain('24');
    // 조각 개수는 숫자로 쓰지 않는다.
    expect(magnifier?.textContent ?? '').not.toMatch(/(^|\D)7(\D|$)/);
  });
});
