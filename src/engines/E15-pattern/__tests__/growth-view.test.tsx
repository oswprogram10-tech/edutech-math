/** @vitest-environment jsdom */
/** E15 growth 화면·오버레이 테스트: 정답 노출 없음, 강조, 키보드, look 설정. */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GrowthSplitOverlay } from '../overlays/growth-split';
import { createInitialState, reduce } from '../reduce';
import type { GrowthConfig, PatternAction, PatternConfig, PatternState } from '../types';
import { PatternView } from '../View';

afterEach(cleanup);

function renderState(config: PatternConfig, state: PatternState, dispatch = vi.fn(), size = 48) {
  return render(
    <PatternView
      config={config}
      state={state}
      dispatch={dispatch}
      cpa="C"
      mode={state.mode}
      targetSize={size as 48}
    />,
  );
}

function renderConfig(config: GrowthConfig) {
  return renderState(config, createInitialState(config));
}

const BASE: GrowthConfig = { mode: 'growth' };

describe('E15 growth 보기 판', () => {
  it('1~stepsShown 단계를 그리고 다음 단계는 그리지 않는다', () => {
    const { container } = renderConfig(BASE);
    const canvas = container.querySelector('[data-testid="growth-canvas"]') as Element;
    expect(canvas).not.toBeNull();
    // L 1·2·3단계 = 1 + 3 + 5
    expect(canvas.querySelectorAll('g[data-stage]')).toHaveLength(9);
    expect(canvas.querySelectorAll('g[data-stage="4"]')).toHaveLength(0);
    expect(canvas.textContent).toContain('3단계');
    expect(canvas.textContent).not.toContain('4단계');
  });

  it('늘어난 쌓기나무만 data-new이고 1단계는 강조하지 않는다', () => {
    const { container } = renderConfig(BASE);
    expect(container.querySelectorAll('g[data-stage="1"][data-new="true"]')).toHaveLength(0);
    expect(container.querySelectorAll('g[data-stage="2"][data-new="true"]')).toHaveLength(2);
    expect(container.querySelectorAll('g[data-stage="3"][data-new="true"]')).toHaveLength(2);
    expect(container.querySelectorAll('g[data-stage="3"][data-new="false"]')).toHaveLength(3);
  });

  it('늘어난 쌓기나무는 색 말고도 굵은 윤곽과 점 무늬가 있다', () => {
    const { container } = renderConfig(BASE);
    const fresh = container.querySelector('g[data-stage="2"][data-new="true"]') as Element;
    const plain = container.querySelector('g[data-stage="2"][data-new="false"]') as Element;
    const width = (g: Element) =>
      Number(g.querySelector('polygon')?.getAttribute('stroke-width') ?? '0');
    expect(width(fresh)).toBeGreaterThan(width(plain));
    expect(fresh.innerHTML).toContain('url(#');
    expect(plain.innerHTML).not.toContain('url(#');
  });

  it('highlightIncrement false이면 모두 data-new false', () => {
    const { container } = renderConfig({ ...BASE, highlightIncrement: false });
    expect(container.querySelectorAll('g[data-new="true"]')).toHaveLength(0);
  });

  it('쌓기나무 한 칸의 논리 폭은 32이다(최소 화면 24px 기준 배율 0.75)', () => {
    const { container } = renderConfig({ ...BASE, look: 'flat' });
    const rect = container.querySelector('g[data-stage] rect') as SVGRectElement;
    expect(Number(rect.getAttribute('width'))).toBeGreaterThanOrEqual(31);
  });

  it('look none이면 판이 없고 표는 있다', () => {
    const { container } = renderConfig({ ...BASE, look: 'none' });
    expect(container.querySelector('[data-testid="growth-canvas"]')).toBeNull();
    expect(container.querySelector('[data-testid="growth-board"]')).toBeNull();
    expect(container.querySelector('[data-testid="growth-table"]')).not.toBeNull();
  });

  it('table false이면 표와 패드가 없다', () => {
    const { container } = renderConfig({ ...BASE, table: false });
    expect(container.querySelector('[data-testid="growth-table"]')).toBeNull();
    expect(container.querySelector('[data-testid="growth-pad"]')).toBeNull();
    expect(container.querySelector('[data-testid="growth-canvas"]')).not.toBeNull();
  });

  it('늘어난 수·정답 개수 배지가 DOM에 없다(표 빈칸은 비어 있다)', () => {
    const { container } = renderConfig(BASE);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/모두 \d+개/);
    expect(text).not.toMatch(/\+\s*\d/);
    expect(text).not.toMatch(/[✓✕]/);
    for (const cell of container.querySelectorAll('[data-cell]')) {
      expect(cell.textContent).toBe('');
    }
    // 정답 개수(4단계 7, 5단계 9)가 글자로 나오지 않는다.
    const table = container.querySelector('[data-testid="growth-table"]') as Element;
    const digits = [...table.querySelectorAll('[data-given]')].map((el) => el.textContent);
    expect(digits).toEqual(['1', '3', '5']);
  });

  it('counts blank이면 보여 준 단계의 개수도 빈칸이다', () => {
    const { container } = renderConfig({ ...BASE, table: { counts: 'blank' } });
    expect(container.querySelectorAll('[data-given]')).toHaveLength(0);
    expect(container.querySelector('[data-cell="1.count"]')).not.toBeNull();
  });

  it('increments off이면 늘어난 수 줄이 없다', () => {
    const { container } = renderConfig({ ...BASE, table: { increments: 'off' } });
    expect(container.querySelectorAll('[data-cell$=".inc"]')).toHaveLength(0);
    expect(container.querySelector('[data-cell="4.count"]')).not.toBeNull();
  });
});

