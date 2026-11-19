/** @vitest-environment jsdom */
/** E06 화면 테스트: 정답이 DOM에 없고, data-tilt·결과 글·조작이 맞게 나온다. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BigTiltOverlay } from '../overlays/big-tilt';
import { MatchBarsOverlay } from '../overlays/match-bars';
import { createInitialState, reduce } from '../reduce';
import type { BalanceAction, BalanceConfig, BalanceState } from '../types';
import { BalanceView } from '../View';

afterEach(cleanup);

const ADD_BOX: BalanceConfig = { left: [{ num: 25 }, { box: true }], right: [{ num: 43 }] };

function play(config: BalanceConfig, actions: readonly BalanceAction[]): BalanceState {
  return actions.reduce<BalanceState>(reduce, createInitialState(config));
}

function renderState(state: BalanceState, dispatch = vi.fn(), targetSize: 48 | 64 = 48) {
  return render(
    <BalanceView
      config={{}}
      state={state}
      dispatch={dispatch}
      cpa="C"
      mode="equation"
      targetSize={targetSize}
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

function canvas(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg[data-testid="balance-canvas"]');
  if (!(svg instanceof SVGSVGElement)) throw new Error('canvas 없음');
  return svg;
}

describe('BalanceView 정답 노출 금지', () => {
  it.each(['scale', 'bars', 'symbols'] as const)('%s: 시작 화면에 18이 없다', (look) => {
    const { container } = renderState(createInitialState({ ...ADD_BOX, look }));
    expect(everything(container)).not.toContain('18');
  });

  it('틀린 값을 넣어 봐도 정답이 나오지 않는다', () => {
    const { container } = renderState(play(ADD_BOX, [{ type: 'try', value: '17' }]));
    expect(everything(container)).not.toContain('18');
  });
});

describe('BalanceView 기울기와 결과 글', () => {
  it('처음: unknown, 수평으로 두고 안내 글', () => {
    const { container } = renderState(createInitialState(ADD_BOX));
    expect(canvas(container).getAttribute('data-tilt')).toBe('unknown');
    expect(screen.getByTestId('balance-result').textContent).toBe('□에 수를 넣어 보세요');
    expect(container.querySelector('[data-testid="box-unknown"]')).not.toBeNull();
    const beam = container.querySelector('[data-part="beam"]') as SVGGElement;
    expect(beam.style.transform).toBe('rotate(0deg)');
  });

  it.each([
    ['18', 'level', '수평이에요'],
    ['17', 'right', '오른쪽이 더 무거워요'],
    ['19', 'left', '왼쪽이 더 무거워요'],
  ])('%s을 넣으면 data-tilt=%s, "%s"', (value, tilt, text) => {
    const { container } = renderState(play(ADD_BOX, [{ type: 'try', value }]));
    expect(canvas(container).getAttribute('data-tilt')).toBe(tilt);
    expect(screen.getByTestId('balance-result').textContent).toBe(text);
  });

  it('기울기 각도: 4°~12°, 왼쪽이 무거우면 음수 회전', () => {
    const near = renderState(play(ADD_BOX, [{ type: 'try', value: '19' }])).container;
    const beamNear = near.querySelector('[data-part="beam"]') as SVGGElement;
    const nearDeg = Number.parseFloat(beamNear.style.transform.replace('rotate(', ''));
    expect(nearDeg).toBeLessThan(-4);
    expect(nearDeg).toBeGreaterThan(-5);
    cleanup();
    const far = renderState(play(ADD_BOX, [{ type: 'try', value: '999' }])).container;
    const beamFar = far.querySelector('[data-part="beam"]') as SVGGElement;
    const farDeg = Number.parseFloat(beamFar.style.transform.replace('rotate(', ''));
    expect(farDeg).toBeLessThanOrEqual(-11);
    expect(farDeg).toBeGreaterThanOrEqual(-12);
  });

  it('접시별 합: □ 쪽은 넣어 본 뒤에만 쓴다', () => {
    const before = renderState(createInitialState(ADD_BOX)).container;
    expect(before.querySelector('[data-total="right"]')?.textContent).toBe('합 43');
    expect(before.querySelector('[data-total="left"]')).toBeNull();
    cleanup();
    const after = renderState(play(ADD_BOX, [{ type: 'try', value: '17' }])).container;
    expect(after.querySelector('[data-total="left"]')?.textContent).toBe('합 42');
  });

  it('showTotals가 false면 합이 없다', () => {
    const { container } = renderState(createInitialState({ ...ADD_BOX, showTotals: false }));
    expect(container.querySelector('[data-total]')).toBeNull();
  });

  it('빼는 항: 점선 테두리 + "−16" 글자', () => {
    const state = createInitialState({
      left: [{ box: true }, { num: 16, neg: true }],
      right: [{ num: 29 }],
    });
    const { container } = renderState(state);
    const bar = container.querySelector('[data-negative="true"]');
    expect(bar?.textContent).toBe('−16');
    expect(bar?.querySelector('[stroke-dasharray]')).not.toBeNull();
  });

  it('look bars: 기호와 글', () => {
    const { container } = renderState(createInitialState({ ...ADD_BOX, look: 'bars' }));
    expect(canvas(container).getAttribute('data-look')).toBe('bars');
    expect(screen.getByTestId('balance-sign').textContent).toBe('?');
    cleanup();
    const solved = renderState(
      play({ ...ADD_BOX, look: 'bars' }, [{ type: 'try', value: '19' }]),
    ).container;
    expect(solved.querySelector('[data-testid="balance-sign"]')?.textContent).toBe('≠');
  });

  it('look symbols: 식 한 줄', () => {
    const { container } = renderState(
      play({ ...ADD_BOX, look: 'symbols' }, [{ type: 'try', value: '18' }]),
    );
    const equation = container.querySelector('[data-testid="balance-equation"]');
    expect(equation?.textContent).toBe('25 + 18=43');
  });
});

describe('BalanceView 조작', () => {
  it('넣어 보기: 키패드로 쓰고 [넣어 보기]', () => {
    const dispatch = vi.fn();
    renderState(createInitialState(ADD_BOX), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    fireEvent.click(screen.getByRole('button', { name: '넣어 보기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'try', value: '18' });
  });

  it('빈 칸이면 넣지 않고 안내한다', () => {
    const dispatch = vi.fn();
    renderState(createInitialState(ADD_BOX), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '넣어 보기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('balance-message').textContent).toBe('□에 넣을 수를 써 보세요');
  });

  it('키보드: 숫자와 Enter로 넣어 본다', () => {
    const dispatch = vi.fn();
    renderState(createInitialState(ADD_BOX), dispatch);
    const field = screen.getByTestId('try-field');
    fireEvent.focus(field);
    fireEvent.keyDown(field, { key: '1' });
    fireEvent.keyDown(field, { key: '8' });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'try', value: '18' });
  });

  it('양쪽 빼기: 모자라면 보내지 않고 안내한다', () => {
    const dispatch = vi.fn();
    renderState(createInitialState(ADD_BOX), dispatch);
    fireEvent.click(screen.getByTestId('amount-field'));
    for (const digit of ['2', '6']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }
    fireEvent.click(screen.getByRole('button', { name: '양쪽에서 빼기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('balance-message').textContent).toBe(
      '그만큼 뺄 수 있는 막대가 없어요',
    );
  });

  it('양쪽 빼기 25: Action을 보낸다', () => {
    const dispatch = vi.fn();
    renderState(createInitialState(ADD_BOX), dispatch);
    fireEvent.click(screen.getByTestId('amount-field'));
    for (const digit of ['2', '5']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }
    fireEvent.click(screen.getByRole('button', { name: '양쪽에서 빼기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'both', op: 'remove', n: '25' });
  });

  it('한쪽 단추는 allowOneSide일 때만 있다', () => {
    renderState(createInitialState(ADD_BOX));
    expect(screen.queryByRole('button', { name: '왼쪽에만 더하기' })).toBeNull();
    cleanup();
    renderState(createInitialState({ ...ADD_BOX, allowOneSide: true }));
    expect(screen.getByRole('button', { name: '왼쪽에만 더하기' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '오른쪽에서만 빼기' })).toBeTruthy();
  });

  it('예측 잠금: 예/아니요 먼저, 조작 단추는 막힌다', () => {
    const dispatch = vi.fn();
    renderState(createInitialState({ ...ADD_BOX, predict: true }), dispatch);
    expect(screen.getByText('이 저울은 수평일까요?')).toBeTruthy();
    expect((screen.getByRole('button', { name: '넣어 보기' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: '양쪽에 더하기' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '아니요' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'predict', value: 'no' });
  });

  it('예측한 뒤에는 예측 단추가 사라지고 조작이 열린다', () => {
    const state = play({ ...ADD_BOX, predict: true }, [{ type: 'predict', value: 'yes' }]);
    renderState(state);
    expect(screen.queryByText('이 저울은 수평일까요?')).toBeNull();
    expect(screen.getByTestId('prediction-made').textContent).toBe('내 예측: 수평이에요');
    expect((screen.getByRole('button', { name: '넣어 보기' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('readOnly면 단추가 모두 막힌다', () => {
    render(
      <BalanceView
        config={{}}
        state={createInitialState(ADD_BOX)}
        dispatch={vi.fn()}
        cpa="C"
        mode="equation"
        targetSize={48}
        readOnly
      />,
    );
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('targetSize를 data 속성으로 알린다(CSS가 48/64px를 맞춘다)', () => {
    const { container } = renderState(createInitialState(ADD_BOX), vi.fn(), 64);
    expect(container.querySelector('[data-target-size="64"]')).not.toBeNull();
  });

  it('설정 오류면 오류 문구만 보인다', () => {
    const state = createInitialState({ left: [{ box: true }], right: [{ box: true }] });
    renderState(state);
    expect(screen.getByRole('alert').textContent).toContain('설정을 확인해 주세요.');
    expect(screen.queryByTestId('balance-canvas')).toBeNull();
  });
});

describe('오버레이', () => {
  const renderOverlay = (
    Overlay: typeof BigTiltOverlay | typeof MatchBarsOverlay,
    state: BalanceState,
  ) =>
    render(
      <div>
        <div>
          <Overlay config={{}} state={state} />
        </div>
      </div>,
    );

  it('big-tilt: 넣은 값이 없으면 아무것도 그리지 않는다', () => {
    const { container } = renderOverlay(BigTiltOverlay, createInitialState(ADD_BOX));
    expect(container.querySelector('svg')).toBeNull();
  });

  it('big-tilt: 마지막으로 넣은 값의 두 쪽 합과 ≠', () => {
    const state = play(ADD_BOX, [{ type: 'try', value: '68' }]);
    const { container } = renderOverlay(BigTiltOverlay, state);
    expect(container.querySelector('svg')?.getAttribute('data-testid')).toBe('overlay-big-tilt');
    expect(container.querySelector('[data-part="totals"]')?.textContent).toBe('93 ≠ 43');
  });

  it('big-tilt: 수평이면 그리지 않는다', () => {
    const state = play(ADD_BOX, [{ type: 'try', value: '18' }]);
    expect(renderOverlay(BigTiltOverlay, state).container.querySelector('svg')).toBeNull();
  });

  it('match-bars: 점선 구간과 "?"만 쓰고 값을 쓰지 않는다', () => {
    const { container } = renderOverlay(MatchBarsOverlay, createInitialState(ADD_BOX));
    expect(container.querySelector('[data-part="match-segment"]')).not.toBeNull();
    const rest = container.querySelector('[data-part="rest-segment"]');
    expect(rest?.textContent).toBe('?');
    expect(everything(container)).not.toContain('18');
  });

  it('match-bars: □가 없거나 □ 쪽 수가 0이면 그리지 않는다', () => {
    const none = createInitialState({ left: [{ num: 20 }], right: [{ num: 20 }] });
    expect(renderOverlay(MatchBarsOverlay, none).container.querySelector('svg')).toBeNull();
    cleanup();
    const zero = play(ADD_BOX, [{ type: 'both', op: 'remove', n: '25' }]);
    expect(renderOverlay(MatchBarsOverlay, zero).container.querySelector('svg')).toBeNull();
  });

  it('symbols 모양에서는 두 오버레이 모두 그리지 않는다', () => {
    const state = play({ ...ADD_BOX, look: 'symbols' }, [{ type: 'try', value: '68' }]);
    expect(renderOverlay(BigTiltOverlay, state).container.querySelector('svg')).toBeNull();
    cleanup();
    expect(renderOverlay(MatchBarsOverlay, state).container.querySelector('svg')).toBeNull();
  });
});
