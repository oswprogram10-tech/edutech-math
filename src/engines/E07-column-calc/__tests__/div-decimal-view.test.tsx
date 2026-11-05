/** @vitest-environment jsdom */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { isSerializable } from '../../../core/engine-sdk';
import { createInitialState, reduce } from '../reduce';
import type { ColumnCalcAction, ColumnCalcConfig } from '../types';
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

function pointMarks(container: HTMLElement, row: string, column: number): number {
  const cell = container.querySelector(
    `[data-testid="column-grid"] [data-row="${row}"][data-column="${column}"]`,
  );
  return cell?.querySelectorAll('[data-point-mark="true"]').length ?? 0;
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

describe('E07 소수 나눗셈 격자는 소수점을 그린다(T079)', () => {
  it('8.16 ÷ 4 시작 화면의 나누어지는 수 일의 자리 칸에 점이 하나 있다', () => {
    const { container } = renderDiv({
      mode: 'div',
      decimal: true,
      dividend: '8.16',
      divisor: 4,
    });
    expect(pointMarks(container, 'dividend', 0)).toBe(1);
    expect(
      container.querySelector('[role="group"][aria-label="나누어지는 수 8.16"]'),
    ).not.toBeNull();
  });

  it('3 ÷ 4는 0을 붙이기 전에는 점이 없고 하나 붙이면 생긴다', () => {
    const config: ColumnCalcConfig = {
      mode: 'div',
      decimal: true,
      dividend: '3',
      divisor: 4,
      extendZeros: 2,
    };
    const before = createInitialState(config);
    const first = renderDiv(config);
    expect(pointMarks(first.container, 'dividend', 0)).toBe(0);
    first.unmount();

    const after = reduce(before, { type: 'pad-zero', number: 'a', column: -1 });
    const second = render(
      <ColumnCalcView
        config={config}
        state={after}
        dispatch={() => {}}
        cpa="A"
        mode="div"
        targetSize={48}
      />,
    );
    expect(pointMarks(second.container, 'dividend', 0)).toBe(1);
  });

  it('5 ÷ 0.4를 ×10 한 뒤 0을 붙이면 50.0으로 점이 생긴다', () => {
    const config: ColumnCalcConfig = {
      mode: 'div',
      decimal: true,
      dividend: '5',
      divisor: '0.4',
      extendZeros: 2,
    };
    const scaled = reduce(createInitialState(config), {
      type: 'scale',
      side: 'both',
      to: 1,
    });
    const first = render(
      <ColumnCalcView
        config={config}
        state={scaled}
        dispatch={() => {}}
        cpa="A"
        mode="div"
        targetSize={48}
      />,
    );
    expect(pointMarks(first.container, 'dividend', 0)).toBe(0);
    first.unmount();

    const after = reduce(scaled, { type: 'pad-zero', number: 'a', column: -1 });
    const second = render(
      <ColumnCalcView
        config={config}
        state={after}
        dispatch={() => {}}
        cpa="A"
        mode="div"
        targetSize={48}
      />,
    );
    expect(pointMarks(second.container, 'dividend', 0)).toBe(1);
  });

  it('몫 점을 열 0에 놓으면 몫 줄 그 칸에 점이 생긴다', () => {
    const config: ColumnCalcConfig = {
      mode: 'div',
      decimal: true,
      dividend: '8.16',
      divisor: 4,
    };
    const state = reduce(createInitialState(config), {
      type: 'place-point',
      target: 'quotient',
      column: 0,
    });
    const { container } = render(
      <ColumnCalcView
        config={config}
        state={state}
        dispatch={() => {}}
        cpa="A"
        mode="div"
        targetSize={48}
      />,
    );
    expect(pointMarks(container, 'quotient', 0)).toBe(1);
  });

  it('1.68 ÷ 0.24를 ×100 한 격자(168)에는 나누어지는 수 점이 없다', () => {
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
    expect(
      container.querySelectorAll('[data-row="dividend"] [data-point-mark="true"]').length,
    ).toBe(0);
  });
});

describe('E07 점 놓기 Action은 JSON으로 왕복한다(T079)', () => {
  it('5 ÷ 0.4를 ×10 한 화면의 점 버튼은 column +0을 보낸다', () => {
    const config: ColumnCalcConfig = {
      mode: 'div',
      decimal: true,
      dividend: '5',
      divisor: '0.4',
      extendZeros: 2,
    };
    const state = reduce(createInitialState(config), {
      type: 'scale',
      side: 'both',
      to: 1,
    });
    const actions: ColumnCalcAction[] = [];
    const { container } = render(
      <ColumnCalcView
        config={config}
        state={state}
        dispatch={(action) => actions.push(action)}
        cpa="A"
        mode="div"
        targetSize={48}
      />,
    );
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="column-grid"] [data-row="point"][data-column="0"]',
    );
    expect(button).not.toBeNull();
    button?.click();

    expect(actions).toHaveLength(1);
    const action = actions[0];
    expect(action?.type).toBe('place-point');
    if (action?.type !== 'place-point') throw new Error('점 놓기 Action이 아닙니다.');
    expect(Object.is(action.column, 0)).toBe(true);
    expect(isSerializable(action)).toBe(true);
  });
});
