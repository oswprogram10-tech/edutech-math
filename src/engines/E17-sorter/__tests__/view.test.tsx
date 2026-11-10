/** @vitest-environment jsdom */
/** E17 화면 테스트: 기본 설정에서 정답 단서(도형 이름·맞는 칸·비밀 카드)가 DOM에 없다. */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { deckIds } from '../deck';
import { VENN_CELL_WIDTH, vennCardFrame, vennSlotGrid } from '../layout';
import { createInitialState, reduce } from '../reduce';
import type { SecretRuleState, SorterConfig, SorterState } from '../types';
import { SorterView } from '../View';

afterEach(cleanup);

function asSecret(state: SorterState): SecretRuleState {
  if (state.mode !== 'secret-rule') throw new Error('secret-rule 상태가 아니다');
  return state;
}

function renderConfig(config: SorterConfig) {
  return renderState(config, createInitialState(config));
}

function renderState(config: SorterConfig, state: SorterState) {
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

  it('빈칸 aria-label은 위치만 읽고, 채우면 넣은 이름을 읽는다', () => {
    const config: SorterConfig = { mode: 'hierarchy' };
    const empty = renderConfig(config);
    const labels = [...empty.container.querySelectorAll('[data-blank]')].map((blank) =>
      blank.getAttribute('aria-label'),
    );
    expect(labels.sort()).toEqual(['빈칸 1', '빈칸 2', '빈칸 3', '빈칸 4', '빈칸 5']);
    for (const name of ['사다리꼴', '평행사변형', '마름모', '직사각형', '정사각형']) {
      for (const label of labels) expect(label).not.toContain(name);
    }
    cleanup();

    const filled = reduce(createInitialState(config), {
      type: 'fill-blank',
      node: 'trapezoid',
      name: 'trapezoid',
    });
    const view = renderState(config, filled);
    expect(
      view.container.querySelector('[data-blank="trapezoid"]')?.getAttribute('aria-label'),
    ).toBe('사다리꼴');
  });
});

describe('E17 venn 한 칸에 카드가 많아도 모두 보인다', () => {
  it('한 칸에 7장을 놓아도 7장 모두 그려지고 키보드로 닿는다', () => {
    const config: SorterConfig = { mode: 'venn' };
    const cell = 'acute|scalene';
    const placed = deckIds('triangles-12').slice(0, 7);
    const state = placed.reduce<SorterState>(
      (current, card) => reduce(current, { type: 'place', card, cell }),
      createInitialState(config),
    );
    const { container } = renderState(config, state);
    for (const card of placed) {
      const node = container.querySelector(`[data-card="${card}"]`);
      expect(node).not.toBeNull();
      expect(node?.getAttribute('tabindex')).toBe('0');
    }
    expect(container.textContent ?? '').not.toContain('+1');
  });

  it('6장까지는 3×2 큰 슬롯을 지키고 7장부터만 4×3으로 줄인다', () => {
    const config: SorterConfig = { mode: 'venn' };
    const cell = 'acute|scalene';
    const ids = deckIds('triangles-12');
    const placeN = (n: number) =>
      ids
        .slice(0, n)
        .reduce<SorterState>(
          (current, card) => reduce(current, { type: 'place', card, cell }),
          createInitialState(config),
        );
    const one = placeN(1);
    const six = placeN(6);
    const seven = placeN(7);
    if (one.mode !== 'venn' || six.mode !== 'venn' || seven.mode !== 'venn') {
      throw new Error('venn 상태가 아니다');
    }
    const width = (state: typeof one, card: string) => vennCardFrame(state, card)?.box.width;
    expect(width(one, ids[0] ?? '')).toBe(VENN_CELL_WIDTH / 3);
    expect(width(six, ids[5] ?? '')).toBe(VENN_CELL_WIDTH / 3);
    expect(width(seven, ids[0] ?? '')).toBe(VENN_CELL_WIDTH / 4);
    expect(vennSlotGrid(6)).toEqual({ cols: 3, rows: 2 });
    expect(vennSlotGrid(7)).toEqual({ cols: 4, rows: 3 });
  });
});

describe('E17 venn 불가능 표시 문구', () => {
  const config: SorterConfig = { mode: 'venn' };
  const cell = 'acute|scalene';

  function markCell(state: SorterState) {
    const view = renderState(config, state);
    fireEvent.click(view.getByRole('button', { name: '불가능한 칸 표시' }));
    const target = view.container.querySelector(`[data-cell="${cell}"]`);
    expect(target).not.toBeNull();
    if (target) fireEvent.keyDown(target, { key: 'Enter' });
    return view.getByTestId('sorter-status').textContent ?? '';
  }

  it('행·열 한국어 이름으로 표시 문구를 읽는다(내부 키가 없다)', () => {
    const status = markCell(createInitialState(config));
    expect(status).toBe('예각·세 변이 다름 칸을 불가능으로 표시했어요.');
    expect(status).not.toContain('acute');
    expect(status).not.toContain('scalene');
  });

  it('이미 표시한 칸은 해제 문구를 따로 읽는다', () => {
    const marked = reduce(createInitialState(config), { type: 'toggle-impossible', cell });
    expect(markCell(marked)).toBe('예각·세 변이 다름 칸의 불가능 표시를 풀었어요.');
  });
});

describe('E17 역할 바꾸기 화면', () => {
  const config: SorterConfig = {
    mode: 'secret-rule',
    seed: 1,
    roleSwap: true,
    startRole: 'answerer',
  };

  it('답하는 역할에서는 state.eliminated 대신 컴퓨터가 지운 후보 밖 카드만 지운다', () => {
    let state = asSecret(createInitialState(config));
    state = asSecret(reduce(state, { type: 'swap-pick', card: 'q12' }));
    state = asSecret(reduce(state, { type: 'swap-answer', answer: false }));
    const candidate = state.swap.candidates[0];
    expect(candidate).toBeDefined();
    if (!candidate) return;
    // 맞히는 역할의 기록(state.eliminated)이 후보 카드에 남아 있어도 답하는 화면은 무시한다.
    const stale: SecretRuleState = { ...state, eliminated: [candidate] };
    const { container } = renderState(config, stale);
    expect(
      container.querySelector(`[data-card="${candidate}"] polygon`)?.getAttribute('fill'),
    ).toBe('#ffffff');
    const outside = deckIds('quadrilaterals-16').find(
      (card) => !state.swap.candidates.includes(card),
    );
    expect(outside).toBeDefined();
    if (!outside) return;
    expect(container.querySelector(`[data-card="${outside}"] polygon`)?.getAttribute('fill')).toBe(
      'url(#sorter-flip)',
    );
  });

  it('roleSwap: false면 역할 바꾸기 단추가 없다', () => {
    const fixed: SorterConfig = {
      mode: 'secret-rule',
      seed: 1,
      roleSwap: false,
      startRole: 'answerer',
    };
    const view = renderConfig(fixed);
    expect(view.queryByRole('button', { name: '내가 맞히기' })).toBeNull();
    expect(view.queryByRole('button', { name: '내가 답하기' })).toBeNull();
  });
});
