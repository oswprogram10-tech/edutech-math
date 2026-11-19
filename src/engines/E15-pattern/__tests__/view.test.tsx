/** @vitest-environment jsdom */
/** E15 화면 테스트: 정답 단서(소리만 듣는 칸·가린 칸의 값)가 DOM에 없다. */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import { CoreBoxesOverlay } from '../overlays/core-boxes';
import { MappingCardOverlay } from '../overlays/mapping-card';
import { ReplayBreakOverlay } from '../overlays/replay-break';
import { TenStepOverlay } from '../overlays/ten-step';
import type { PatternAction, PatternConfig, PatternState } from '../types';
import { PatternView } from '../View';

afterEach(cleanup);

function renderState(config: PatternConfig, state: PatternState, dispatch = vi.fn()) {
  return render(
    <PatternView
      config={config}
      state={state}
      dispatch={dispatch}
      cpa="C"
      mode={state.mode}
      targetSize={48}
    />,
  );
}

function renderConfig(config: PatternConfig) {
  return renderState(config, createInitialState(config));
}

function play(config: PatternConfig, actions: readonly PatternAction[]): PatternState {
  return actions.reduce<PatternState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

const EXTEND: PatternConfig = {
  mode: 'sequence',
  items: ['circle', 'triangle', 'square'],
  given: ['circle', 'triangle', 'circle', 'triangle', 'circle'],
  blanks: 3,
};

describe('E15 sequence 화면', () => {
  it('sound-only 주어진 칸 DOM에 토큰 이름·data-token이 없다', () => {
    const { container } = renderConfig({ ...EXTEND, givenDisplay: 'sound-only' });
    const given = [...container.querySelectorAll('[data-testid^="pattern-given-"]')];
    expect(given).toHaveLength(5);
    for (const cell of given) {
      expect(cell.hasAttribute('data-token')).toBe(false);
      const html = cell.outerHTML;
      for (const name of ['circle', 'triangle', 'square', '동그라미', '세모', '네모']) {
        expect(html).not.toContain(name);
      }
      expect(cell.getAttribute('aria-label')).toMatch(/^주어진 소리 칸 \d+번$/);
    }
  });

  it('show에서는 주어진 칸에 data-token이 있고 빈칸에는 없다', () => {
    const { container } = renderConfig(EXTEND);
    expect(container.querySelectorAll('[data-testid^="pattern-given-"][data-token]')).toHaveLength(
      5,
    );
    expect(container.querySelectorAll('[data-testid^="pattern-slot-"][data-token]')).toHaveLength(
      0,
    );
  });

  it('translate sound-only의 보내는 줄과 되돌린 줄도 토큰을 쓰지 않는다', () => {
    const config: PatternConfig = {
      mode: 'sequence',
      variant: 'translate',
      source: ['apple', 'banana'],
      repeat: 2,
      targetAlphabet: ['1', '2'],
      givenDisplay: 'sound-only',
    };
    const state = play(config, [
      { type: 'place', slot: 0, token: '1' },
      { type: 'place', slot: 1, token: '2' },
      { type: 'place', slot: 2, token: '1' },
      { type: 'place', slot: 3, token: '2' },
      { type: 'send' },
    ]);
    const { container } = renderState(config, state);
    const track = container.querySelector('[data-testid="pattern-track"]');
    expect(track?.outerHTML).not.toMatch(/apple|banana|사과|바나나/);
  });

  it('기본 화면에 학년·점수 글자가 없다', () => {
    const { container } = renderConfig(EXTEND);
    expect(container.textContent ?? '').not.toMatch(/학년|점수/);
  });

  it('칸에 맞고 틀림 표시(data-fit·data-correct)가 없다', () => {
    const state = play(EXTEND, [
      { type: 'place', slot: 0, token: 'circle' },
      { type: 'place', slot: 1, token: 'circle' },
      { type: 'place', slot: 2, token: 'circle' },
    ]);
    const { container } = renderState(EXTEND, state);
    expect(container.querySelector('[data-fit],[data-correct],[data-wrong]')).toBeNull();
  });

  it('팔레트 단추를 누르면 cursor 빈칸에 place를 보낸다', () => {
    const dispatch = vi.fn();
    const { container } = renderState(EXTEND, createInitialState(EXTEND), dispatch);
    const button = container.querySelector('[data-testid="pattern-palette"] [data-token="square"]');
    expect(button).not.toBeNull();
    fireEvent.click(button as Element);
    expect(dispatch).toHaveBeenCalledWith({ type: 'place', slot: 0, token: 'square' });
  });

  it('숫자 키는 팔레트 n번째 토큰을 cursor 칸에 놓는다', () => {
    const dispatch = vi.fn();
    const { container } = renderState(EXTEND, createInitialState(EXTEND), dispatch);
    const svg = container.querySelector('svg[data-testid="pattern-canvas"]') as SVGSVGElement;
    expect(svg.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(svg, { key: '2' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'place', slot: 0, token: 'triangle' });
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'move-cursor', slot: 1 });
    fireEvent.keyDown(svg, { key: 'p' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'play' });
  });

  it('채운 빈칸을 누르면 cursor를 옮기고 지운다', () => {
    const state = play(EXTEND, [{ type: 'place', slot: 1, token: 'square' }]);
    const dispatch = vi.fn();
    const { container } = renderState(EXTEND, state, dispatch);
    fireEvent.click(container.querySelector('[data-testid="pattern-slot-1"]') as Element);
    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'move-cursor', slot: 1 });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'clear-slot', slot: 1 });
  });

  it('translate는 보내기 단추가 있고 보낸 뒤 되돌린 줄이 생긴다', () => {
    const config: PatternConfig = {
      mode: 'sequence',
      variant: 'translate',
      source: ['apple', 'banana'],
      repeat: 1,
      targetAlphabet: ['1', '2'],
    };
    const before = renderConfig(config);
    expect(before.getByRole('button', { name: '보내기' })).toBeTruthy();
    expect(before.container.querySelector('[data-testid^="pattern-restored-"]')).toBeNull();
    cleanup();
    const sent = play(config, [
      { type: 'place', slot: 0, token: '1' },
      { type: 'place', slot: 1, token: '1' },
      { type: 'send' },
    ]);
    const after = renderState(config, sent);
    expect(
      after.container.querySelectorAll(
        '[data-testid^="pattern-restored-"]:not([data-testid^="pattern-restored-x"])',
      ),
    ).toHaveLength(2);
    // 사과 칸과 바나나 칸이 모두 1이라 열쇠가 겹쳐 둘째 되돌린 칸도 ✕다.
    expect(
      after.container
        .querySelector('[data-testid="pattern-restored-1"]')
        ?.getAttribute('data-mismatch'),
    ).toBe('true');
  });
});