describe('E15 growth 표·입력', () => {
  it('빈칸 단추는 단계 2부터 inc, stepsShown 다음부터 count이다', () => {
    const { container } = renderConfig(BASE);
    const keys = [...container.querySelectorAll('[data-cell]')].map((el) =>
      el.getAttribute('data-cell'),
    );
    // 표는 줄 순서(개수 줄 다음 늘어난 수 줄)로 그려진다.
    expect(keys).toEqual(['4.count', '5.count', '2.inc', '3.inc', '4.inc', '5.inc']);
  });

  it('칸 누르기와 숫자 패드는 activate·type Action을 보낸다', () => {
    const dispatch = vi.fn<(action: PatternAction) => void>();
    const { container, getByRole } = renderState(BASE, createInitialState(BASE), dispatch as never);
    fireEvent.click(container.querySelector('[data-cell="4.count"]') as Element);
    expect(dispatch).toHaveBeenCalledWith({ type: 'activate', cell: '4.count' });
    fireEvent.click(getByRole('button', { name: '7' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'type', key: '7' });
    fireEvent.click(getByRole('button', { name: '지우기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'backspace' });
    fireEvent.click(getByRole('button', { name: '모두 지우기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'clear' });
  });

  it('키보드: 방향키는 move, 숫자는 type, Backspace·Delete는 지우기', () => {
    const dispatch = vi.fn<(action: PatternAction) => void>();
    const { container } = renderState(BASE, createInitialState(BASE), dispatch as never);
    const cell = container.querySelector('[data-cell="2.inc"]') as Element;
    fireEvent.keyDown(cell, { key: 'ArrowRight' });
    fireEvent.keyDown(cell, { key: 'ArrowDown' });
    fireEvent.keyDown(cell, { key: '2' });
    fireEvent.keyDown(cell, { key: 'Backspace' });
    fireEvent.keyDown(cell, { key: 'Delete' });
    expect(dispatch.mock.calls.map((call) => call[0])).toEqual([
      { type: 'move', dir: 'right' },
      { type: 'move', dir: 'down' },
      { type: 'type', key: '2' },
      { type: 'backspace' },
      { type: 'clear' },
    ]);
  });

  it('입력한 글자가 칸에 나오고 고른 칸은 data-active이다', () => {
    let state = createInitialState(BASE);
    state = reduce(state, { type: 'activate', cell: '4.count' });
    state = reduce(state, { type: 'type', key: '7' });
    const { container } = renderState(BASE, state);
    const cell = container.querySelector('[data-cell="4.count"]') as Element;
    expect(cell.textContent).toBe('7');
    expect(cell.getAttribute('data-active')).toBe('true');
    expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(1);
  });

  it('칸 단추와 패드 단추 크기 규칙(CSS 클래스)을 쓴다', () => {
    const { container } = renderConfig(BASE);
    expect((container.querySelector('[data-cell]') as HTMLElement).className).toContain(
      'growthCell',
    );
    expect(
      container.querySelector('[data-testid="growth-pad"]')?.querySelectorAll('button'),
    ).toHaveLength(12);
  });
});

describe('E15 growth-split 오버레이', () => {
  function renderOverlay(config: GrowthConfig) {
    return render(
      <div>
        <svg data-testid="growth-canvas" width={400} height={200} />
        <GrowthSplitOverlay config={config} state={createInitialState(config)} args={{}} />
      </div>,
    );
  }

  it('앞 단계는 덮개, 새 쌓기나무는 테두리, 단계마다 전체 개수 배지를 달고 다음 단계는 없다', () => {
    const { container } = renderOverlay(BASE);
    expect(container.querySelectorAll('[data-testid="growth-split-panel"]')).toHaveLength(3);
    // 2단계: 덮개 1 + 새 2, 3단계: 덮개 3 + 새 2
    expect(container.querySelectorAll('[data-testid="growth-split-cover"]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-testid="growth-split-new"]')).toHaveLength(4);
    const badges = [...container.querySelectorAll('[data-testid="growth-split-badge"]')].map(
      (el) => el.textContent,
    );
    expect(badges).toEqual(['모두 1개', '모두 3개', '모두 5개']);
    expect(container.textContent).not.toContain('모두 7개');
  });

  it('look none이면 그리지 않는다', () => {
    const { container } = renderOverlay({ ...BASE, look: 'none' });
    expect(container.querySelector('[data-testid="growth-split-panel"]')).toBeNull();
  });
});
