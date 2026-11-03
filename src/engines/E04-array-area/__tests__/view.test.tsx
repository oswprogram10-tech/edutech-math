/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import { arrayAreaStrings as S } from '../strings.ko';
import type { ArrayAreaAction, ArrayAreaConfig, ArrayAreaState } from '../types';
import { ArrayAreaView } from '../View';

afterEach(cleanup);

function renderView(
  config: ArrayAreaConfig,
  state: ArrayAreaState,
  onDispatch: (action: ArrayAreaAction) => void = () => {},
  targetSize: 48 | 64 = 48,
  readOnly = false,
) {
  return render(
    <ArrayAreaView
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

function textOf(config: ArrayAreaConfig, state: ArrayAreaState): string {
  return renderView(config, state).container.textContent ?? '';
}

describe('E04 기본 설정은 전체 곱을 화면에 쓰지 않는다', () => {
  it('3×4 배열에서 "12"가 DOM에 없다', () => {
    const config: ArrayAreaConfig = { mode: 'dot-array', rows: 3, cols: 4 };
    const state = createInitialState(config);
    const text = textOf(config, state);
    expect(text).not.toContain('12');
    expect(text).not.toContain('3×4');
    expect(text).not.toContain('4×3');
  });

  it('7×8 배열을 나누기 전에는 부분곱도 전체 곱도 없다', () => {
    const config: ArrayAreaConfig = { mode: 'split', rows: 7, cols: 8 };
    const state = createInitialState(config);
    const text = textOf(config, state);
    expect(text).not.toContain('56');
    expect(text).not.toContain('35');
    expect(text).not.toContain('21');
  });

  it('나눈 뒤에도 전체 곱 56은 없고 부분곱 35·21만 보인다', () => {
    const config: ArrayAreaConfig = { mode: 'split', rows: 7, cols: 8 };
    const state = reduce(createInitialState(config), {
      type: 'place-split',
      orientation: 'cols',
      at: 5,
    });
    const text = textOf(config, state);
    expect(text).not.toContain('56');
    expect(text).toContain('35');
    expect(text).toContain('21');
    expect(text).toContain('7×5');
    expect(text).toContain('7×3');
  });

  it('23×4 area-model은 변의 길이만 쓰고 곱 92는 쓰지 않는다', () => {
    const config: ArrayAreaConfig = { mode: 'area-model', a: 23, b: 4 };
    const state = createInitialState(config);
    const text = textOf(config, state);
    expect(text).toContain('23');
    expect(text).toContain('4');
    expect(text).not.toContain('92');
  });

  it('times-table 빈칸은 값을 그리지 않는다', () => {
    const config: ArrayAreaConfig = { mode: 'times-table' };
    const state = createInitialState(config);
    const view = renderView(config, state);
    const blank = view.container.querySelector<SVGGElement>('[data-cell="9,9"]');
    expect(blank).not.toBeNull();
    expect(blank?.textContent ?? '').toBe('');

    const withValue = reduce(state, { type: 'set-cell', r: 9, c: 9, value: 81 });
    const filled = renderView(config, withValue);
    expect(filled.container.querySelector('[data-cell="9,9"]')?.textContent).toBe('81');
  });

  it('factHide로 가린 곱은 "?"로만 보인다', () => {
    const config: ArrayAreaConfig = {
      mode: 'dot-array',
      rows: 3,
      cols: 4,
      factFamily: true,
      factHide: 'product',
    };
    const state = createInitialState(config);
    const text = textOf(config, state);
    expect(text).toContain('?');
    expect(text).not.toContain('12');
  });
});

describe('E04 View 조작', () => {
  it('줄·칸 −/+ 단추가 resize Action을 보낸다', () => {
    const config: ArrayAreaConfig = { mode: 'dot-array', rows: 3, cols: 4 };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);

    fireEvent.click(view.getByLabelText(S.addRow));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'resize', rows: 4, cols: 4 });
    fireEvent.click(view.getByLabelText(S.removeCol));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'resize', rows: 3, cols: 3 });
  });

  it('손잡이는 방향키로 행·열을 한 칸씩 바꾼다', () => {
    const config: ArrayAreaConfig = { mode: 'dot-array', rows: 3, cols: 4 };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);
    const handle = view.getByLabelText(S.handle);
    expect(handle.getAttribute('tabindex')).toBe('0');

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'resize', rows: 3, cols: 5 });
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'resize', rows: 2, cols: 4 });
  });

  it('split은 단추로 기본 위치에 분할선을 놓는다', () => {
    const config: ArrayAreaConfig = { mode: 'split', rows: 7, cols: 8 };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);

    fireEvent.click(view.getByText(S.addSplit('cols')));
    expect(onDispatch).toHaveBeenCalledWith({ type: 'place-split', orientation: 'cols', at: 4 });
  });

  it('분할선은 방향키로 옮기고 Delete로 지운다', () => {
    const config: ArrayAreaConfig = { mode: 'split', rows: 7, cols: 8 };
    const state = reduce(createInitialState(config), {
      type: 'place-split',
      orientation: 'cols',
      at: 5,
    });
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);
    const line = view.container.querySelector<SVGGElement>('[data-split-index="0"]');
    expect(line).not.toBeNull();
    if (!line) return;

    fireEvent.keyDown(line, { key: 'ArrowRight' });
    expect(onDispatch).toHaveBeenNthCalledWith(1, { type: 'remove-split', index: 0 });
    expect(onDispatch).toHaveBeenNthCalledWith(2, {
      type: 'place-split',
      orientation: 'cols',
      at: 6,
    });

    fireEvent.keyDown(line, { key: 'Delete' });
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'remove-split', index: 0 });
  });

  it('area-model 분할선은 방향키로 옮긴다', () => {
    const config: ArrayAreaConfig = { mode: 'area-model', a: 23, b: 4 };
    const state = reduce(createInitialState(config), {
      type: 'set-area-split',
      side: 'a',
      at: 20,
    });
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);
    const line = view.getByLabelText(S.areaSplitLine('a', 20));

    fireEvent.keyDown(line, { key: 'ArrowLeft' });
    expect(onDispatch).toHaveBeenNthCalledWith(1, {
      type: 'remove-area-split',
      side: 'a',
      at: 20,
    });
    expect(onDispatch).toHaveBeenNthCalledWith(2, { type: 'set-area-split', side: 'a', at: 19 });
  });

  it('times-table 칸은 키패드로 두 자리 값을 쓴다', () => {
    const config: ArrayAreaConfig = { mode: 'times-table' };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);

    fireEvent.click(view.container.querySelector('[data-cell="3,4"]') as Element);
    expect(view.getByRole('group', { name: S.tableKeypad })).toBeTruthy();
    fireEvent.click(view.getByLabelText(S.tableDigit(1)));
    fireEvent.click(view.getByLabelText(S.tableDigit(2)));
    fireEvent.click(view.getByText(S.tableConfirm));
    expect(onDispatch).toHaveBeenCalledWith({ type: 'set-cell', r: 3, c: 4, value: 12 });
  });

  it('times-table 칸에서 숫자 키를 바로 눌러도 입력이 시작된다', () => {
    const config: ArrayAreaConfig = { mode: 'times-table' };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);
    const cell = view.container.querySelector<SVGGElement>('[data-cell="2,3"]');
    if (!cell) throw new Error('칸이 없다');

    fireEvent.keyDown(cell, { key: '7' });
    fireEvent.click(view.getByText(S.tableConfirm));
    expect(onDispatch).toHaveBeenCalledWith({ type: 'set-cell', r: 2, c: 3, value: 7 });
  });

  it('times-table 칸은 Enter로 입력을 열고 방향키로 옮겨 다닌다', () => {
    const config: ArrayAreaConfig = { mode: 'times-table' };
    const state = createInitialState(config);
    const view = renderView(config, state);
    const cell = view.container.querySelector<SVGGElement>('[data-cell="2,2"]');
    if (!cell) throw new Error('칸이 없다');

    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(view.getByRole('group', { name: S.tableKeypad })).toBeTruthy();
    fireEvent.click(view.getByText(S.tableClose));

    const neighbour = view.container.querySelector<SVGGElement>('[data-cell="2,3"]');
    expect(neighbour).not.toBeNull();
    fireEvent.keyDown(cell, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(neighbour);
  });
});

