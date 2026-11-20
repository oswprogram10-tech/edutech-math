/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoundaryRiderOverlay } from '../overlays/boundary-rider';
import { LeftBehindOverlay } from '../overlays/left-behind';
import { createInitialState, reduce } from '../reduce';
import { numberLineStrings } from '../strings.ko';
import type { NumberLineAction, NumberLineConfig, NumberLineState } from '../types';
import { NumberLineView } from '../View';

afterEach(cleanup);

const FORBIDDEN = ['이상', '이하', '초과', '미만'];
const RIDERS = [118, 125, 129, 130, 131, 140, 145, 150, 151, 155];
const RANGE: NumberLineConfig = {
  mode: 'range',
  min: 100,
  max: 160,
  unit: 1,
  subdivisions: 10,
  story: 'rollercoaster',
  riders: RIDERS,
};

function renderView(
  config: NumberLineConfig,
  state: NumberLineState,
  onDispatch: (action: NumberLineAction) => void = () => {},
) {
  return render(
    <NumberLineView
      config={config}
      state={state}
      dispatch={onDispatch}
      cpa="P"
      mode={state.mode}
      targetSize={48}
    />,
  );
}

function run(state: NumberLineState, ...actions: NumberLineAction[]): NumberLineState {
  return actions.reduce((current, action) => reduce(current, action), state);
}

describe('T219 range 화면', () => {
  it('시작 화면과 조작을 한 뒤에도 이상·이하·초과·미만 글이 없다', () => {
    const initial = createInitialState(RANGE);
    const states = [
      initial,
      run(initial, { type: 'place-bound', value: '130' }),
      run(
        initial,
        { type: 'place-bound', value: '130' },
        { type: 'toggle-closed', index: 0 },
        { type: 'set-direction', dir: 'right' },
      ),
      run(
        initial,
        { type: 'place-bound', value: '130' },
        { type: 'toggle-closed', index: 0 },
        { type: 'set-direction', dir: 'right' },
        { type: 'open-gate' },
      ),
    ];
    for (const state of states) {
      const view = renderView(RANGE, state);
      const text = view.container.textContent ?? '';
      const labels = [...view.container.querySelectorAll('[aria-label]')]
        .map((node) => node.getAttribute('aria-label') ?? '')
        .join(' ');
      for (const word of FORBIDDEN) {
        expect(text).not.toContain(word);
        expect(labels).not.toContain(word);
      }
      cleanup();
    }
  });

  it('캐릭터에 키 글이 붙고 story none이면 게이트·캐릭터를 그리지 않는다', () => {
    const view = renderView(RANGE, createInitialState(RANGE));
    expect(view.container.querySelectorAll('[data-testid^="range-rider-"]')).toHaveLength(10);
    expect(view.container.textContent ?? '').toContain('130cm');
    expect(view.queryByText(numberLineStrings.range.openGate)).not.toBeNull();
    cleanup();

    const none: NumberLineConfig = { ...RANGE, story: 'none' };
    const plain = renderView(none, createInitialState(none));
    expect(plain.container.querySelector('[data-testid="range-story"]')).toBeNull();
    expect(plain.container.querySelector('[data-testid="range-gate"]')).toBeNull();
    expect(plain.queryByText(numberLineStrings.range.openGate)).toBeNull();
  });

  it('단추가 Action을 보낸다', () => {
    const onDispatch = vi.fn();
    const state = run(createInitialState(RANGE), { type: 'place-bound', value: '130' });
    const view = renderView(RANGE, state, onDispatch);
    fireEvent.click(view.getByText(numberLineStrings.range.toRight));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'set-direction', dir: 'right' });
    fireEvent.click(view.getByText(numberLineStrings.range.toLeft));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'set-direction', dir: 'left' });
    fireEvent.click(view.getByText(numberLineStrings.range.toggleShort));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'toggle-closed', index: 0 });
    fireEvent.click(view.getByText(numberLineStrings.range.removeOne));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'remove-bound' });
    fireEvent.click(view.getByText(numberLineStrings.range.resetAll));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'reset' });
  });

  it('방향을 정하기 전에는 [게이트 열기]가 막혀 있고, 정하면 Action을 보낸다', () => {
    const onDispatch = vi.fn();
    const point = run(createInitialState(RANGE), { type: 'place-bound', value: '130' });
    const before = renderView(RANGE, point, onDispatch);
    const button = before.getByText(numberLineStrings.range.openGate) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    cleanup();

    const ready = run(point, { type: 'set-direction', dir: 'right' });
    const after = renderView(RANGE, ready, onDispatch);
    fireEvent.click(after.getByText(numberLineStrings.range.openGate));
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'open-gate' });
  });

  it('키보드: ←→로 커서를 옮기고 Enter로 놓고 Space로 속 찬/빈을 바꾼다', () => {
    const onDispatch = vi.fn();
    const state = createInitialState(RANGE);
    const view = renderView(RANGE, state, onDispatch);
    const canvas = view.container.querySelector('[data-testid="number-line-canvas"]');
    if (!canvas) throw new Error('캔버스가 없습니다.');
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    fireEvent.keyDown(canvas, { key: 'Enter' });
    expect(onDispatch).toHaveBeenLastCalledWith({ type: 'place-bound', value: '102' });
  });

  it('readOnly면 조작 단추가 모두 막힌다', () => {
    const config: NumberLineConfig = {
      ...RANGE,
      readOnly: true,
      preset: { lower: { value: 130, closed: true } },
    };
    const view = renderView(config, createInitialState(config));
    const toggle = view.getByText(numberLineStrings.range.toggleShort) as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    const open = view.getByText(numberLineStrings.range.openGate) as HTMLButtonElement;
    expect(open.disabled).toBe(false);
  });

  it('경계점은 속 찬/빈 동그라미를 data-closed로 보인다', () => {
    const state = run(
      createInitialState(RANGE),
      { type: 'place-bound', value: '130' },
      { type: 'toggle-closed', index: 0 },
    );
    const view = renderView(RANGE, state);
    const bound = view.container.querySelector('[data-testid="range-bound-0"]');
    expect(bound?.getAttribute('data-value')).toBe('130');
    expect(bound?.getAttribute('data-closed')).toBe('true');
  });
});

