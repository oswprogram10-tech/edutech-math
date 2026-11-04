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

/** 학생에게 보이는 글자와 aria-label을 모두 모은다. */
function exposedText(container: HTMLElement): string {
  const parts: string[] = [container.textContent ?? ''];
  for (const element of container.querySelectorAll('*')) {
    const label = element.getAttribute('aria-label');
    if (label !== null) parts.push(label);
  }
  return parts.join('\n');
}

describe('E07 소수 나눗셈 화면 문구는 학생이 찾을 규칙을 말하지 않는다(T078)', () => {
  const forbidden = ['몫은 같', '몫은 그대로', '0을 붙여', '자연수로 만들'];

  it('1.68 ÷ 0.24 시작 화면에 규칙 문구가 없다', () => {
    const { container } = renderDiv(
      {
        mode: 'div',
        decimal: true,
        dividend: '1.68',
        divisor: '0.24',
        magnifier: [10, 100],
        allowOneSideScale: true,
      },
      'C',
    );
    const text = exposedText(container);
    for (const phrase of forbidden) expect(text).not.toContain(phrase);
    expect(text).toContain('화살표로 소수점을 옮길 수 있어요.');
  });

  it('9.3 ÷ 6 시작 화면에 규칙 문구가 없다', () => {
    const { container } = renderDiv(
      { mode: 'div', decimal: true, dividend: '9.3', divisor: 6, extendZeros: 2 },
      'C',
    );
    const text = exposedText(container);
    for (const phrase of forbidden) expect(text).not.toContain(phrase);
    expect(text).toContain('몫부터 한 칸씩 써 보세요.');
  });

  it('확대경을 켠 뒤에도 규칙 대신 막대 조각을 세어 보라고 한다', () => {
    const config: ColumnCalcConfig = {
      mode: 'div',
      decimal: true,
      dividend: '1.68',
      divisor: '0.24',
      magnifier: [10, 100],
      allowOneSideScale: true,
    };
    const state = reduce(createInitialState(config), { type: 'scale', side: 'both', to: 2 });
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
    const magnifier = container.querySelector<HTMLElement>('[data-testid="magnifier"]');
    expect(magnifier).not.toBeNull();
    const text = exposedText(magnifier as HTMLElement);
    for (const phrase of forbidden) expect(text).not.toContain(phrase);
    expect(text).toContain('막대 조각을 세어 보세요.');
  });
});

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