describe('E04 View 접근성', () => {
  it('캔버스에 이름이 있고 조작 단추에 이름이 있다', () => {
    const config: ArrayAreaConfig = { mode: 'dot-array', rows: 3, cols: 4 };
    const state = createInitialState(config);
    const view = renderView(config, state);
    expect(view.getByRole('group', { name: S.canvasLabel })).toBeTruthy();
    expect(view.getByLabelText(S.handle)).toBeTruthy();
    expect(view.getByLabelText(S.addRow)).toBeTruthy();
    expect(view.getByText(S.recordArrangement)).toBeTruthy();
  });

  it('targetSize 64에서도 같은 조작 단추를 보여 준다', () => {
    const config: ArrayAreaConfig = { mode: 'dot-array' };
    const state = createInitialState(config);
    const view = renderView(config, state, () => {}, 64);
    expect(view.container.querySelector('[data-target-size="64"]')).not.toBeNull();
  });

  it('읽기 전용에서는 조작을 보내지 않는다', () => {
    const config: ArrayAreaConfig = { mode: 'dot-array', rows: 3, cols: 4 };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch, 48, true);

    const handle = view.getByLabelText(S.handle);
    expect(handle.getAttribute('tabindex')).toBe('-1');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.click(view.getByLabelText(S.addRow));
    expect(onDispatch).not.toHaveBeenCalled();
  });
});
