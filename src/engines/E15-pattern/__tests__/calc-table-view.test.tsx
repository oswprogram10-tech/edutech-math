/** @vitest-environment jsdom */
/** E15 표 변형 화면·오버레이 테스트: 가린 칸 값이 DOM에 없음, 도구 표시 조건, 키보드, cell-diff. */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CellDiffOverlay } from '../overlays/cell-diff';
import { createInitialState, reduce } from '../reduce';
import type { CalcTableConfig, PatternAction, PatternConfig, PatternState } from '../types';
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

function renderConfig(config: Partial<CalcTableConfig> = {}, dispatch = vi.fn()) {
  const full: CalcTableConfig = { mode: 'calc-pattern', table: 'addition', ...config };
  return renderState(full, createInitialState(full), dispatch);
}

function apply(config: CalcTableConfig, actions: readonly PatternAction[]): PatternState {
  return actions.reduce<PatternState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

const MUL_9: CalcTableConfig = {
  mode: 'calc-pattern',
  table: 'multiplication',
  size: [9, 9],
  hidden: [[7, 7]],
  magnifierUses: 2,
};

describe('표 화면', () => {
  it('가린 칸의 값은 DOM에 없고 "?"만 그린다', () => {
    const { container } = renderState(MUL_9, createInitialState(MUL_9));
    const canvas = container.querySelector('[data-testid="calc-table-canvas"]') as Element;
    // 8 × 8 = 64는 이 표에서 가린 칸에만 있다.
    const texts = [...canvas.querySelectorAll('[data-cell-text]')].map((el) => el.textContent);
    expect(texts).not.toContain('64');
    expect(canvas.querySelector('[data-cell-text="7.7"]')?.textContent).toBe('?');
    const hiddenCell = canvas.querySelector('[data-cell="7.7"]') as Element;
    expect(hiddenCell.getAttribute('aria-label')).not.toMatch(/64/);
    expect(hiddenCell.getAttribute('data-state')).toBe('hidden');
    // 안 가린 칸과 머리 칸은 값이 보인다.
    expect(canvas.querySelector('[data-cell-text="6.6"]')?.textContent).toBe('49');
    expect(canvas.querySelector('[data-col-head="8"]')?.textContent).toBe('9');
    expect(canvas.querySelector('[data-testid="calc-table-corner"]')?.textContent).toBe('×');
    expect(container.textContent).not.toMatch(/[✓✕]/);
  });

  it('덧셈표 모서리는 +이고 가린 칸이 25개(6×6 most)다', () => {
    const { container } = renderConfig();
    expect(container.querySelector('[data-testid="calc-table-corner"]')?.textContent).toBe('+');
    expect(container.querySelectorAll('[data-state="hidden"]')).toHaveLength(25);
    expect(container.querySelectorAll('[data-cell]')).toHaveLength(36);
  });

  it('쓴 수는 그 칸에 보이고 aria-label에도 쓴 수가 있다', () => {
    const state = apply({ mode: 'calc-pattern', table: 'addition' }, [
      { type: 'activate', cell: '2.3' },
      { type: 'type', key: '7' },
    ]);
    const { container } = renderState({ mode: 'calc-pattern', table: 'addition' }, state);
    expect(container.querySelector('[data-cell-text="2.3"]')?.textContent).toBe('7');
    expect(container.querySelector('[data-cell="2.3"]')?.getAttribute('data-active')).toBe('true');
    expect(container.querySelector('[data-cell="2.3"]')?.getAttribute('aria-label')).toContain(
      '쓴 수 7',
    );
  });

  it('돋보기로 연 칸은 값과 돋보기 아이콘이 보이고 입력 칸이 아니다', () => {
    const state = apply(MUL_9, [{ type: 'peek', cell: '7.7' }]);
    const { container } = renderState(MUL_9, state);
    expect(container.querySelector('[data-cell-text="7.7"]')?.textContent).toContain('64');
    expect(container.querySelector('[data-peeked-icon="7.7"]')).not.toBeNull();
    expect(container.querySelector('[data-cell="7.7"]')?.getAttribute('data-state')).toBe('peeked');
    expect(container.querySelector('[data-cell="7.7"]')?.getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('도구 단추: 돋보기는 magnifierUses가 있을 때만, 화살표는 drawArrows일 때만', () => {
    const none = renderConfig();
    expect(none.container.querySelector('[data-testid="table-tool-magnifier"]')).toBeNull();
    expect(none.container.querySelector('[data-testid="table-tool-arrow"]')).toBeNull();
    expect(none.getByRole('button', { name: '수 쓰기' })).not.toBeNull();
    cleanup();
    const both = renderConfig({ magnifierUses: 3, drawArrows: true });
    expect(both.getByRole('button', { name: '돋보기 (남은 3번)' })).not.toBeNull();
    expect(both.getByRole('button', { name: '화살표' })).not.toBeNull();
  });

  it('돋보기 남은 횟수가 단추에 줄어들어 보이고 도구를 바꾸면 set-tool을 보낸다', () => {
    const dispatch = vi.fn<(action: PatternAction) => void>();
    const state = apply(MUL_9, [{ type: 'peek', cell: '7.7' }]);
    const { getByRole } = renderState(MUL_9, state, dispatch as never);
    fireEvent.click(getByRole('button', { name: '돋보기 (남은 1번)' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'set-tool', tool: 'magnifier' });
  });

  it('설정 오류면 오류 판을 그린다', () => {
    const { container } = renderConfig({ table: 'division' as never });
    expect(container.querySelector('[data-testid="calc-table-error"]')).not.toBeNull();
    expect(container.querySelector('[data-cell]')).toBeNull();
  });

  it('칸 누르기: 쓰기 도구는 activate, 돋보기 도구는 activate+peek, 화살표 도구는 arrow-start', () => {
    const config: CalcTableConfig = {
      mode: 'calc-pattern',
      table: 'addition',
      magnifierUses: 2,
      drawArrows: true,
    };
    const write = vi.fn<(action: PatternAction) => void>();
    const first = renderState(config, createInitialState(config), write as never);
    fireEvent.click(first.container.querySelector('[data-cell="2.2"]') as Element);
    expect(write).toHaveBeenCalledWith({ type: 'activate', cell: '2.2' });
    expect(write).not.toHaveBeenCalledWith({ type: 'peek', cell: '2.2' });
    cleanup();

    const lens = vi.fn<(action: PatternAction) => void>();
    const magnifier = apply(config, [{ type: 'set-tool', tool: 'magnifier' }]);
    const second = renderState(config, magnifier, lens as never);
    fireEvent.click(second.container.querySelector('[data-cell="2.2"]') as Element);
    expect(lens).toHaveBeenCalledWith({ type: 'peek', cell: '2.2' });
    cleanup();

    const arrow = vi.fn<(action: PatternAction) => void>();
    const drawing = apply(config, [{ type: 'set-tool', tool: 'arrow' }]);
    const third = renderState(config, drawing, arrow as never);
    fireEvent.click(third.container.querySelector('[data-cell="0.0"]') as Element);
    expect(arrow).toHaveBeenCalledWith({ type: 'arrow-start', cell: '0.0' });
  });

  it('쓰기 도구에서 안 가린 칸을 눌러도 아무 Action도 보내지 않는다', () => {
    const dispatch = vi.fn<(action: PatternAction) => void>();
    const { container } = renderConfig({}, dispatch as never);
    fireEvent.click(container.querySelector('[data-cell="0.0"]') as Element);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('패드는 쓰기 도구에서 type·backspace·clear를 보낸다', () => {
    const dispatch = vi.fn<(action: PatternAction) => void>();
    const { getByRole } = renderConfig({}, dispatch as never);
    fireEvent.click(getByRole('button', { name: '7' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'type', key: '7' });
    fireEvent.click(getByRole('button', { name: '지우기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'backspace' });
    fireEvent.click(getByRole('button', { name: '모두 지우기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'clear' });
  });
});

describe('표 키보드', () => {
  const config: CalcTableConfig = {
    mode: 'calc-pattern',
    table: 'addition',
    magnifierUses: 2,
    drawArrows: true,
  };

  function keys(initial: PatternState, ...presses: string[]) {
    const dispatch = vi.fn<(action: PatternAction) => void>();
    const { container } = renderState(config, initial, dispatch as never);
    const canvas = container.querySelector('[data-testid="calc-table-canvas"]') as Element;
    for (const key of presses) fireEvent.keyDown(canvas, { key });
    return dispatch.mock.calls.map((call) => call[0]);
  }

  it('방향키는 move, 숫자는 type, Backspace는 backspace, Delete·Escape는 clear', () => {
    const state = createInitialState(config);
    expect(keys(state, 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown')).toEqual([
      { type: 'move', dir: 'right' },
      { type: 'move', dir: 'left' },
      { type: 'move', dir: 'up' },
      { type: 'move', dir: 'down' },
    ]);
    expect(keys(state, '4', 'Backspace', 'Delete', 'Escape')).toEqual([
      { type: 'type', key: '4' },
      { type: 'backspace' },
      { type: 'clear' },
      { type: 'clear' },
    ]);
  });

  it('M은 돋보기 도구로 바꾸고 Enter는 고른 칸을 연다', () => {
    const state = createInitialState(config);
    expect(keys(state, 'm')).toEqual([{ type: 'set-tool', tool: 'magnifier' }]);
    const lens = apply(config, [
      { type: 'set-tool', tool: 'magnifier' },
      { type: 'activate', cell: '2.2' },
    ]);
    expect(keys(lens, 'Enter')).toEqual([{ type: 'peek', cell: '2.2' }]);
  });

  it('돋보기 설정이 없으면 M은 아무것도 하지 않는다', () => {
    const plain: CalcTableConfig = { mode: 'calc-pattern', table: 'addition' };
    const dispatch = vi.fn<(action: PatternAction) => void>();
    const { container } = renderState(plain, createInitialState(plain), dispatch as never);
    fireEvent.keyDown(container.querySelector('[data-testid="calc-table-canvas"]') as Element, {
      key: 'M',
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('화살표 도구: Enter로 시작, 1~4로 방향, 숫자로 증가량, Enter로 놓기', () => {
    const arrow = apply(config, [
      { type: 'set-tool', tool: 'arrow' },
      { type: 'activate', cell: '1.1' },
    ]);
    expect(keys(arrow, 'Enter')).toEqual([{ type: 'arrow-start', cell: '1.1' }]);
    const started = apply(config, [
      { type: 'set-tool', tool: 'arrow' },
      { type: 'arrow-start', cell: '1.1' },
    ]);
    expect(keys(started, '3')).toEqual([{ type: 'arrow-dir', dir: 'down-right' }]);
    expect(keys(started, '1')).toEqual([{ type: 'arrow-dir', dir: 'right' }]);
    const picked = apply(config, [
      { type: 'set-tool', tool: 'arrow' },
      { type: 'arrow-start', cell: '1.1' },
      { type: 'arrow-dir', dir: 'down-right' },
    ]);
    expect(keys(picked, '2', 'Backspace', 'Enter')).toEqual([
      { type: 'arrow-type', key: '2' },
      { type: 'arrow-backspace' },
      { type: 'arrow-commit' },
    ]);
  });

  it('칸 하나만 Tab 정지점이다(고른 칸, 없으면 첫 가린 칸)', () => {
    const { container } = renderState(config, createInitialState(config));
    const stops = [...container.querySelectorAll('[data-cell][tabindex="0"]')];
    expect(stops).toHaveLength(1);
    expect(stops[0]?.getAttribute('data-cell')).toBe('1.1');
  });
});

describe('표 화살표 화면', () => {
  const config: CalcTableConfig = {
    mode: 'calc-pattern',
    table: 'addition',
    drawArrows: true,
  };

  it('방향 단추 넷은 글자와 그림(화살표)을 함께 쓰고 칸을 고른 뒤에야 켜진다', () => {
    const arrow = apply(config, [{ type: 'set-tool', tool: 'arrow' }]);
    const before = renderState(config, arrow);
    const buttons = [...before.container.querySelectorAll('[data-testid="table-dirs"] button')];
    expect(buttons.map((b) => b.textContent)).toEqual([
      '→ 오른쪽',
      '↓ 아래',
      '↘ 오른쪽 아래',
      '↙ 왼쪽 아래',
    ]);
    expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    cleanup();
    const started = apply(config, [
      { type: 'set-tool', tool: 'arrow' },
      { type: 'arrow-start', cell: '0.0' },
    ]);
    const after = renderState(config, started);
    const enabled = [...after.container.querySelectorAll('[data-testid="table-dirs"] button')].map(
      (b) => !(b as HTMLButtonElement).disabled,
    );
    // 0열이라 ↙은 몸통 밖이다.
    expect(enabled).toEqual([true, true, true, false]);
  });

  it('놓은 화살표는 +n 글자와 함께 그려지고 지우기 단추가 있다', () => {
    const state = apply(config, [
      { type: 'set-tool', tool: 'arrow' },
      { type: 'arrow-start', cell: '1.1' },
      { type: 'arrow-dir', dir: 'down-right' },
      { type: 'arrow-type', key: '2' },
      { type: 'arrow-commit' },
    ]);
    const dispatch = vi.fn<(action: PatternAction) => void>();
    const { container, getByRole } = renderState(config, state, dispatch as never);
    const drawn = container.querySelector('[data-arrow="1.1"]') as Element;
    expect(drawn.getAttribute('data-dir')).toBe('down-right');
    expect(drawn.textContent).toBe('+2');
    fireEvent.click(getByRole('button', { name: '↘ +2 (2번째 줄 2번째 칸) 지우기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'arrow-remove', index: 0 });
    expect(container.textContent).not.toMatch(/[✓✕]/);
  });
});

describe('cell-diff 오버레이', () => {
  const config: CalcTableConfig = {
    mode: 'calc-pattern',
    table: 'multiplication',
    size: [6, 6],
    hidden: [[4, 3]],
  };

  function renderOverlay(state: PatternState, args: unknown = {}) {
    return render(
      <div>
        <svg data-testid="calc-table-canvas" width={400} height={400} />
        <CellDiffOverlay config={config} state={state} args={args} />
      </div>,
    );
  }

  it('ROW-COL이 걸린 칸 기준으로 → +5(같은 줄)와 ↓ +4(같은 칸)를 그린다', () => {
    const state = apply(config, [
      { type: 'activate', cell: '4.3' },
      { type: 'type', key: '1' },
      { type: 'type', key: '9' },
    ]);
    const { container } = renderOverlay(state);
    expect(container.querySelector('[data-testid="cell-diff-row-label"]')?.textContent).toBe(
      '→ +5',
    );
    expect(container.querySelector('[data-testid="cell-diff-col-label"]')?.textContent).toBe(
      '↓ +4',
    );
    // 가린 칸의 값(20)과 학생이 쓴 수(19)는 쓰지 않는다.
    expect(container.textContent).not.toContain('20');
    expect(container.textContent).not.toContain('19');
  });

  it('args.cell이 있으면 그 칸 기준이고 가린 칸·머리 칸은 짝으로 쓰지 않는다', () => {
    const many: CalcTableConfig = {
      ...config,
      hidden: [
        [4, 2],
        [4, 3],
      ],
    };
    const state = createInitialState(many);
    const { container } = render(
      <div>
        <svg data-testid="calc-table-canvas" width={400} height={400} />
        <CellDiffOverlay config={many} state={state} args={{ cell: '4.3' }} />
      </div>,
    );
    // 같은 줄(4)에서 보이는 짝은 (4.0, 4.1)과 (4.4, 4.5)이고, 4.3에서 더 가까운 (4.4, 4.5)를 쓴다.
    const row = container.querySelector('[data-testid="cell-diff-row"]') as Element;
    expect(row.getAttribute('data-from')).toBe('4');
    expect(container.querySelector('[data-testid="cell-diff-row-label"]')?.textContent).toBe(
      '→ +5',
    );
  });

  it('오개념도 args.cell도 없으면 아무것도 그리지 않는다', () => {
    const { container } = renderOverlay(createInitialState(config));
    expect(container.querySelector('[data-testid="cell-diff-row"]')).toBeNull();
    expect(container.querySelector('[data-testid="cell-diff-col"]')).toBeNull();
  });

  it('피라미드 상태에서는 그리지 않는다', () => {
    const pyramid = createInitialState({ mode: 'calc-pattern', pattern: 'symmetric-sum-square' });
    const { container } = renderOverlay(pyramid);
    expect(container.querySelector('[data-overlay], [data-testid="cell-diff"]')).toBeNull();
  });
});
