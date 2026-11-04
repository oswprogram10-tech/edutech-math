/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import { baseTenStrings as S } from '../strings.ko';
import type { BaseTenAction, BaseTenConfig, BaseTenState } from '../types';
import { BaseTenView } from '../View';

afterEach(cleanup);

function renderView(
  config: BaseTenConfig,
  state: BaseTenState,
  onDispatch: (action: BaseTenAction) => void = () => {},
  targetSize: 48 | 64 = 48,
  readOnly = false,
) {
  return render(
    <BaseTenView
      config={config}
      state={state}
      dispatch={onDispatch}
      cpa="P"
      mode={state.mode}
      readOnly={readOnly}
      targetSize={targetSize}
    />,
  );
}

function textOf(config: BaseTenConfig, state: BaseTenState): string {
  return renderView(config, state).container.textContent ?? '';
}

describe('E01 기본 설정은 나타내는 수를 화면에 쓰지 않는다', () => {
  it('십 3·일 4를 놓아도 "34"가 DOM에 없다', () => {
    const config: BaseTenConfig = { mode: 'count', start: { tens: 3, ones: 4 } };
    const state = createInitialState(config);
    const text = textOf(config, state);
    expect(text).not.toContain('34');
    expect(text).not.toMatch(/34/);
  });

  it('낱개 7개를 놓아도 "7"이 DOM에 없다', () => {
    const config: BaseTenConfig = { mode: 'count', start: { ones: 7 } };
    const state = createInitialState(config);
    const text = textOf(config, state);
    expect(text).not.toMatch(/\b7\b/);
    expect(text).not.toContain('7개');
  });

  it('묶은 뒤에도 수를 숫자로 쓰지 않는다', () => {
    const config: BaseTenConfig = { mode: 'regroup' };
    let state = createInitialState(config);
    for (let index = 0; index < 23; index += 1) {
      state = reduce(state, { type: 'add', value: 1, x: 200 + index * 20, y: 250 });
    }
    state = reduce(state, { type: 'group-tens' });
    state = reduce(state, { type: 'group-tens' });
    const text = textOf(config, state);
    expect(text).not.toContain('23');
    expect(text).not.toContain('20');
  });
});

describe('E01 View 접근성', () => {
  it('블록 상자와 캔버스가 이름을 가진다', () => {
    const config: BaseTenConfig = { mode: 'count' };
    const state = createInitialState(config);
    const view = renderView(config, state);
    expect(view.getByLabelText(S.toolbox)).toBeTruthy();
    expect(view.getByRole('group', { name: S.canvasLabel })).toBeTruthy();
    expect(view.getByLabelText(S.addBlock(10))).toBeTruthy();
  });

  it('블록은 초점을 받고 Enter로 풀린다', () => {
    const config: BaseTenConfig = { mode: 'regroup', start: { hundreds: 1 } };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);

    const block = view.container.querySelector<SVGGElement>('[data-block-value="100"]');
    expect(block).not.toBeNull();
    expect(block?.getAttribute('tabindex')).toBe('0');
    expect(block?.getAttribute('role')).toBe('button');

    if (block) fireEvent.keyDown(block, { key: 'Enter' });
    expect(onDispatch).toHaveBeenCalledWith({ type: 'break', id: state.blocks[0]?.id });
  });

  it('방향키로 블록을 옮긴다', () => {
    const config: BaseTenConfig = { mode: 'count', start: { ones: 1 } };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);

    const block = view.container.querySelector<SVGGElement>('[data-block-value="1"]');
    if (block) fireEvent.keyDown(block, { key: 'ArrowRight' });
    const action = onDispatch.mock.calls[0]?.[0] as BaseTenAction | undefined;
    expect(action?.type).toBe('move');
    if (action?.type === 'move') {
      expect(action.x).toBe((state.blocks[0]?.x ?? 0) + 18);
    }
  });

  it('"10개 묶기" 버튼은 열 개가 모여야 눌린다', () => {
    const config: BaseTenConfig = { mode: 'regroup', start: { ones: 9 } };
    const state = createInitialState(config);
    const view = renderView(config, state);
    const button = view.getByRole('button', { name: S.groupTens });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    let tenState = createInitialState({ mode: 'regroup' });
    for (let index = 0; index < 10; index += 1) {
      tenState = reduce(tenState, { type: 'add', value: 1, x: 200 + index * 20, y: 250 });
    }
    const enabledView = renderView({ mode: 'regroup' }, tenState);
    const enabled = enabledView.getByRole('button', { name: S.groupTens });
    expect((enabled as HTMLButtonElement).disabled).toBe(false);
  });

  it('targetSize 64에서도 같은 조작 단추를 보여 준다', () => {
    const config: BaseTenConfig = { mode: 'count' };
    const state = createInitialState(config);
    const view = renderView(config, state, () => {}, 64);
    expect(view.container.querySelector('[data-target-size="64"]')).not.toBeNull();
  });

  it('읽기 전용에서는 블록을 움직이지 않는다', () => {
    const config: BaseTenConfig = { mode: 'count', start: { ones: 2 } };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch, 48, true);
    const block = view.container.querySelector<SVGGElement>('[data-block-value="1"]');
    expect(block?.getAttribute('tabindex')).toBe('-1');
    if (block) fireEvent.keyDown(block, { key: 'Enter' });
    expect(onDispatch).not.toHaveBeenCalled();
  });
});