describe('T219 boundary-rider 오버레이', () => {
  const closedRight = (config: NumberLineConfig = RANGE) =>
    run(
      createInitialState(config),
      { type: 'place-bound', value: '130' },
      { type: 'toggle-closed', index: 0 },
      { type: 'set-direction', dir: 'right' },
    );

  it('경계값과 같은 키의 캐릭터만 그리고 지금 게이트로 통과를 보인다', () => {
    const view = render(<BoundaryRiderOverlay config={RANGE} state={closedRight()} />);
    const riders = view.container.querySelectorAll('[data-rider-height]');
    expect(riders).toHaveLength(1);
    expect(riders[0]?.getAttribute('data-rider-height')).toBe('130');
    expect(riders[0]?.getAttribute('data-result')).toBe('passed');
    expect(view.container.textContent ?? '').toContain('130cm');
    expect(view.container.textContent ?? '').not.toContain('129cm');
  });

  it('빈 동그라미로 바꾸면 같은 130 캐릭터가 막힌다', () => {
    const open = run(closedRight(), { type: 'toggle-closed', index: 0 });
    const view = render(<BoundaryRiderOverlay config={RANGE} state={open} />);
    expect(view.container.querySelector('[data-rider-height]')?.getAttribute('data-result')).toBe(
      'blocked',
    );
  });

  it('경계가 없거나 방향이 없거나 같은 키가 없으면 그리지 않는다', () => {
    expect(
      render(<BoundaryRiderOverlay config={RANGE} state={createInitialState(RANGE)} />).container
        .innerHTML,
    ).toBe('');
    cleanup();
    const noDirection = run(createInitialState(RANGE), { type: 'place-bound', value: '130' });
    expect(
      render(<BoundaryRiderOverlay config={RANGE} state={noDirection} />).container.innerHTML,
    ).toBe('');
    cleanup();
    const noRider = run(
      createInitialState({ ...RANGE, riders: [118, 125, 131] }),
      { type: 'place-bound', value: '130' },
      { type: 'set-direction', dir: 'right' },
    );
    expect(
      render(<BoundaryRiderOverlay config={RANGE} state={noRider} />).container.innerHTML,
    ).toBe('');
  });
});

