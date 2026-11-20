/** @vitest-environment jsdom */
/** E06 proportion 화면 테스트: 정답이 DOM에 없고, 격자·결과 글·슬라이더·카드·항 단추가 맞게 나온다. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AreaDiffOverlay } from '../overlays/area-diff';
import { BigTiltOverlay } from '../overlays/big-tilt';
import { CrossBracketsOverlay } from '../overlays/cross-brackets';
import { MatchBarsOverlay } from '../overlays/match-bars';
import { createProportionState, reduceProportion } from '../proportion/reduce';
import type { ProportionAction, ProportionConfig, ProportionState } from '../proportion/types';
import { createInitialState } from '../reduce';
import { BalanceView } from '../View';

afterEach(cleanup);

const BASE: ProportionConfig = { mode: 'proportion', equation: '3 : 5 = □ : 20' };
const CARDS: ProportionConfig = {
  mode: 'proportion',
  cards: ['2 : 3 = 4 : 6', '2 : 3 = 3 : 4'],
};

function play(config: ProportionConfig, actions: readonly ProportionAction[]): ProportionState {
  return actions.reduce<ProportionState>(reduceProportion, createProportionState(config));
}

function renderState(state: ProportionState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <BalanceView
      config={{ mode: 'proportion' }}
      state={state}
      dispatch={dispatch}
      cpa="C"
      mode="proportion"
      targetSize={48}
      readOnly={readOnly}
    />,
  );
}

function everything(container: HTMLElement): string {
  const parts: string[] = [container.textContent ?? ''];
  for (const element of container.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      if (attribute.name.startsWith('data-') || attribute.name.startsWith('aria-')) {
        parts.push(attribute.value);
      }
    }
  }
  return parts.join('\n');
}

/** 낱개의 12(항 글자가 이어 붙어 생긴 '351120' 같은 것은 제외). */
const NO_TWELVE = /(?<!\d)12(?!\d)/;

const tryValue = (value: string): ProportionAction => ({ type: 'try', value });

describe('proportion 화면 정답 노출 금지', () => {
  it.each(['scale', 'grid', 'symbols'] as const)('%s: 시작 화면에 12가 없다', (look) => {
    const { container } = renderState(createProportionState({ ...BASE, look }));
    expect(everything(container)).not.toMatch(NO_TWELVE);
  });

  it('틀린 값(11)을 넣어 봐도 정답 12가 나오지 않는다', () => {
    const { container } = renderState(play(BASE, [tryValue('11')]));
    expect(everything(container)).not.toMatch(NO_TWELVE);
  });
});

describe('proportion scale', () => {
  it('□를 넣기 전: 알 수 없다, 모르는 쪽은 "?" 격자, 아는 쪽은 칸 수', () => {
    const { container } = renderState(createProportionState(BASE));
    expect(screen.getByTestId('balance-canvas').getAttribute('data-tilt')).toBe('unknown');
    expect(screen.getByTestId('balance-result').textContent).toBe('□에 수를 넣어 보세요');
    expect(screen.getByTestId('grid-unknown-right')).toBeTruthy();
    expect(container.querySelector('[data-dims="left"]')?.textContent).toBe('가로 3칸 × 세로 20칸');
    expect(container.querySelector('[data-total="left"]')?.textContent).toBe('모두 60칸');
    // □ 쪽 칸 수는 넣어 본 뒤에만 쓴다.
    expect(container.querySelector('[data-dims="right"]')).toBeNull();
  });

  it('11을 넣으면 왼쪽이 더 무겁고 두 격자 칸 수를 쓴다', () => {
    const { container } = renderState(play(BASE, [tryValue('11')]));
    expect(screen.getByTestId('balance-canvas').getAttribute('data-tilt')).toBe('left');
    expect(screen.getByTestId('balance-result').textContent).toBe('왼쪽이 더 무거워요');
    expect(container.querySelector('[data-total="right"]')?.textContent).toBe('모두 55칸');
    expect(container.querySelector('[data-grid="left"]')?.getAttribute('data-cols')).toBe('3');
    expect(container.querySelector('[data-grid="right"]')?.getAttribute('data-rows')).toBe('11');
  });

  it('식 줄에 넣어 본 값을 □ 상자와 함께 쓴다', () => {
    const { container } = renderState(play(BASE, [tryValue('12')]));
    expect(screen.getByTestId('balance-result').textContent).toBe('수평이에요');
    const box = container.querySelector('[data-box="true"]');
    expect(box?.textContent).toBe('12');
    expect(box?.getAttribute('aria-label')).toBe('□ 상자, 넣어 본 수 12');
  });

  it('look grid·symbols에도 =/≠ 기호가 있다', () => {
    const grid = renderState(play({ ...BASE, look: 'grid' }, [tryValue('11')]));
    expect(screen.getByTestId('balance-sign').textContent).toBe('≠');
    grid.unmount();
    renderState(play({ ...BASE, look: 'symbols' }, [tryValue('12')]));
    expect(screen.getByTestId('balance-sign').textContent).toBe('=');
    expect(screen.getByTestId('proportion-products').textContent).toContain('외항의 곱');
    expect(screen.getByTestId('proportion-products').textContent).toContain('내항의 곱');
  });
});

