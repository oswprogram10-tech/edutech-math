/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import { numberLineStrings } from '../strings.ko';
import { HopNumbersOverlay } from '../overlays/hop-numbers';
import type { NumberLineAction, NumberLineConfig, NumberLineState } from '../types';
import { NumberLineView } from '../View';

afterEach(cleanup);

function renderView(
  config: NumberLineConfig,
  state: NumberLineState,
  onDispatch: (action: NumberLineAction) => void = () => {},
  targetSize: 48 | 64 = 48,
) {
  return render(
    <NumberLineView
      config={config}
      state={state}
      dispatch={onDispatch}
      cpa="P"
      mode={state.mode}
      targetSize={targetSize}
    />,
  );
}

function canvasOf(view: ReturnType<typeof renderView>): SVGSVGElement {
  const canvas = view.container.querySelector<SVGSVGElement>('[data-testid="number-line-canvas"]');
  if (!canvas) throw new Error('수직선 캔버스가 없습니다.');
  return canvas;
}

describe('T048 skip-count 화면', () => {
  it('기본 설정에서는 뛴 횟수 숫자를 쓰지 않는다', () => {
    const config: NumberLineConfig = { mode: 'skip-count', min: 0, max: 30 };
    const state = createInitialState(config);
    const view = renderView(config, state);
    expect(view.queryByTestId('skip-hop-count')).toBeNull();
    expect(view.container.textContent ?? '').not.toContain('번 뛰었어요');
    expect(view.getByText(numberLineStrings.skip.stepChoice('2'))).toBeTruthy();
    expect(view.getByText(numberLineStrings.skip.hop)).toBeTruthy();
  });

  it('단추와 키보드 J로 뛴다', () => {
    const config: NumberLineConfig = { mode: 'skip-count', min: 0, max: 30 };
    let state = createInitialState(config);
    state = reduce(state, { type: 'choose-step', row: 0, step: '5' });
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);

    fireEvent.click(view.getByText(numberLineStrings.skip.stepChoice('5')));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'choose-step', row: 0, step: '5' });

    fireEvent.click(view.getByText(numberLineStrings.skip.hop));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'hop', row: 0 });

    fireEvent.keyDown(canvasOf(view), { key: 'j' });
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'hop', row: 0 });
  });

  it('showHopCount일 때만 뛴 횟수를 쓴다', () => {
    const config: NumberLineConfig = {
      mode: 'skip-count',
      min: 0,
      max: 30,
      showHopCount: true,
    };
    let state = createInitialState(config);
    state = reduce(state, { type: 'choose-step', row: 0, step: '5' });
    state = reduce(state, { type: 'hop', row: 0 });
    const view = renderView(config, state);
    expect(view.getByTestId('skip-hop-count').textContent).toContain('1');
  });

  it('호 폭이 28px보다 좁으면 step 라벨을 그리지 않는다', () => {
    const wideConfig: NumberLineConfig = { mode: 'skip-count', min: 0, max: 30, step: 5 };
    let wide = createInitialState(wideConfig);
    wide = reduce(wide, { type: 'hop', row: 0 });
    const wideView = renderView(wideConfig, wide);
    expect(wideView.queryByTestId('skip-hop-step-label')).not.toBeNull();
    wideView.unmount();

    const narrowConfig: NumberLineConfig = { mode: 'skip-count', min: 0, max: 1000, step: 1 };
    let narrow = createInitialState(narrowConfig);
    narrow = reduce(narrow, { type: 'hop', row: 0 });
    expect(renderView(narrowConfig, narrow).queryByTestId('skip-hop-step-label')).toBeNull();
  });

  it('되돌리기 단추 이름은 "한 번 되돌리기"다', () => {
    const config: NumberLineConfig = { mode: 'skip-count', min: 0, max: 30, step: 5 };
    const view = renderView(config, createInitialState(config));
    expect(view.getByText('한 번 되돌리기')).toBeTruthy();
  });
});

