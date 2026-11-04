/** @vitest-environment jsdom */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import type { ColumnCalcAction, ColumnCalcConfig, ColumnCalcState } from '../types';
import { ColumnCalcView } from '../View';

afterEach(cleanup);

function renderView(config: ColumnCalcConfig, state: ColumnCalcState, cpa: 'C' | 'P' | 'A' = 'C') {
  return render(
    <ColumnCalcView
      config={config}
      state={state}
      dispatch={() => {}}
      cpa={cpa}
      mode={state.mode}
      targetSize={48}
    />,
  );
}

function apply(state: ColumnCalcState, action: ColumnCalcAction): ColumnCalcState {
  return reduce(state, action);
}

/**
 * 학생에게 보이는 글자와 접근성·데이터 속성을 모두 모은다.
 * 정답 값이 이 어디에도 없어야 한다(T077 결정 13).
 */
function exposedText(container: HTMLElement): string {
  const parts: string[] = [container.textContent ?? ''];
  for (const element of container.querySelectorAll('*')) {
    for (const name of ['aria-label', 'title']) {
      const value = element.getAttribute(name);
      if (value !== null) parts.push(value);
    }
    for (const attribute of element.attributes) {
      if (attribute.name.startsWith('data-')) parts.push(attribute.value);
    }
  }
  return parts.join('\n');
}

function decimalMulState(config: ColumnCalcConfig): ColumnCalcState {
  return createInitialState({ mode: 'decimal', op: 'mul', ...config });
}

describe('E07 소수 곱셈 화면은 정답을 미리 보여 주지 않는다(T077)', () => {
  it('2.4 × 1.3 시작 화면에 3.12·312·0.1·0.100·100이 없다', () => {
    const config: ColumnCalcConfig = { mode: 'decimal', op: 'mul', a: '2.4', b: '1.3' };
    const { container } = renderView(config, decimalMulState(config));
    const exposed = exposedText(container);

    expect(exposed).not.toContain('3.12');
    expect(exposed).not.toContain('312');
    expect(exposed).not.toContain('0.1');
    expect(exposed).not.toContain('0.100');
    expect(exposed).not.toContain('100');
  });

  it('0.25 × 0.4 시작 화면에 0.1·0.100·100이 없다', () => {
    const config: ColumnCalcConfig = { mode: 'decimal', op: 'mul', a: '0.25', b: '0.4' };
    const { container } = renderView(config, decimalMulState(config));
    const exposed = exposedText(container);

    expect(exposed).not.toContain('0.1');
    expect(exposed).not.toContain('0.100');
    expect(exposed).not.toContain('100');
  });

  it('시프트 데모 3.75는 누르기 전·×10 뒤에도 37.5·375·0.375를 쓰지 않는다', () => {
    const config: ColumnCalcConfig = {
      mode: 'decimal',
      op: 'mul',
      a: '3.75',
      b: '10',
      shiftDemo: { value: '3.75', ops: ['×10', '×0.1'] },
    };
    const before = decimalMulState(config);
    const first = renderView(config, before);
    const firstDemo = first.container.querySelector<HTMLElement>('[data-testid="shift-demo"]');
    expect(firstDemo).not.toBeNull();
    const firstText = exposedText(firstDemo as HTMLElement);
    expect(firstText).not.toContain('37.5');
    expect(firstText).not.toContain('375');
    expect(firstText).not.toContain('0.375');
    first.unmount();

    const after = apply(before, { type: 'shift', op: '×10' });
    const second = renderView(config, after);
    const secondDemo = second.container.querySelector<HTMLElement>('[data-testid="shift-demo"]');
    expect(secondDemo).not.toBeNull();
    const secondText = exposedText(secondDemo as HTMLElement);
    expect(secondText).not.toContain('37.5');
    expect(secondText).not.toContain('375');
    expect(secondText).not.toContain('0.375');
  });

  it('시프트 데모는 A 단계에서 숨긴다', () => {
    const config: ColumnCalcConfig = {
      mode: 'decimal',
      op: 'mul',
      a: '3.75',
      b: '10',
      shiftDemo: { value: '3.75', ops: ['×10'] },
    };
    const { container } = renderView(config, decimalMulState(config), 'A');
    expect(container.querySelector('[data-testid="shift-demo"]')).toBeNull();
  });

  it('requireEstimate 시작 화면은 점을 놓기 전 어림값을 먼저 묻는다', () => {
    const config: ColumnCalcConfig = {
      mode: 'decimal',
      op: 'mul',
      a: '2.4',
      b: '1.3',
      requireEstimate: true,
    };
    const { container } = renderView(config, decimalMulState(config));
    expect(container.querySelector('[data-testid="decimal-estimate"]')).not.toBeNull();
    expect(container.textContent).toContain('소수점을 놓기 전에 어림값을 먼저 써요');
  });
});
