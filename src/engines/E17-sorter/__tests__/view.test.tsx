/** @vitest-environment jsdom */
/** E17 화면 테스트: 기본 설정에서 정답 단서(도형 이름·맞는 칸·비밀 카드)가 DOM에 없다. */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../reduce';
import type { SorterConfig } from '../types';
import { SorterView } from '../View';

afterEach(cleanup);

function renderConfig(config: SorterConfig) {
  const state = createInitialState(config);
  return render(
    <SorterView
      config={config}
      state={state}
      dispatch={() => {}}
      cpa="C"
      mode={state.mode}
      targetSize={48}
    />,
  );
}

describe('E17 venn 기본 화면은 정답 단서를 쓰지 않는다', () => {
  it('카드 12장의 글자가 비어 있고 aria-label이 번호뿐이다', () => {
    const { container } = renderConfig({ mode: 'venn' });
    const cards = [...container.querySelectorAll('[data-card]')];
    expect(cards).toHaveLength(12);
    for (const card of cards) {
      expect(card.textContent).toBe('');
      expect(card.getAttribute('aria-label')).toMatch(/^카드 \d+$/);
    }
  });

  it('기본(on-check)에서는 data-fit 표시가 없고 도형 이름 글자가 없다', () => {
    const { container } = renderConfig({ mode: 'venn' });
    expect(container.querySelectorAll('[data-fit]')).toHaveLength(0);
    const text = container.textContent ?? '';
    for (const name of [
      '정삼각형',
      '직각삼각형',
      '이등변삼각형',
      '정사각형',
      '마름모',
      '사다리꼴',
    ]) {
      expect(text).not.toContain(name);
    }
  });

  it("marks: 'hide'면 눈금·직각·화살표 선이 하나도 없다", () => {
    const hidden = renderConfig({ mode: 'venn', marks: 'hide' });
    expect(hidden.container.querySelectorAll('line')).toHaveLength(0);
    cleanup();
    const shown = renderConfig({ mode: 'venn' });
    expect(shown.container.querySelectorAll('line').length).toBeGreaterThan(0);
  });
});

describe('E17 secret-rule 기본 화면은 비밀 카드를 드러내지 않는다', () => {
  it('DOM 글자에 "secret"이 없고 비밀 카드와 다른 카드의 속성이 같다', () => {
    const { container } = renderConfig({ mode: 'secret-rule', seed: 1 });
    expect(container.textContent ?? '').not.toContain('secret');
    const secret = container.querySelector('[data-card="q11"]');
    const other = container.querySelector('[data-card="q01"]');
    expect(secret).not.toBeNull();
    expect(other).not.toBeNull();
    if (!secret || !other) return;
    const attributes = (element: Element) =>
      [...element.attributes]
        .filter((attribute) => attribute.name !== 'data-card' && attribute.name !== 'aria-label')
        .map((attribute) => `${attribute.name}=${attribute.value}`)
        .sort();
    expect(attributes(secret)).toEqual(attributes(other));
    expect(container.textContent ?? '').not.toContain('비밀 카드');
  });
});

describe('E17 hierarchy 기본 화면은 빈칸에 이름을 쓰지 않는다', () => {
  it('빈칸 다섯 칸의 글자가 비어 있다', () => {
    const { container } = renderConfig({ mode: 'hierarchy' });
    const blanks = [...container.querySelectorAll('[data-blank]')];
    expect(blanks).toHaveLength(5);
    for (const blank of blanks) expect(blank.textContent).toBe('');
  });
});