describe('T048 rounding 화면', () => {
  it('결과 값을 따로 글자로 쓰지 않는다', () => {
    const config: NumberLineConfig = { mode: 'rounding', value: 243, place: 10 };
    const state = reduce(createInitialState(config), {
      type: 'round',
      item: 0,
      method: 'up',
    });
    const view = renderView(config, state);
    expect(view.queryByTestId('rounding-result')).toBeNull();
    const marker = view.getByTestId('rounding-marker-0');
    expect(marker.getAttribute('data-marker')).toBe('250');
    expect(marker.textContent ?? '').toBe('');
    // 원래 값은 문제에 주어진 수라 보여도 된다.
    expect(view.container.textContent ?? '').toContain('243');
  });

  it('올림·버림·반올림 단추가 round Action을 보낸다', () => {
    const config: NumberLineConfig = { mode: 'rounding', value: 243, place: 10 };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);

    fireEvent.click(view.getByText(numberLineStrings.rounding.method('up')));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'round', item: 0, method: 'up' });
    fireEvent.click(view.getByText(numberLineStrings.rounding.method('down')));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'round', item: 0, method: 'down' });
    fireEvent.click(view.getByText(numberLineStrings.rounding.method('half-up')));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'round', item: 0, method: 'half-up' });
  });

  it('drag 모드에서 marker가 없으면 방향키가 올림·버림 눈금으로 바로 놓는다', () => {
    const config: NumberLineConfig = {
      mode: 'rounding',
      value: 243,
      place: 10,
      controls: 'drag',
    };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);
    expect(view.queryByText(numberLineStrings.rounding.method('up'))).toBeNull();

    fireEvent.keyDown(canvasOf(view), { key: 'ArrowRight' });
    expect(onDispatch).toHaveBeenLastCalledWith({
      type: 'move-marker',
      item: 0,
      value: '250',
    });
    fireEvent.keyDown(canvasOf(view), { key: 'ArrowLeft' });
    expect(onDispatch).toHaveBeenLastCalledWith({
      type: 'move-marker',
      item: 0,
      value: '240',
    });
  });

  it('marker가 없을 때 ▶는 400, ◀는 300으로 놓는다', () => {
    const config: NumberLineConfig = {
      mode: 'rounding',
      value: 389,
      place: 100,
      controls: 'drag',
    };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);

    fireEvent.click(view.getByLabelText(numberLineStrings.rounding.moveRight));
    expect(onDispatch).toHaveBeenLastCalledWith({
      type: 'move-marker',
      item: 0,
      value: '400',
    });
    fireEvent.click(view.getByLabelText(numberLineStrings.rounding.moveLeft));
    expect(onDispatch).toHaveBeenLastCalledWith({
      type: 'move-marker',
      item: 0,
      value: '300',
    });
  });
});

describe('T048 log-zoom 화면', () => {
  it('카드의 정답 위치를 미리 찍어 두지 않는다', () => {
    const config: NumberLineConfig = {
      mode: 'log-zoom',
      levels: [10, 100, 1000, 10000],
      cards: [500, 1000, 2500, 9000],
    };
    const state = createInitialState(config);
    const view = renderView(config, state);
    const canvas = canvasOf(view);
    expect(canvas.getAttribute('data-mode')).toBe('log-zoom');
    expect(canvas.querySelector('[data-card-value="2500"]')).toBeNull();
    expect(canvas.querySelector('[data-point-id]')).toBeNull();
    expect(view.getByTestId('log-card-2500')).toBeTruthy();
  });

  it('호 폭이 28px보다 좁으면 step 라벨을 그리지 않는다', () => {
    const wideConfig: NumberLineConfig = {
      mode: 'log-zoom',
      levels: [10],
      start: '0',
      step: '1',
    };
    let wide = createInitialState(wideConfig);
    wide = reduce(wide, { type: 'hop', row: 0 });
    const wideView = renderView(wideConfig, wide);
    expect(wideView.queryByTestId('log-hop-step-label')).not.toBeNull();
    wideView.unmount();

    const narrowConfig: NumberLineConfig = {
      mode: 'log-zoom',
      levels: [1000],
      start: '0',
      step: '1',
    };
    let narrow = createInitialState(narrowConfig);
    narrow = reduce(narrow, { type: 'hop', row: 0 });
    expect(renderView(narrowConfig, narrow).queryByTestId('log-hop-step-label')).toBeNull();
  });

  it('− 단추와 키보드 −가 단계를 넓힌다', () => {
    const config: NumberLineConfig = { mode: 'log-zoom' };
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);

    fireEvent.click(view.getByLabelText(numberLineStrings.logZoom.zoomOutLabel));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'log-zoom', level: 1 });
    fireEvent.keyDown(canvasOf(view), { key: '-' });
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'log-zoom', level: 1 });
  });

  it('이전 단계가 있으면 이전 구간 띠를 보여 준다', () => {
    const config: NumberLineConfig = { mode: 'log-zoom' };
    const state = reduce(createInitialState(config), { type: 'log-zoom', level: 2 });
    const view = renderView(config, state);
    expect(view.getByTestId('log-prev-band')).toBeTruthy();
  });
});