describe('슬라이더', () => {
  it('키보드 오른쪽 화살표: 처음엔 min(1), 이어서 1씩 늘린다', () => {
    const dispatch = vi.fn();
    const first = renderState(createProportionState(BASE), dispatch);
    fireEvent.keyDown(screen.getByTestId('proportion-slider'), { key: 'ArrowRight' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'try', value: '1' });
    first.unmount();
    renderState(play(BASE, [tryValue('7')]), dispatch);
    fireEvent.keyDown(screen.getByTestId('proportion-slider'), { key: 'ArrowRight' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'try', value: '8' });
    fireEvent.keyDown(screen.getByTestId('proportion-slider'), { key: 'ArrowLeft' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'try', value: '6' });
    fireEvent.keyDown(screen.getByTestId('proportion-slider'), { key: 'End' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'try', value: '20' });
    fireEvent.keyDown(screen.getByTestId('proportion-slider'), { key: 'Home' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'try', value: '1' });
  });

  it('min·max를 넘지 않는다(max에서 +는 같은 값이라 기록하지 않는다)', () => {
    const dispatch = vi.fn();
    renderState(play(BASE, [tryValue('20')]), dispatch);
    fireEvent.click(screen.getByTestId('slider-plus'));
    expect(dispatch).not.toHaveBeenCalled();
    cleanup();
    renderState(play(BASE, [tryValue('1')]), dispatch);
    fireEvent.click(screen.getByTestId('slider-minus'));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('−/+ 단추는 1씩 바꾼다', () => {
    const dispatch = vi.fn();
    renderState(play(BASE, [tryValue('12')]), dispatch);
    fireEvent.click(screen.getByTestId('slider-minus'));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'try', value: '11' });
    fireEvent.click(screen.getByTestId('slider-plus'));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'try', value: '13' });
  });

  it('슬라이더 접근성: 범위와 값 글을 알린다', () => {
    renderState(play(BASE, [tryValue('12')]));
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuemin')).toBe('1');
    expect(slider.getAttribute('aria-valuemax')).toBe('20');
    expect(slider.getAttribute('aria-valuenow')).toBe('12');
  });

  it('readOnly면 모든 단추와 슬라이더가 막힌다', () => {
    const dispatch = vi.fn();
    renderState(createProportionState(BASE), dispatch, true);
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
    fireEvent.keyDown(screen.getByTestId('proportion-slider'), { key: 'ArrowRight' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('□가 없는 식에는 슬라이더가 없다', () => {
    renderState(createProportionState({ mode: 'proportion', equation: '2 : 3 = 4 : 6' }));
    expect(screen.queryByTestId('proportion-slider')).toBeNull();
  });
});

describe('카드·항 단추', () => {
  it('카드 모드: 처음엔 안내 글, 카드 글자 그대로의 단추, 누르면 select-card', () => {
    const dispatch = vi.fn();
    renderState(createProportionState(CARDS), dispatch);
    expect(screen.getByTestId('balance-result').textContent).toBe('카드를 골라 저울에 올려 보세요');
    fireEvent.click(screen.getByRole('button', { name: '2 : 3 = 3 : 4' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'select-card', index: 1 });
  });

  it('카드를 올리면 두 격자가 보이고 누른 카드가 눌림 상태', () => {
    const { container } = renderState(play(CARDS, [{ type: 'select-card', index: 0 }]));
    expect(screen.getByRole('button', { name: '2 : 3 = 4 : 6' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(container.querySelectorAll('[data-grid]')).toHaveLength(2);
    expect(screen.getByTestId('balance-result').textContent).toBe('수평이에요');
  });

  it('pairSelect: 항 단추 둘을 고르면 pick-pair를 보낸다', () => {
    const dispatch = vi.fn();
    renderState(
      createProportionState({ mode: 'proportion', equation: '3 : 5 = 12 : 20', pairSelect: true }),
      dispatch,
    );
    expect(screen.getByTestId('balance-result').textContent).toBe(
      '항 두 개를 골라 왼쪽에 올려 보세요',
    );
    fireEvent.click(screen.getByTestId('term-0'));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('pair-message').textContent).toBe('하나 더 골라 보세요');
    fireEvent.click(screen.getByTestId('term-2'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'pick-pair', indices: [0, 2] });
  });

  it('pairSelect: 고른 항으로 왼쪽 격자가 만들어진다', () => {
    const { container } = renderState(
      play({ mode: 'proportion', equation: '3 : 5 = 12 : 20', pairSelect: true }, [
        { type: 'pick-pair', indices: [0, 2] },
      ]),
    );
    expect(container.querySelector('[data-grid="left"]')?.getAttribute('data-cols')).toBe('3');
    expect(container.querySelector('[data-grid="left"]')?.getAttribute('data-rows')).toBe('12');
    expect(screen.getByTestId('pair-message').textContent).toBe('왼쪽에 올린 항: 첫째, 셋째');
  });

  it('설정 오류면 오류 문구만 보인다', () => {
    renderState(createProportionState({ mode: 'proportion', equation: '0 : 5 = □ : 20' }));
    expect(screen.getByRole('alert').textContent).toContain('설정을 확인해 주세요.');
    expect(screen.queryByTestId('balance-canvas')).toBeNull();
  });

  it('equation 상태는 기존 화면을 그대로 쓴다', () => {
    render(
      <BalanceView
        config={{}}
        state={createInitialState({})}
        dispatch={vi.fn()}
        cpa="C"
        mode="equation"
        targetSize={48}
      />,
    );
    expect(screen.getByTestId('try-field')).toBeTruthy();
    expect(screen.queryByTestId('proportion-slider')).toBeNull();
  });
});

describe('proportion 오버레이', () => {
  const draw = (
    Overlay:
      | typeof BigTiltOverlay
      | typeof AreaDiffOverlay
      | typeof CrossBracketsOverlay
      | typeof MatchBarsOverlay,
    state: ProportionState,
  ) =>
    render(
      <div>
        <div>
          <Overlay config={{ mode: 'proportion' }} state={state} />
        </div>
      </div>,
    );

  it('big-tilt: 마지막으로 넣은 값으로 두 넓이와 ≠를 쓴다', () => {
    const { container } = draw(BigTiltOverlay, play(BASE, [tryValue('18')]));
    expect(container.querySelector('[data-part="totals"]')?.textContent).toBe('60 ≠ 90');
    expect(container.querySelectorAll('[data-part="ghost-scale"]')).toHaveLength(1);
  });

  it('big-tilt: 수평이거나 넣은 값이 없으면 그리지 않는다', () => {
    expect(
      draw(BigTiltOverlay, createProportionState(BASE)).container.querySelector('svg'),
    ).toBeNull();
    expect(
      draw(BigTiltOverlay, play(BASE, [tryValue('12')])).container.querySelector('svg'),
    ).toBeNull();
  });

  it('cross-brackets: 바깥쪽·안쪽 괄호와 글자, 값은 없다', () => {
    const { container } = draw(CrossBracketsOverlay, createProportionState(BASE));
    expect(container.querySelector('[data-part="outer"]')?.textContent).toBe('바깥쪽');
    expect(container.querySelector('[data-part="inner"]')?.textContent).toBe('안쪽');
    // 선 모양으로도 구별한다: 안쪽은 점선, 바깥쪽은 실선.
    expect(
      container.querySelector('[data-part="outer"] path')?.getAttribute('stroke-dasharray'),
    ).toBeNull();
    expect(
      container.querySelector('[data-part="inner"] path')?.getAttribute('stroke-dasharray'),
    ).not.toBeNull();
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('cross-brackets: 카드를 고르기 전에는 그리지 않는다', () => {
    expect(
      draw(CrossBracketsOverlay, createProportionState(CARDS)).container.querySelector('svg'),
    ).toBeNull();
  });

  it('area-diff: 두 넓이를 알 때만, 숫자 없이 한쪽에만 있는 칸을 빗금으로 그린다', () => {
    const none = draw(AreaDiffOverlay, createProportionState(BASE));
    expect(none.container.querySelector('svg')).toBeNull();
    cleanup();
    // 3×20 과 5×11: 왼쪽만(위 띠), 오른쪽만(오른쪽 띠)
    const { container } = draw(AreaDiffOverlay, play(BASE, [tryValue('11')]));
    expect(container.querySelectorAll('[data-part="left-only"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-part="right-only"]')).toHaveLength(1);
    expect(container.querySelector('[data-part="overlap"]')?.textContent).toBe('');
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('area-diff: 같은 모양이면 빗금 칸이 없다', () => {
    const { container } = draw(
      AreaDiffOverlay,
      play({ mode: 'proportion', equation: '3 : 3 = 3 : 3' }, []),
    );
    expect(container.querySelectorAll('[data-part="left-only"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-part="right-only"]')).toHaveLength(0);
  });

  it('match-bars·equation 상태: proportion에서는 match-bars를 그리지 않는다', () => {
    expect(
      draw(MatchBarsOverlay, play(BASE, [tryValue('18')])).container.querySelector('svg'),
    ).toBeNull();
  });
});
