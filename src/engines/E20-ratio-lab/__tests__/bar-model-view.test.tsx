/** @vitest-environment jsdom */
/** E20 bar-model 화면: 정답 비노출, 형광펜 모양·꼬리표, 막대 흐림, 칸·키패드, 오버레이 조건. */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareBracketOverlay } from '../overlays/share-bracket';
import { UnitCountOverlay } from '../overlays/unit-count';
import { createInitialState, reduce } from '../reduce';
import type { BarModelConfig, RatioConfig, RatioState } from '../types';
import { RatioView } from '../View';

afterEach(cleanup);

const DEFAULT: BarModelConfig = { mode: 'bar-model' };

function Live({ config, readOnly = false }: { config: RatioConfig; readOnly?: boolean }) {
  const [state, dispatch] = useReducer(reduce, config, createInitialState);
  return (
    <RatioView
      config={config}
      state={state}
      dispatch={dispatch}
      cpa="P"
      mode={state.mode}
      targetSize={48}
      readOnly={readOnly}
    />
  );
}

function renderStatic(state: RatioState, dispatch = vi.fn()) {
  return render(
    <RatioView
      config={{}}
      state={state}
      dispatch={dispatch}
      cpa="P"
      mode={state.mode}
      targetSize={48}
      readOnly={false}
    />,
  );
}

function canvas(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg[data-testid="ratio-canvas"]');
  if (!(svg instanceof SVGSVGElement)) throw new Error('canvas 없음');
  return svg;
}

function token(text: string): HTMLElement {
  const match = [...document.querySelectorAll<HTMLElement>('[data-token-index]')].find(
    (el) => el.textContent?.replace(/^(전체|비)/, '') === text,
  );
  if (!match) throw new Error(`토큰 ${text} 없음`);
  return match;
}

/** 키패드를 뺀 화면의 글·data-·aria- 값을 모은다. */
function visibleParts(container: HTMLElement): string {
  const parts: string[] = [];
  for (const element of container.querySelectorAll('*')) {
    if (element.closest('[aria-label="숫자 키패드"]')) continue;
    for (const attribute of element.attributes) {
      if (attribute.name === 'data-token-index') continue; // 토큰 순번일 뿐이다.
      if (attribute.name.startsWith('data-') || attribute.name.startsWith('aria-')) {
        parts.push(attribute.value);
      }
    }
    if (element instanceof HTMLInputElement) parts.push(element.value);
    if (element.childElementCount === 0) parts.push(element.textContent ?? '');
  }
  return parts.join('\n');
}

