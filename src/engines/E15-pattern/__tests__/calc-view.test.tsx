/** @vitest-environment jsdom */
/** E15 calc-pattern 화면·오버레이 테스트: 쌓기 칸 크기, 정답 노출, 강조, 키보드. */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import { ColumnLinkOverlay } from '../overlays/column-link';
import { StepTableOverlay } from '../overlays/step-table';
import type { CalcPatternConfig, PatternAction, PatternConfig, PatternState } from '../types';
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

function renderConfig(config: PatternConfig) {
  return renderState(config, createInitialState(config));
}

function play(config: PatternConfig, actions: readonly PatternAction[]): PatternState {
  return actions.reduce<PatternState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

const SYM: CalcPatternConfig = {
  mode: 'calc-pattern',
  pattern: 'symmetric-sum-square',
  stepsShown: 3,
  workStep: 4,
};

describe('E15 calc-pattern 보기 판', () => {
  it('1~stepsShown 단계의 열·식의 수를 data-step·data-col·data-term으로 그린다', () => {
    const { container } = renderConfig(SYM);
    const canvas = container.querySelector('[data-testid="calc-canvas"]') as Element;
    expect(canvas).not.toBeNull();
    // 1·3·5열
    expect(canvas.querySelectorAll('g[data-col]')).toHaveLength(9);
    expect(canvas.querySelectorAll('g[data-term]')).toHaveLength(9);
    expect(canvas.querySelectorAll('g[data-step="3"][data-col]')).toHaveLength(5);
    expect(canvas.querySelectorAll('g[data-step="4"]')).toHaveLength(0);
    // 3단계 식: 1 2 3 2 1 + = 3 × 3
    const terms = [...canvas.querySelectorAll('g[data-step="3"][data-term]')].map(
      (g) => g.textContent,
    );
    expect(terms).toEqual(['1', '2', '3', '2', '1']);
    expect(canvas.textContent).toContain('= 3 × 3');
  });

  it('보여 준 단계 밖(workStep)의 식·수는 DOM에 없다', () => {
    const { container } = renderConfig(SYM);
    expect(container.textContent ?? '').not.toContain('4 × 4');
    expect(container.textContent ?? '').not.toContain('= 16');
    expect(container.textContent ?? '').not.toContain('4단계');
  });

  it('블록 한 칸은 논리 28 이상이다(최소 화면 크기 24px 기준)', () => {
    const { container } = renderConfig(SYM);
    const rect = container.querySelector('g[data-col] rect') as SVGRectElement;
    expect(Number(rect.getAttribute('width'))).toBeGreaterThanOrEqual(26);
  });

  it('look none이면 블록이 없고 쌓기 칸도 없다. 식은 남는다', () => {
    const { container } = renderConfig({ ...SYM, look: 'none' });
    expect(container.querySelectorAll('g[data-col]')).toHaveLength(0);
    expect(container.querySelector('[data-testid="calc-build"]')).toBeNull();
    expect(container.querySelectorAll('g[data-term]').length).toBeGreaterThan(0);
  });

  it('look picture는 블록 그림만 있고 쌓기 칸이 없다', () => {
    const { container } = renderConfig({ ...SYM, look: 'picture' });
    expect(container.querySelectorAll('g[data-col]').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-testid="calc-build"]')).toBeNull();
  });

  it('repunit은 블록 그림과 쌓기 칸이 없고 식 한 줄씩이다', () => {
    const config: CalcPatternConfig = {
      mode: 'calc-pattern',
      pattern: 'repunit-square',
      stepsShown: 4,
    };
    const { container } = renderConfig(config);
    expect(container.querySelectorAll('g[data-col]')).toHaveLength(0);
    expect(container.querySelector('[data-testid="calc-build"]')).toBeNull();
    const row4 = [...container.querySelectorAll('g[data-step="4"][data-term]')].map(
      (g) => g.textContent,
    );
    expect(row4).toEqual(['1111', '1111', '1234321']);
    expect(container.querySelector('[data-testid="calc-expr"]')).not.toBeNull();
  });

  it('expression=false이면 식 칸과 키패드가 없다', () => {
    const { container } = renderConfig({ ...SYM, expression: false });
    expect(container.querySelector('[data-testid="calc-expr"]')).toBeNull();
    expect(container.querySelector('[data-testid="calc-pad"]')).toBeNull();
    expect(container.querySelector('[data-testid="calc-build"]')).not.toBeNull();
  });

  it('설정 오류면 오류 판만 그린다', () => {
    const { container } = renderConfig({ ...SYM, pattern: 'nope' } as unknown as PatternConfig);
    expect(container.querySelector('[data-testid="calc-error"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="calc-canvas"]')).toBeNull();
  });

  it('학년·점수 글자와 맞고 틀림(✓ ✕) 표시가 없다', () => {
    const state = play(SYM, [
      { type: 'tap-cell', col: 0, h: 1 },
      ...[...'1+2=3'].map((key) => ({ type: 'type' as const, key })),
    ]);
    const { container } = renderState(SYM, state);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/학년|점수/);
    expect(text).not.toMatch(/[✓✕✔✖]/);
    expect(container.querySelector('[data-correct],[data-wrong],[data-fit]')).toBeNull();
  });
});