describe('T219 rounding 상황 장면 화면', () => {
  const bus: NumberLineConfig = { mode: 'rounding', value: 243, place: 10, scenario: 'bus-seats' };
  const candy: NumberLineConfig = {
    mode: 'rounding',
    value: 243,
    place: 10,
    scenario: 'candy-bags',
  };

  const scene = (config: NumberLineConfig, method: 'up' | 'down' | 'half-up') => {
    const state = reduce(createInitialState(config), { type: 'round', item: 0, method });
    const view = renderView(config, state);
    return view.container.querySelector('[data-testid="rounding-scene"]');
  };

  it('방법을 고르기 전에는 장면이 없다', () => {
    const view = renderView(bus, createInitialState(bus));
    expect(view.container.querySelector('[data-testid="rounding-scene"]')).toBeNull();
  });

  it('버스 올림: 모두 탔어요 + 빈 자리가 보인다', () => {
    const node = scene(bus, 'up');
    expect(node?.getAttribute('data-consequence')).toBe('all-seated');
    expect(node?.textContent).toContain(numberLineStrings.rounding.scene.allSeated);
    expect(node?.querySelectorAll('[data-slot="filled"]')).toHaveLength(3);
    expect(node?.querySelectorAll('[data-slot="empty"]')).toHaveLength(7);
    expect(node?.querySelector('[data-testid="scene-stop"]')).toBeNull();
  });

  it('버스 버림: 못 탄 친구 3명이 정류장에 있다', () => {
    const node = scene(bus, 'down');
    expect(node?.getAttribute('data-consequence')).toBe('left-behind');
    expect(node?.textContent).toContain(numberLineStrings.rounding.scene.leftBehind);
    expect(node?.querySelectorAll('[data-testid="scene-student"]')).toHaveLength(3);
  });

  it('사탕: 버림은 남은 사탕, 올림은 덜 찬 봉지', () => {
    const down = scene(candy, 'down');
    expect(down?.getAttribute('data-consequence')).toBe('leftover');
    expect(
      down?.querySelector('[data-testid="scene-leftover"]')?.getAttribute('data-count-drawn'),
    ).toBe('3');
    cleanup();
    const up = scene(candy, 'up');
    expect(up?.getAttribute('data-consequence')).toBe('partial-bag');
    expect(up?.textContent).toContain(numberLineStrings.rounding.scene.partialBag);
  });

  it('나머지가 0이면 딱 맞아요', () => {
    const node = scene({ ...bus, value: 240 }, 'down');
    expect(node?.getAttribute('data-consequence')).toBe('exact');
    expect(node?.textContent).toContain(numberLineStrings.rounding.scene.exact);
  });

  it('장면 글에 숫자(전체 버스·봉지 수)가 없고 어느 방법이 맞는지 쓰지 않는다', () => {
    for (const config of [bus, candy]) {
      for (const method of ['up', 'down', 'half-up'] as const) {
        const node = scene(config, method);
        const text = node?.textContent ?? '';
        expect(text).not.toMatch(/\d/);
        expect(text).not.toContain('정답');
        expect(text).not.toContain('맞');
        cleanup();
      }
    }
  });

  it('height와 showConsequence false는 장면이 없다', () => {
    expect(scene({ ...bus, scenario: 'height' }, 'up')).toBeNull();
    cleanup();
    expect(scene({ ...bus, showConsequence: false }, 'up')).toBeNull();
  });

  it('힌트 left-behind: 방법과 상관없이 단독으로 보인다', () => {
    const state = reduce(createInitialState(bus), { type: 'round', item: 0, method: 'up' });
    const view = render(<LeftBehindOverlay config={bus} state={state} />);
    expect(view.container.querySelectorAll('[data-testid="scene-student"]')).toHaveLength(3);
    expect(view.container.textContent ?? '').not.toMatch(/\d/);
    cleanup();
    const bag = render(<LeftBehindOverlay config={candy} state={createInitialState(candy)} />);
    expect(bag.container.querySelector('[data-testid="scene-bag"]')).not.toBeNull();
    expect(bag.container.querySelectorAll('[data-slot="filled"]')).toHaveLength(3);
    cleanup();
    const exact = render(
      <LeftBehindOverlay config={bus} state={createInitialState({ ...bus, value: 240 })} />,
    );
    expect(exact.container.innerHTML).toBe('');
    cleanup();
    const other = createInitialState({ mode: 'rounding', value: 243, place: 10 });
    expect(
      render(<LeftBehindOverlay config={{ mode: 'rounding' }} state={other} />).container.innerHTML,
    ).toBe('');
  });
});