describe('bar-model 화면', () => {
  it('시작 화면 DOM에 정답(한 칸 크기·몫)이 없다', () => {
    const { container } = render(<Live config={DEFAULT} />);
    const text = visibleParts(container);
    // 35÷7=5, 15, 20: 문장·비(3, 4)·전체(35)와 겹치지 않는 낱말 경계로 본다.
    expect(text).not.toMatch(/(^|[^0-9])(5|15|20)([^0-9]|$)/);
    expect(canvas(container).getAttribute('data-open')).toBe('false');
  });

  it('거꾸로 문제도 구해야 할 한 칸 크기·전체·나머지 몫이 DOM에 없다', () => {
    const { container } = render(
      <Live
        config={{
          mode: 'bar-model',
          problem: '형과 동생이 3 : 5로 나누었더니 형이 24개입니다.',
          parts: ['형', '동생'],
          ratio: [3, 5],
          known: { part: 0, value: 24 },
        }}
      />,
    );
    const text = visibleParts(container);
    expect(text).toMatch(/24/);
    expect(text).not.toMatch(/(^|[^0-9])(8|40|64)([^0-9]|$)/);
    // 알려 준 몫 칸은 고정 글, 전체 칸은 입력 칸으로 보인다.
    expect(container.querySelector('[data-field="part-0"]')?.tagName).toBe('SPAN');
    expect(container.querySelector('[data-field="total"]')?.tagName).toBe('INPUT');
  });

  it('토큰은 수와 조사를 나눠 단추로 보이고 높이 규칙(48px 변수)을 쓴다', () => {
    const { container } = render(<Live config={DEFAULT} />);
    const tokens = [...container.querySelectorAll('[data-token-index]')];
    expect(tokens.map((t) => t.textContent).slice(0, 4)).toEqual(['사탕', '35', '개를', '형과']);
    expect(tokens.every((t) => t.tagName === 'BUTTON')).toBe(true);
  });

  it('칠하면 꼬리표 글자와 data-mark가 붙고(색만으로 구별하지 않음), 지우개로 지운다', () => {
    render(<Live config={DEFAULT} />);
    fireEvent.click(token('35'));
    const marked = document.querySelector('[data-token-index="1"]');
    expect(marked?.getAttribute('data-mark')).toBe('total');
    expect(marked?.textContent).toBe('전체35');
    expect(marked?.getAttribute('aria-label')).toBe('35, 전체');
    fireEvent.click(screen.getByRole('button', { name: '비 칠하기' }));
    fireEvent.click(token('3'));
    const ratio = [...document.querySelectorAll('[data-mark="ratio"]')];
    expect(ratio).toHaveLength(1);
    expect(ratio[0]?.textContent).toBe('비3');
    fireEvent.click(screen.getByRole('button', { name: '지우기' }));
    fireEvent.click(token('3'));
    expect(document.querySelectorAll('[data-mark="ratio"]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: '지우기' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('형광펜 목표를 맞히면 막대가 열린다', () => {
    const { container } = render(<Live config={DEFAULT} />);
    expect(container.querySelector('[data-part="dim-notice"]')).not.toBeNull();
    fireEvent.click(token('35'));
    fireEvent.click(screen.getByRole('button', { name: '비 칠하기' }));
    fireEvent.click(token('3'));
    fireEvent.click(token('4'));
    expect(canvas(container).getAttribute('data-open')).toBe('true');
    expect(container.querySelector('[data-part="dim-notice"]')).toBeNull();
  });

  it('형광펜 단계가 없으면 처음부터 열려 있다', () => {
    const { container } = render(
      <Live
        config={{
          mode: 'bar-model',
          problem: '구슬 35개를 3 : 4로 나눕니다.',
          parts: ['가', '나'],
          ratio: [3, 4],
          total: 35,
        }}
      />,
    );
    expect(canvas(container).getAttribute('data-open')).toBe('true');
  });

  it('막대: 줄마다 비의 항만큼 칸, 전체 막대는 칸의 합, 전체가 알려졌으면 전체 글에 그 수', () => {
    const { container } = render(<Live config={DEFAULT} />);
    expect(container.querySelectorAll('[data-part="cell"][data-row="0"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-part="cell"][data-row="1"]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-part="total-cell"]')).toHaveLength(7);
    expect(container.querySelector('[data-part="total-label"]')?.textContent).toBe('전체 35');
    // 같은 칸 크기
    const widths = new Set(
      [...container.querySelectorAll('[data-part="cell"]')].map((c) => c.getAttribute('width')),
    );
    expect(widths.size).toBe(1);
  });

  it('전체를 구해야 하면 전체 글이 ?이고, 쓴 값은 칸 안과 줄 끝에 나온다', () => {
    const { container } = render(
      <Live
        config={{
          mode: 'bar-model',
          problem: '형 동생 3 : 5 형 24',
          parts: ['형', '동생'],
          ratio: [3, 5],
          known: { part: 0, value: 24 },
        }}
      />,
    );
    expect(container.querySelector('[data-part="total-label"]')?.textContent).toBe('전체 ?');
    expect(container.querySelector('[data-part="unit-text"]')).toBeNull();
    fireEvent.change(screen.getByLabelText('한 칸 크기'), { target: { value: '8' } });
    expect(container.querySelectorAll('[data-part="unit-text"]')).toHaveLength(8);
    expect(container.querySelector('[data-part="share-text"][data-row="1"]')?.textContent).toBe(
      '?',
    );
    fireEvent.change(screen.getByLabelText('동생 몫'), { target: { value: '40' } });
    expect(container.querySelector('[data-part="share-text"][data-row="1"]')?.textContent).toBe(
      '40',
    );
  });

  it('칸은 과제에 맞게 보인다: total이 있으면 전체 칸 숨김', () => {
    render(<Live config={DEFAULT} />);
    expect(screen.queryByLabelText('전체')).toBeNull();
    expect(screen.getByLabelText('한 칸 크기')).toBeTruthy();
    expect(screen.getByLabelText('형 몫')).toBeTruthy();
    expect(screen.getByLabelText('동생 몫')).toBeTruthy();
  });

  it('키패드로 활성 칸에 쓰고 ⌫로 지운다. 숫자가 아닌 글은 이유를 알린다', () => {
    render(<Live config={DEFAULT} />);
    const unit = screen.getByLabelText('한 칸 크기') as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(unit.value).toBe('12');
    fireEvent.click(screen.getByRole('button', { name: '한 글자 지우기' }));
    expect(unit.value).toBe('1');
    // 다른 칸을 고르면 키패드가 그 칸에 쓴다.
    const share = screen.getByLabelText('형 몫') as HTMLInputElement;
    fireEvent.focus(share);
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    expect(share.value).toBe('9');
    expect(unit.value).toBe('1');
    fireEvent.change(unit, { target: { value: '1a' } });
    expect(unit.value).toBe('1');
    expect(screen.getByTestId('ratio-message').textContent).toBe('숫자만 넣어 주세요.');
    expect(unit.getAttribute('inputmode')).toBe('none');
  });

  it('symbols look: 막대(칸)를 숨기고 식 칸과 몫 칸, 연산 키만 둔다', () => {
    const { container } = render(<Live config={{ mode: 'bar-model', look: 'symbols' }} />);
    expect(container.querySelectorAll('[data-part="cell"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-part="total-cell"]')).toHaveLength(0);
    expect(screen.queryByLabelText('한 칸 크기')).toBeNull();
    const expr = screen.getByLabelText('식') as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(expr.value).toBe('×');
    fireEvent.change(expr, { target: { value: '35*3/7' } });
    expect(expr.value).toBe('35×3/7');
    fireEvent.change(expr, { target: { value: '35 a' } });
    expect(expr.value).toBe('35×3/7');
    expect(screen.getByTestId('ratio-message').textContent).toContain('쓸 수 있어요');
  });

  it('읽기 전용이면 단추·칸이 모두 꺼진다', () => {
    const { container } = render(<Live config={DEFAULT} readOnly />);
    expect(
      [...container.querySelectorAll('button')].every((b) => (b as HTMLButtonElement).disabled),
    ).toBe(true);
    expect((screen.getByLabelText('한 칸 크기') as HTMLInputElement).disabled).toBe(true);
  });

  it('단축키: T·B·E 도구, R 처음으로(입력 칸 안에서는 쓰지 않음)', () => {
    const dispatch = vi.fn();
    const { container } = renderStatic(createInitialState(DEFAULT), dispatch);
    const wrap = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(wrap, { code: 'KeyB' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'set-tool', tool: 'ratio' });
    fireEvent.keyDown(wrap, { code: 'KeyE' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'set-tool', tool: 'erase' });
    fireEvent.keyDown(screen.getByLabelText('한 칸 크기'), { code: 'KeyT' });
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('설정 오류면 오류 문구만 보인다', () => {
    renderStatic(createInitialState({ ...DEFAULT, problem: 'x', total: 36 }));
    expect(screen.getByTestId('ratio-error')).toBeTruthy();
    expect(within(document.body).queryByTestId('bar-sentence')).toBeNull();
  });
});

describe('bar-model 오버레이', () => {
  const empty = (node: React.ReactElement) => render(node).container.innerHTML;

  it('다른 모드·symbols·설정 오류에서는 그리지 않는다', () => {
    const mix = createInitialState({ mode: 'mix' });
    const symbols = createInitialState({ mode: 'bar-model', look: 'symbols' });
    for (const state of [mix, symbols]) {
      expect(empty(<UnitCountOverlay config={{}} state={state} />)).toBe('');
      expect(empty(<ShareBracketOverlay config={{}} state={state} />)).toBe('');
    }
  });
});
