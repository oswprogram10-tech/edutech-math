/** @vitest-environment jsdom */
/** E06 compare 화면 테스트: 무게 숫자가 DOM에 없고, 키보드·단추·결과 글·오버레이가 맞게 나온다. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCompareState, reduceCompare } from '../compare/reduce';
import type { CompareAction, CompareConfig, CompareState } from '../compare/types';
import { BigTiltOverlay } from '../overlays/big-tilt';
import { SizeVsWeightOverlay } from '../compare/overlays/size-vs-weight';
import { skipInCompare } from '../compare/overlays/guard';
import { BalanceView } from '../View';
import type { E06Config, E06State } from '../unions';
import type { OverlayProps } from '../../../core/engine-sdk';

afterEach(cleanup);

// 무게가 2·9·3이라 DOM에 낱개의 이 숫자가 나오면 안 된다. id·이름에는 숫자를 쓰지 않는다.
const CONFIG: CompareConfig = {
  mode: 'compare',
  items: [
    { id: 'sponge', kind: 'sponge', weight: 2, visualSize: 'large' },
    { id: 'iron', kind: 'iron-ball', weight: 9, visualSize: 'small' },
    { id: 'apple', kind: 'apple', weight: 3 },
  ],
};

function play(config: CompareConfig, actions: readonly CompareAction[]): CompareState {
  return actions.reduce<CompareState>(reduceCompare, createCompareState(config));
}

function renderState(state: CompareState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <BalanceView
      config={{ mode: 'compare' }}
      state={state}
      dispatch={dispatch}
      cpa="C"
      mode="compare"
      targetSize={48}
      readOnly={readOnly}
    />,
  );
}

function everything(container: HTMLElement): string {
  const parts: string[] = [container.textContent ?? ''];
  for (const element of container.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      // data-target-size는 조작 칸 크기(48·64px)라 무게와 무관하다.
      if (attribute.name === 'data-target-size') continue;
      if (attribute.name.startsWith('data-') || attribute.name.startsWith('aria-')) {
        parts.push(attribute.value);
      }
    }
  }
  return parts.join('\n');
}

const DIGITS = /\d/;

describe('compare 화면 무게 숫자 금지', () => {
  it('showValues false(기본): 시작 화면 DOM·aria·data-에 숫자가 없다', () => {
    const { container } = renderState(createCompareState(CONFIG));
    expect(everything(container)).not.toMatch(DIGITS);
  });

  it('showValues false: 접시에 올리고 기울어도(결과 글만) 숫자가 없다', () => {
    const state = play(CONFIG, [
      { type: 'place', id: 'apple', pan: 'left' },
      { type: 'place', id: 'iron', pan: 'right' },
    ]);
    const { container } = renderState(state);
    expect(everything(container)).not.toMatch(DIGITS);
    expect(screen.getByTestId('balance-result').textContent).toBe('오른쪽이 더 무거워요');
  });

  it('샌드박스 기본 설정도 마찬가지다', () => {
    const { container } = renderState(createCompareState({ mode: 'compare' }));
    expect(everything(container)).not.toMatch(DIGITS);
  });

  it('showValues true일 때만 물건 아래에 무게를 쓴다', () => {
    const { container } = renderState(createCompareState({ ...CONFIG, showValues: true }));
    const text = everything(container);
    expect(text).toContain('9');
    expect(text).toContain('스펀지 2');
  });
});

describe('compare 화면 조작', () => {
  it('선반의 물건은 이름·위치로 보이고 둘은 같은 모양이 아니다', () => {
    renderState(createCompareState(CONFIG));
    const items = screen.getAllByRole('button', { name: /선반에 있어요/ });
    expect(items).toHaveLength(3);
    expect(screen.getByTestId('balance-result').textContent).toBe('물건을 접시에 올려 보세요');
    expect(screen.getByTestId('compare-selected').textContent).toBe('물건을 먼저 골라 주세요');
  });

  it('물건에 초점이 가면 고르고, L·R·Backspace가 place Action을 보낸다', () => {
    const dispatch = vi.fn();
    const first = renderState(createCompareState(CONFIG), dispatch);
    const apple = screen.getByRole('button', { name: /사과/ });
    fireEvent.focus(apple);
    expect(screen.getByTestId('compare-selected').textContent).toBe('고른 물건: 사과');
    fireEvent.keyDown(apple, { key: 'l' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'place', id: 'apple', pan: 'left' });
    fireEvent.keyDown(apple, { key: 'R' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'place', id: 'apple', pan: 'right' });
    first.unmount();
    // 접시에 있는 물건에서 Backspace는 선반으로
    const state = play(CONFIG, [{ type: 'place', id: 'apple', pan: 'left' }]);
    renderState(state, dispatch);
    const onPan = screen.getByRole('button', { name: /사과.*왼쪽 접시/ });
    fireEvent.focus(onPan);
    fireEvent.keyDown(onPan, { key: 'Backspace' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'place', id: 'apple', pan: 'shelf' });
  });

  it('조작 칸 단추도 같은 일을 한다', () => {
    const dispatch = vi.fn();
    renderState(createCompareState(CONFIG), dispatch);
    expect((screen.getByTestId('compare-left') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.focus(screen.getByRole('button', { name: /쇠공/ }));
    fireEvent.click(screen.getByTestId('compare-right'));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'place', id: 'iron', pan: 'right' });
  });

  it('가득 찬 접시에는 보내지 않고 안내 글을 띄운다', () => {
    const dispatch = vi.fn();
    const state = play(CONFIG, [{ type: 'place', id: 'apple', pan: 'left' }]);
    renderState(state, dispatch);
    const iron = screen.getByRole('button', { name: /쇠공/ });
    fireEvent.focus(iron);
    fireEvent.keyDown(iron, { key: 'l' });
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('compare-status').textContent).toBe('접시가 가득 찼어요');
  });

  it('읽기 전용에서는 아무것도 보내지 않는다', () => {
    const dispatch = vi.fn();
    renderState(createCompareState(CONFIG), dispatch, true);
    const apple = screen.getByRole('button', { name: /사과/ });
    fireEvent.focus(apple);
    fireEvent.keyDown(apple, { key: 'l' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('결과 글: 왼쪽·오른쪽·수평', () => {
    const level: CompareConfig = {
      mode: 'compare',
      items: [
        { id: 'a', kind: 'apple', weight: 4 },
        { id: 'b', kind: 'stone', weight: 4 },
      ],
    };
    const text = (state: CompareState) => {
      const view = renderState(state);
      const result = screen.getByTestId('balance-result').textContent;
      view.unmount();
      return result;
    };
    expect(text(play(CONFIG, [{ type: 'place', id: 'iron', pan: 'left' }]))).toBe(
      '왼쪽이 더 무거워요',
    );
    expect(text(play(CONFIG, [{ type: 'place', id: 'iron', pan: 'right' }]))).toBe(
      '오른쪽이 더 무거워요',
    );
    expect(
      text(
        play(level, [
          { type: 'place', id: 'a', pan: 'left' },
          { type: 'place', id: 'b', pan: 'right' },
        ]),
      ),
    ).toBe('수평이에요');
  });

  it('설정 오류이면 오류 문구만 보인다', () => {
    renderState(createCompareState({ mode: 'compare', items: [] }));
    expect(screen.getByTestId('balance-error')).toBeTruthy();
  });
});

describe('compare 오버레이', () => {
  const props = (state: CompareState) =>
    ({ config: CONFIG, state, args: undefined, scale: 1 }) as OverlayProps<E06Config, E06State>;

  it('size-vs-weight: 두 접시에 물건이 하나씩 없으면 그리지 않는다', () => {
    const empty = render(<SizeVsWeightOverlay {...props(createCompareState(CONFIG))} />);
    expect(empty.container.innerHTML).toBe('');
    empty.unmount();
    const one = render(
      <SizeVsWeightOverlay
        {...props(play(CONFIG, [{ type: 'place', id: 'apple', pan: 'left' }]))}
      />,
    );
    expect(one.container.innerHTML).toBe('');
  });

  it('size-vs-weight: 두 줄(크기·무게)을 그리고 숫자를 쓰지 않는다', () => {
    const state = play(CONFIG, [
      { type: 'place', id: 'sponge', pan: 'left' },
      { type: 'place', id: 'iron', pan: 'right' },
    ]);
    const { container } = render(<SizeVsWeightOverlay {...props(state)} />);
    const text = container.textContent ?? '';
    expect(text).toContain('크기');
    expect(text).toContain('무게');
    expect(text).not.toMatch(DIGITS);
    const width = (selector: string) =>
      Number(container.querySelector(selector)?.querySelector('rect')?.getAttribute('width'));
    // 큰 스펀지(왼쪽)가 크기 막대는 더 길고, 무게 막대는 무거운 쇠공(오른쪽)이 더 길다.
    expect(width('[data-bar="size-left"]')).toBeGreaterThan(width('[data-bar="size-right"]'));
    expect(width('[data-bar="weight-right"]')).toBeGreaterThan(width('[data-bar="weight-left"]'));
  });

  it('size-vs-weight: 무게가 같으면 무게 막대도 같다', () => {
    const level: CompareConfig = {
      mode: 'compare',
      items: [
        { id: 'a', kind: 'balloon', weight: 4 },
        { id: 'b', kind: 'stone', weight: 4, visualSize: 'small' },
      ],
    };
    const state = play(level, [
      { type: 'place', id: 'a', pan: 'left' },
      { type: 'place', id: 'b', pan: 'right' },
    ]);
    const { container } = render(<SizeVsWeightOverlay {...props(state)} />);
    const width = (selector: string) =>
      container.querySelector(selector)?.querySelector('rect')?.getAttribute('width');
    expect(width('[data-bar="weight-left"]')).toBe(width('[data-bar="weight-right"]'));
  });

  it('big-tilt 등 기존 오버레이는 compare에서 그리지 않는다', () => {
    const state = play(CONFIG, [
      { type: 'place', id: 'sponge', pan: 'left' },
      { type: 'place', id: 'iron', pan: 'right' },
    ]);
    const Guarded = skipInCompare(BigTiltOverlay);
    const { container } = render(<Guarded {...props(state)} />);
    expect(container.innerHTML).toBe('');
  });
});