describe('T048 double 화면', () => {
  const config: NumberLineConfig = {
    mode: 'double',
    top: { label: '양', max: '3/4' },
    anchors: [['2/3', '1']],
    divisors: [2, 3],
    multipliers: [2, 3],
  };

  function scaled(): NumberLineState {
    let state = createInitialState(config);
    state = reduce(state, { type: 'scale-pair', kind: 'divide', factor: 2 });
    state = reduce(state, { type: 'scale-pair', kind: 'multiply', factor: 3 });
    return state;
  }

  it('새 쌍의 기본 라벨은 값이 아니라 만든 식이다', () => {
    const state = scaled();
    const view = renderView(config, state);
    expect(view.getByTestId('pair-label-top-1').textContent).toBe('2/3 ÷ 2');
    expect(view.getByTestId('pair-label-bottom-1').textContent).toBe('1 ÷ 2');
    expect(view.getByTestId('pair-label-top-2').textContent).toBe('2/3 ÷ 2 × 3');
    expect(view.getByTestId('pair-label-bottom-2').textContent).toBe('1 ÷ 2 × 3');
    expect(view.getByTestId('pair-label-top-2').textContent).not.toBe('1');
  });

  it('기본 설정에서는 눈금 숫자를 0과 anchor 값에만 쓰고 새 쌍의 값을 쓰지 않는다', () => {
    const state = scaled();
    const view = renderView(config, state);
    const text = view.container.textContent ?? '';
    expect(text).not.toContain('1/3');
    expect(text).not.toContain('1/2');
    expect(text).not.toContain('1 1/2');
    expect(text).not.toContain('3/2');
    // 0과 anchor(2/3, 1)은 눈금 숫자로 읽을 수 있다.
    expect(text).toContain('2/3');
  });

  it('values 라벨은 교사 시연용으로만 값를 쓴다', () => {
    const valueConfig: NumberLineConfig = { ...config, labels: 'values' };
    let state = createInitialState(valueConfig);
    state = reduce(state, { type: 'scale-pair', kind: 'divide', factor: 2 });
    state = reduce(state, { type: 'scale-pair', kind: 'multiply', factor: 3 });
    const view = renderView(valueConfig, state);
    expect(view.getByTestId('pair-label-top-2').textContent).toBe('1');
    expect(view.getByTestId('pair-label-bottom-2').textContent).toBe('3/2');
  });

  it('÷·× 단추가 scale-pair Action을 보낸다', () => {
    const state = createInitialState(config);
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);

    fireEvent.click(view.getByText(numberLineStrings.double.op('divide', 2)));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'scale-pair', kind: 'divide', factor: 2 });
    fireEvent.click(view.getByText(numberLineStrings.double.op('multiply', 3)));
    expect(onDispatch).toHaveBeenLastCalledWith({
      type: 'scale-pair',
      kind: 'multiply',
      factor: 3,
    });
  });

  it('누른 연산을 차례로 쌓아 보여 주고 합친 결과는 쓰지 않는다', () => {
    const view = renderView(config, scaled());
    const band = view.getByTestId('double-ops-band');
    expect(band.textContent).toContain('÷ 2');
    expect(band.textContent).toContain('× 3');
    expect(band.textContent ?? '').not.toContain('3/2');
  });
});

describe('T048 기존 모드 유지', () => {
  it('integer는 기존 화면을 그대로 쓴다', () => {
    const config: NumberLineConfig = { mode: 'integer', min: 0, max: 9 };
    const state = createInitialState(config);
    const view = renderView(config, state);
    expect(canvasOf(view).getAttribute('data-mode')).toBe('integer');
  });

  it('targetSize 64를 화면에 표시한다', () => {
    const config: NumberLineConfig = { mode: 'skip-count', min: 0, max: 30 };
    const state = createInitialState(config);
    const view = renderView(config, state, () => {}, 64);
    expect(view.container.querySelector('[data-target-size="64"]')).not.toBeNull();
  });
});