describe('E15 calc-pattern 쌓기 칸', () => {
  it('열 2n+1, 행 n+1 격자라 정답 모양이 칸 수로 드러나지 않는다', () => {
    for (const workStep of [1, 4, 9]) {
      const { container, unmount } = renderConfig({ ...SYM, workStep });
      const cells = container.querySelectorAll('[data-testid="calc-build"] rect[data-col]');
      expect(cells).toHaveLength((2 * workStep + 1) * (workStep + 1));
      const maxCol = Math.max(...[...cells].map((c) => Number(c.getAttribute('data-col'))));
      const maxH = Math.max(...[...cells].map((c) => Number(c.getAttribute('data-h'))));
      expect(maxCol).toBe(2 * workStep);
      expect(maxH).toBe(workStep + 1);
      unmount();
    }
  });

  it('칸의 크기는 targetSize 이상이다', () => {
    for (const size of [48, 64]) {
      const { container, unmount } = renderState(SYM, createInitialState(SYM), vi.fn(), size);
      const svg = container.querySelector('[data-testid="calc-build"]') as SVGSVGElement;
      const cols = 9;
      expect(Number(svg.getAttribute('width')) / cols).toBeGreaterThanOrEqual(size);
      unmount();
    }
  });

  it('칸을 누르면 tap-cell을 보낸다', () => {
    const dispatch = vi.fn();
    const { container } = renderState(SYM, createInitialState(SYM), dispatch);
    fireEvent.click(container.querySelector('rect[data-col="3"][data-h="2"]') as Element);
    expect(dispatch).toHaveBeenCalledWith({ type: 'tap-cell', col: 3, h: 2 });
  });

  it('쌓은 블록은 채워 그리고 개수를 숫자로 보여 준다', () => {
    const state = play(SYM, [
      { type: 'tap-cell', col: 0, h: 2 },
      { type: 'tap-cell', col: 1, h: 3 },
    ]);
    const { container } = renderState(SYM, state);
    expect(container.querySelectorAll('rect[data-filled="true"]')).toHaveLength(5);
    expect(container.querySelector('[data-testid="calc-built-count"]')?.textContent).toBe(
      '블록 5개',
    );
  });

  it('키보드: 방향키는 move-cursor, Enter·Space는 쌓기, 숫자 키는 그 높이로 쌓기', () => {
    const dispatch = vi.fn();
    const { container } = renderState(SYM, createInitialState(SYM), dispatch);
    const svg = container.querySelector('[data-testid="calc-build"]') as SVGSVGElement;
    expect(svg.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'move-cursor', dx: 1, dy: 0 });
    fireEvent.keyDown(svg, { key: 'ArrowUp' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'move-cursor', dx: 0, dy: 1 });
    fireEvent.keyDown(svg, { key: 'ArrowDown' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'move-cursor', dx: 0, dy: -1 });
    fireEvent.keyDown(svg, { key: 'Enter' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'tap-cell', col: 0, h: 1 });
    fireEvent.keyDown(svg, { key: '3' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'tap-cell', col: 0, h: 3 });
    dispatch.mockClear();
    fireEvent.keyDown(svg, { key: '9' }); // 행은 5까지
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('커서가 있는 칸에 굵은 테두리가 있다', () => {
    const { container } = renderConfig(SYM);
    expect(
      container.querySelectorAll('[data-testid="calc-build"] [data-cursor="true"]'),
    ).toHaveLength(1);
  });

  it('readOnly이면 쌓기·키패드가 막힌다', () => {
    const dispatch = vi.fn();
    const { container } = render(
      <PatternView
        config={SYM}
        state={createInitialState(SYM)}
        dispatch={dispatch}
        cpa="C"
        mode="calc-pattern"
        targetSize={48}
        readOnly
      />,
    );
    fireEvent.click(container.querySelector('rect[data-col="0"][data-h="1"]') as Element);
    fireEvent.click(container.querySelector('g[data-col="0"]') as Element);
    expect(dispatch).not.toHaveBeenCalled();
    const buttons = [...container.querySelectorAll('[data-testid="calc-pad"] button')];
    expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });
});

describe('E15 calc-pattern 식 칸', () => {
  it('키패드는 0-9 + × =, 지우기, 모두 지우기 단추를 가진다', () => {
    const { container } = renderConfig(SYM);
    const names = [...container.querySelectorAll('[data-testid="calc-pad"] button')].map(
      (b) => b.textContent,
    );
    expect(names).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '0',
      '+',
      '×',
      '=',
      '지우기',
      '모두 지우기',
    ]);
  });

  it('단추는 type·backspace·clear-expr를 보낸다', () => {
    const dispatch = vi.fn();
    const { container } = renderState(SYM, createInitialState(SYM), dispatch);
    const pad = container.querySelector('[data-testid="calc-pad"]') as Element;
    const click = (name: string) =>
      fireEvent.click(
        [...pad.querySelectorAll('button')].find((b) => b.textContent === name) as Element,
      );
    click('4');
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'type', key: '4' });
    click('×');
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'type', key: '×' });
    click('지우기');
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'backspace' });
    click('모두 지우기');
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'clear-expr' });
  });

  it('물리 키보드: 숫자·+·=·*(×)·Backspace·Delete', () => {
    const dispatch = vi.fn();
    const { container } = renderState(SYM, createInitialState(SYM), dispatch);
    const input = container.querySelector('[data-testid="calc-expr-input"]') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    fireEvent.keyDown(input, { key: '7' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'type', key: '7' });
    fireEvent.keyDown(input, { key: '+' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'type', key: '+' });
    fireEvent.keyDown(input, { key: '=' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'type', key: '=' });
    fireEvent.keyDown(input, { key: '*' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'type', key: '×' });
    fireEvent.keyDown(input, { key: 'x' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'type', key: '×' });
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'backspace' });
    fireEvent.keyDown(input, { key: 'Delete' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'clear-expr' });
  });

  it('쓴 식은 띄어 쓴 글자로 보이고, 읽을 수 없으면 밑줄 조각이 생긴다', () => {
    const ok = play(
      SYM,
      [...'1+2=3'].map((key) => ({ type: 'type' as const, key })),
    );
    const { container, unmount } = renderState(SYM, ok);
    expect(container.querySelector('[data-testid="calc-expr"]')?.textContent).toContain(
      '1 + 2 = 3',
    );
    expect(container.querySelector('[data-testid="calc-expr-error"]')).toBeNull();
    unmount();
    const bad = play(
      SYM,
      [...'1+'].map((key) => ({ type: 'type' as const, key })),
    );
    const second = renderState(SYM, bad);
    expect(second.container.querySelector('[data-testid="calc-expr-error"]')).not.toBeNull();
    expect(
      second.container.querySelector('[data-testid="calc-expr"]')?.getAttribute('data-readable'),
    ).toBe('false');
  });
});