describe('E15 hundred-chart 화면', () => {
  const CROSS: PatternConfig = {
    mode: 'hundred-chart',
    hidden: 'cross',
    center: 46,
    view: 'cross-only',
  };

  it('가린 칸 DOM에 칸 수가 없다(aria-label 포함)', () => {
    const config: PatternConfig = { mode: 'hundred-chart', hidden: [46, 73] };
    const { container } = renderConfig(config);
    const hidden = [...container.querySelectorAll('[data-hidden]')];
    expect(hidden).toHaveLength(2);
    expect(container.querySelector('[data-cell="46"]')).toBeNull();
    expect(container.querySelector('[data-cell="73"]')).toBeNull();
    expect(container.querySelector('[data-cell="45"]')).not.toBeNull();
    for (const cell of hidden) {
      expect(cell.getAttribute('aria-label')).toBe('가려진 칸');
      expect(cell.textContent).toBe('?');
      // 그림 좌표에는 숫자가 있으므로 속성 값만 본다.
      for (const attribute of [...cell.attributes]) {
        expect(attribute.value).not.toMatch(/46|73/);
      }
    }
    expect(container.innerHTML).not.toContain('46번');
  });

  it('입력한 수는 칸에 쓰이지만 맞고 틀림은 표시하지 않는다', () => {
    const state = play(CROSS, [
      { type: 'activate', cell: 46 },
      { type: 'type-digit', digit: '4' },
      { type: 'type-digit', digit: '7' },
    ]);
    const { container } = renderState(CROSS, state);
    const hidden = container.querySelector('[data-hidden="0"]') as Element;
    expect(hidden.textContent).toBe('47');
    expect(hidden.getAttribute('aria-label')).toBe('가려진 칸, 수를 썼어요');
    expect(container.querySelector('[data-fit],[data-correct],[data-wrong]')).toBeNull();
  });

  it('cross-only는 가운데와 이웃 넷만 그린다', () => {
    const { container } = renderConfig(CROSS);
    expect(container.querySelectorAll('[data-cell]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-hidden]')).toHaveLength(1);
  });

  it('숫자 패드는 가린 칸이 있을 때만 있다', () => {
    const withPad = renderConfig(CROSS);
    expect(withPad.container.querySelector('[data-testid="chart-pad"]')).not.toBeNull();
    cleanup();
    const without = renderConfig({ mode: 'hundred-chart', paint: true });
    expect(without.container.querySelector('[data-testid="chart-pad"]')).toBeNull();
    expect(without.container.textContent ?? '').not.toMatch(/학년|점수/);
  });

  it('칠하기는 칠한 칸에 data-painted를 달고 키보드로 칠한다', () => {
    const dispatch = vi.fn();
    const config: PatternConfig = { mode: 'hundred-chart', paint: true, prepainted: [5] };
    const { container } = renderState(config, createInitialState(config), dispatch);
    expect(container.querySelector('[data-cell="5"]')?.getAttribute('data-painted')).toBe('true');
    const svg = container.querySelector('svg[data-testid="chart-canvas"]') as SVGSVGElement;
    expect(svg.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    fireEvent.keyDown(svg, { key: 'Enter' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'toggle-paint', cell: 47 });
  });
});

describe('E15 오버레이', () => {
  it('core-boxes: 반복 단위 상자와 어긋난 칸의 ✕', () => {
    const config: PatternConfig = {
      mode: 'sequence',
      items: ['circle', 'triangle'],
      given: ['circle', 'circle', 'triangle', 'circle', 'circle', 'triangle'],
      blanks: 2,
    };
    const state = play(config, [
      { type: 'place', slot: 0, token: 'circle' },
      { type: 'place', slot: 1, token: 'triangle' },
    ]);
    const { container } = render(<CoreBoxesOverlay config={config} state={state} />);
    // 8칸을 단위 3칸씩 묶으면 상자 3개(한 줄에 다 들어간다)
    expect(container.querySelectorAll('rect[stroke-dasharray]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid="core-boxes-x"]')).toHaveLength(1);
  });

  it('core-boxes: 단위가 없으면 아무것도 그리지 않는다', () => {
    const config: PatternConfig = {
      mode: 'sequence',
      items: ['circle', 'triangle', 'square'],
      given: ['circle', 'triangle', 'square'],
      blanks: 2,
    };
    const { container } = render(
      <CoreBoxesOverlay config={config} state={createInitialState(config)} />,
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('replay-break: 처음 어긋난 칸에 물결과 안내', () => {
    const state = play(EXTEND, [
      { type: 'place', slot: 0, token: 'triangle' },
      { type: 'place', slot: 1, token: 'triangle' },
    ]);
    const { container } = render(<ReplayBreakOverlay config={EXTEND} state={state} />);
    expect(container.querySelector('[data-testid="replay-break-wave"]')).not.toBeNull();
    expect(container.textContent).toContain('여기서 리듬이 바뀌어요');
    expect(container.textContent).toContain('다시 듣기');
  });

  it('replay-break: 어긋난 칸이 없으면 그리지 않는다', () => {
    const state = play(EXTEND, [{ type: 'place', slot: 0, token: 'triangle' }]);
    const { container } = render(<ReplayBreakOverlay config={EXTEND} state={state} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('mapping-card: 짝 카드와 충돌 칸 ✕', () => {
    const config: PatternConfig = {
      mode: 'sequence',
      variant: 'translate',
      source: ['apple', 'banana', 'banana'],
      repeat: 2,
      targetAlphabet: ['1', '2', '3'],
    };
    const state = play(config, [
      { type: 'place', slot: 0, token: '1' },
      { type: 'place', slot: 1, token: '2' },
      { type: 'place', slot: 2, token: '2' },
      { type: 'place', slot: 3, token: '3' },
    ]);
    const { container } = render(<MappingCardOverlay config={config} state={state} />);
    expect(container.querySelectorAll('[data-testid="mapping-card-item"]')).toHaveLength(2);
    // 넷째 칸(사과 → 3)은 처음 붙인 1과 달라 ✕
    expect(container.querySelectorAll('[data-testid="mapping-card-x"]')).toHaveLength(1);
  });

  it('ten-step: 위 칸 수를 10 막대와 낱개로 그리고 아래 칸 수는 쓰지 않는다', () => {
    const config: PatternConfig = {
      mode: 'hundred-chart',
      hidden: 'cross',
      center: 46,
      view: 'cross-only',
    };
    const state = play(config, [
      { type: 'activate', cell: 46 },
      { type: 'type-digit', digit: '3' },
      { type: 'type-digit', digit: '7' },
    ]);
    const { container } = render(<TenStepOverlay config={config} state={state} />);
    // 위 칸 36 = 막대 3개 + 낱개 6개
    expect(container.querySelectorAll('[data-testid="ten-step-rod"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid="ten-step-dot"]')).toHaveLength(6);
    expect(container.textContent).toContain('10 막대 1개 더');
    expect(container.textContent).not.toMatch(/46|56/);
  });

  it('ten-step: 오개념이 없고 args도 없으면 그리지 않는다', () => {
    const config: PatternConfig = { mode: 'hundred-chart', hidden: 'cross', center: 46 };
    const { container } = render(
      <TenStepOverlay config={config} state={createInitialState(config)} />,
    );
    expect(container.querySelector('svg')).toBeNull();
  });
});