describe('T080 integer 개구리 화면', () => {
  const config: NumberLineConfig = {
    mode: 'integer',
    min: 0,
    max: 100,
    unit: 1,
    labels: 'partial',
    jumpButtons: [10, 1, -1, -10],
    jumpStart: 35,
  };

  function jumped(): NumberLineState {
    return ['10', '10', '1', '1', '1'].reduce(
      (state, size) => reduce(state, { type: 'frog-jump', size }),
      createInitialState(config),
    );
  }

  it('개구리 위치·도착 값을 글자·aria-label·title로 쓰지 않는다', () => {
    const view = renderView(config, jumped());
    const text = view.container.textContent ?? '';
    expect(text).not.toContain('58');
    for (const element of view.container.querySelectorAll('[aria-label], [title]')) {
      expect(element.getAttribute('aria-label') ?? '').not.toContain('58');
      expect(element.getAttribute('title') ?? '').not.toContain('58');
    }
    // 점프 기록 띠는 출발 값과 누른 크기만 쓴다.
    expect(view.getByTestId('frog-log').textContent).toBe('출발 35 → +10 → +10 → +1 → +1 → +1');
    expect(view.getByTestId('frog').getAttribute('aria-label')).toBe('개구리');
  });

  it('점프 버튼과 되돌리기·처음부터 버튼이 Action을 보낸다', () => {
    const state = jumped();
    const onDispatch = vi.fn();
    const view = renderView(config, state, onDispatch);

    expect(view.getByRole('button', { name: '+10' })).toBeTruthy();
    expect(view.getByRole('button', { name: '−1' })).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: '+10' }));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'frog-jump', size: '10' });
    fireEvent.click(view.getByRole('button', { name: numberLineStrings.frog.undo }));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'frog-undo' });
    fireEvent.click(view.getByRole('button', { name: numberLineStrings.frog.reset }));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'frog-reset' });
  });

  it('점프마다 호를 그리고 도착 값은 쓰지 않는다', () => {
    const view = renderView(config, jumped());
    const arcs = view.container.querySelectorAll('[data-testid="frog-jump-arc"]');
    expect(arcs).toHaveLength(5);
    expect(arcs[0]?.getAttribute('data-jump-size')).toBe('10');
    const path = arcs[0]?.querySelector('path');
    expect(path?.getAttribute('d')).toBeTruthy();
  });

  it('설정이 없으면 개구리와 버튼을 그리지 않는다', () => {
    const plainConfig: NumberLineConfig = { mode: 'integer', min: 0, max: 100 };
    const view = renderView(plainConfig, createInitialState(plainConfig));
    expect(view.queryByTestId('frog')).toBeNull();
    expect(view.queryByTestId('frog-controls')).toBeNull();
    expect(view.queryByRole('button', { name: '+10' })).toBeNull();
  });

  it('hop-numbers 오버레이는 점프마다 지나간 눈금 칸에 1~N을 그린다', () => {
    const state = ['1', '1', '1'].reduce(
      (current, size) => reduce(current, { type: 'frog-jump', size }),
      createInitialState(config),
    );
    const view = render(<HopNumbersOverlay config={config} state={state} />);
    const numbers = view.container.querySelectorAll('[data-hop-number]');
    expect(numbers).toHaveLength(3);
    // +1 점프 세 번은 점프마다 1번 칸부터 다시 센다.
    expect([...numbers].map((node) => node.getAttribute('data-hop-number'))).toEqual([
      '1',
      '1',
      '1',
    ]);
    expect(view.container.textContent ?? '').not.toContain('38');

    // +10 점프가 눈금 한 칸이면 호 하나, 눈금이 1이면 1~10까지 센다.
    const denseConfig: NumberLineConfig = { ...config, max: 20, jumpStart: 0 };
    const ten = render(
      <HopNumbersOverlay
        config={denseConfig}
        state={reduce(createInitialState(denseConfig), { type: 'frog-jump', size: '10' })}
      />,
    );
    expect(
      [...ten.container.querySelectorAll('[data-hop-number]')].map((node) =>
        node.getAttribute('data-hop-number'),
      ),
    ).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

    const plainConfig: NumberLineConfig = { mode: 'integer', min: 0, max: 100 };
    const empty = render(
      <HopNumbersOverlay config={plainConfig} state={createInitialState(plainConfig)} />,
    );
    expect(empty.container.querySelector('[data-hop-number]')).toBeNull();
  });
});