describe('E01 자릿값 표', () => {
  it('chartFill="auto"일 때만 칸에 개수를 보여 준다', () => {
    const config: BaseTenConfig = {
      mode: 'count',
      start: { tens: 1, ones: 2 },
      chart: ['tens', 'ones'],
      chartFill: 'auto',
    };
    const state = createInitialState(config);
    const view = renderView(config, state);
    const cells = view.container.querySelectorAll('[data-chart-column]');
    expect(cells).toHaveLength(2);
    expect(cells[0]?.textContent).toBe('1');
    expect(cells[1]?.textContent).toBe('2');
  });

  it('student 표는 빈칸으로 시작하고 키패드로 숫자를 넣는다', () => {
    const config: BaseTenConfig = {
      mode: 'count',
      chart: ['tens', 'ones'],
      chartFill: 'student',
    };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);
    const cell = view.container.querySelector<HTMLButtonElement>('[data-chart-column="1"]');
    if (!cell) throw new Error('칸이 없다');
    expect(cell.textContent).toBe('–');

    fireEvent.click(cell);
    const key = view.getByLabelText(S.chartDigit(4));
    fireEvent.click(key);
    expect(onDispatch).toHaveBeenCalledWith({ type: 'set-digit', column: 1, digit: 4 });
  });
});

describe('E01 decimal 화면', () => {
  it('판·막대·낱개 이름을 소수로 읽고 나타내는 수는 쓰지 않는다', () => {
    const config: BaseTenConfig = { mode: 'decimal', start: { value: '6.24' } };
    const state = createInitialState(config);
    const view = renderView(config, state);
    const text = view.container.textContent ?? '';

    expect(text).not.toContain('6.24');
    expect(view.getByLabelText(S.addBlockFor(100, 'decimal'))).toBeTruthy();
    expect(view.getByLabelText(S.addBlockFor(10, 'decimal'))).toBeTruthy();
    expect(view.container.querySelector('[data-block-value="1"]')?.getAttribute('aria-label')).toBe(
      S.blockLabelFor(1, 'decimal'),
    );
  });

  it('풀기 단추와 블록이 소수 해석으로 동작한다', () => {
    const config: BaseTenConfig = { mode: 'decimal', start: { value: '1.2' } };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);
    const block = view.container.querySelector<SVGGElement>('[data-block-value="10"]');
    if (!block) throw new Error('막대가 없습니다.');
    const id = block.getAttribute('data-block-id');
    fireEvent.keyDown(block, { key: 'Enter' });
    expect(onDispatch).toHaveBeenCalledWith({ type: 'break', id });
  });
});

describe('E01 big-number 화면', () => {
  it('숫자 띠를 그리고 자르는 틈을 키보드로 누를 수 있다', () => {
    const config: BaseTenConfig = { mode: 'big-number', value: '52840000' };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);

    expect(view.getByRole('group', { name: S.bigNumberCanvasLabel })).toBeTruthy();
    const gap = view.container.querySelector<SVGGElement>('[data-cut-position="4"]');
    expect(gap).not.toBeNull();
    expect(gap?.getAttribute('role')).toBe('button');
    expect(gap?.getAttribute('tabindex')).toBe('0');
    if (gap) fireEvent.keyDown(gap, { key: 'Enter' });
    expect(onDispatch).toHaveBeenCalledWith({ type: 'cut', position: 4 });
  });

  it('펼치기 전에는 만·억 이름을 쓰지 않는다', () => {
    const config: BaseTenConfig = { mode: 'big-number', value: '52840000' };
    const state = createInitialState(config);
    const text = textOf(config, state);
    expect(text).not.toContain('만');
    expect(text).not.toContain('억');
  });

  it('reverse는 들은 수(spoken)를 화면에 쓰지 않는다', () => {
    const config: BaseTenConfig = {
      mode: 'big-number',
      reverse: { spoken: '이천삼십만 오' },
    };
    const state = createInitialState(config);
    const view = renderView(config, state);
    const text = view.container.textContent ?? '';
    expect(text).not.toContain('이천');
    expect(text).not.toContain('삼십');
    expect(text).not.toContain('이천삼십만 오');
    expect(view.getAllByLabelText(S.reverseCanvasLabel).length).toBeGreaterThan(0);
  });
});

describe('E01 divide 화면', () => {
  it('접시를 그리고 몫·나머지 숫자는 쓰지 않는다', () => {
    const config: BaseTenConfig = { mode: 'divide', dividend: 52, divisor: 4 };
    const state = createInitialState(config);
    const view = renderView(config, state);
    const text = view.container.textContent ?? '';

    expect(text).not.toContain('13');
    expect(text).not.toContain('52');
    expect(view.container.querySelector('[data-testid="divide-plates"]')).not.toBeNull();
    expect(view.getByRole('button', { name: S.dealRound(S.blockName[10]) })).toBeTruthy();
    expect(view.queryByRole('button', { name: S.rewind })).toBeNull();
  });

  it('rewindCheck일 때만 되감기 단추를 보여 준다', () => {
    const config: BaseTenConfig = {
      mode: 'divide',
      dividend: 52,
      divisor: 4,
      rewindCheck: true,
    };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);

    fireEvent.click(view.getByRole('button', { name: S.rewind }));
    expect(onDispatch).toHaveBeenCalledWith({ type: 'rewind' });
  });

  it('블록에 접시 번호를 붙여 끌어 놓은 곳을 읽을 수 있다', () => {
    const config: BaseTenConfig = { mode: 'divide', dividend: 52, divisor: 4 };
    const state = reduce(createInitialState(config), { type: 'deal-round', value: 10 });
    const view = renderView(config, state);
    const plated = view.container.querySelectorAll('[data-block-plate="0"]');
    expect(plated.length).toBeGreaterThan(0);
    expect(view.container.querySelectorAll('[data-block-plate="pile"]').length).toBeGreaterThan(0);
  });
});