describe('E15 calc-pattern 열 ↔ 식의 수 강조', () => {
  it('열을 누르면 link를 보낸다. 같은 열을 다시 누르면 거둔다', () => {
    const dispatch = vi.fn();
    const { container } = renderState(SYM, createInitialState(SYM), dispatch);
    fireEvent.click(container.querySelector('g[data-step="3"][data-col="2"]') as Element);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'link', step: 3, col: 2 });
    cleanup();
    const linked = play(SYM, [{ type: 'link', step: 3, col: 2 }]);
    const again = renderState(SYM, linked, dispatch);
    fireEvent.click(again.container.querySelector('g[data-step="3"][data-col="2"]') as Element);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'link', step: null });
  });

  it('식의 수를 누르면 같은 번호 열을 강조하도록 link를 보낸다', () => {
    const dispatch = vi.fn();
    const { container } = renderState(SYM, createInitialState(SYM), dispatch);
    fireEvent.click(container.querySelector('g[data-step="2"][data-term="1"]') as Element);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'link', step: 2, col: 1 });
  });

  it('Enter로도 누른 것과 같다(포커스 가능)', () => {
    const dispatch = vi.fn();
    const { container } = renderState(SYM, createInitialState(SYM), dispatch);
    const col = container.querySelector('g[data-step="3"][data-col="0"]') as Element;
    expect(col.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(col, { key: 'Enter' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'link', step: 3, col: 0 });
  });

  it('강조는 색만이 아니다: 열 테두리와 식의 수 굵게·밑줄', () => {
    const state = play(SYM, [{ type: 'link', step: 3, col: 2 }]);
    const { container } = renderState(SYM, state);
    const col = container.querySelector('g[data-step="3"][data-col="2"]') as Element;
    const term = container.querySelector('g[data-step="3"][data-term="2"]') as Element;
    expect(col.getAttribute('data-linked')).toBe('true');
    expect(term.getAttribute('data-linked')).toBe('true');
    expect(col.querySelector('[data-testid="calc-col-mark"]')).not.toBeNull();
    expect(term.querySelector('[data-testid="calc-term-mark"]')).not.toBeNull();
    expect(term.querySelector('text')?.getAttribute('font-weight')).toBe('900');
    // 다른 열·수는 강조하지 않는다.
    expect(container.querySelectorAll('[data-linked="true"]')).toHaveLength(2);
  });

  it('linkHighlight=false이면 눌러도 아무것도 안 보내고 포커스 대상도 아니다', () => {
    const dispatch = vi.fn();
    const config = { ...SYM, linkHighlight: false };
    const { container } = renderState(config, createInitialState(config), dispatch);
    const col = container.querySelector('g[data-step="3"][data-col="2"]') as Element;
    expect(col.hasAttribute('tabindex')).toBe(false);
    fireEvent.click(col);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('E15 calc-pattern 오버레이', () => {
  it('step-table: 보여 준 단계까지의 단계와 블록 수만 쓴다(workStep 값 없음)', () => {
    const state = createInitialState(SYM);
    const { container } = render(<StepTableOverlay config={SYM} state={state} />);
    const cols = container.querySelectorAll('[data-testid="step-table-col"]');
    expect(cols).toHaveLength(3);
    expect([...cols].map((c) => c.textContent)).toEqual(['11', '24', '39']);
    expect(container.textContent).toContain('단계');
    expect(container.textContent).toContain('블록 수');
    expect(container.textContent).not.toContain('16');
  });

  it('step-table: stepsShown이 달라지면 그만큼만 쓴다', () => {
    const config = { ...SYM, stepsShown: 5, workStep: 6 };
    const { container } = render(
      <StepTableOverlay config={config} state={createInitialState(config)} />,
    );
    expect(container.querySelectorAll('[data-testid="step-table-col"]')).toHaveLength(5);
    expect(container.textContent).not.toContain('36');
  });

  it('step-table: repunit에는 그리지 않는다', () => {
    const config: CalcPatternConfig = { mode: 'calc-pattern', pattern: 'repunit-square' };
    const { container } = render(
      <StepTableOverlay config={config} state={createInitialState(config)} />,
    );
    expect(container.querySelector('[data-testid="step-table"]')).toBeNull();
  });

  it('column-link: 기본은 stepsShown 단계의 열마다 높이 숫자를 쓴다', () => {
    const { container } = render(
      <ColumnLinkOverlay config={SYM} state={createInitialState(SYM)} />,
    );
    const items = [...container.querySelectorAll('[data-testid="column-link-item"]')];
    expect(items.map((item) => item.querySelector('text')?.textContent)).toEqual([
      '1',
      '2',
      '3',
      '2',
      '1',
    ]);
    expect(container.querySelectorAll('line')).toHaveLength(5);
  });

  it('column-link: args.step을 따르고 범위 밖이면 기본 단계를 쓴다', () => {
    const state = createInitialState(SYM);
    const two = render(<ColumnLinkOverlay config={SYM} state={state} args={{ step: 2 }} />);
    expect(two.container.querySelectorAll('[data-testid="column-link-item"]')).toHaveLength(3);
    two.unmount();
    const out = render(<ColumnLinkOverlay config={SYM} state={state} args={{ step: 4 }} />);
    expect(out.container.querySelectorAll('[data-testid="column-link-item"]')).toHaveLength(5);
  });

  it('look none이면 column-link는 그리지 않는다', () => {
    const config = { ...SYM, look: 'none' as const };
    const { container } = render(
      <ColumnLinkOverlay config={config} state={createInitialState(config)} />,
    );
    expect(container.querySelector('[data-testid="column-link"]')).toBeNull();
  });
});
