/** @vitest-environment jsdom */
/** E16 rule-shooter 화면 테스트: 숨은 규칙이 DOM에 없고, 발사 뒤에만 ✓/✕·패널이 나온다. */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LaserMissOverlay } from '../overlays/laser-miss';
import { LongChainOverlay } from '../overlays/long-chain';
import { SwapCheckOverlay } from '../overlays/swap-check';
import { createInitialState, reduce } from '../reduce';
import type { FunctionAction, FunctionConfig, FunctionState } from '../types';
import { FunctionView } from '../View';

afterEach(cleanup);

function play(config: FunctionConfig, actions: readonly FunctionAction[]): FunctionState {
  return actions.reduce<FunctionState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

function shoot(text: string, fire = true): FunctionAction[] {
  return [
    { type: 'clear', target: 'rule' },
    ...[...text].map((key): FunctionAction => ({ type: 'type', target: 'rule', key })),
    ...(fire ? [{ type: 'fire' } as const] : []),
  ];
}

function renderState(state: FunctionState, dispatch = vi.fn()) {
  return render(
    <FunctionView
      config={{ mode: state.mode } as FunctionConfig}
      state={state}
      dispatch={dispatch}
      cpa="C"
      mode={state.mode}
      targetSize={48}
      readOnly={false}
    />,
  );
}

function visibleStrings(container: HTMLElement): string {
  const parts: string[] = [container.textContent ?? ''];
  for (const element of container.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      if (attribute.name.startsWith('data-') || attribute.name.startsWith('aria-')) {
        parts.push(attribute.value);
      }
    }
  }
  return parts.join('|');
}

const CONFIG: FunctionConfig = {
  mode: 'rule-shooter',
  rule: '□ = ○ × 777 + 888',
  avoidForm: '□ = 555 × ○',
  gems: [
    [1, 3],
    [2, 6],
    [4, 12],
  ],
};

describe('E16 rule-shooter 화면', () => {
  it('숨은 rule·avoidForm이 DOM에 없다(발사 전·후, data-·aria 포함)', () => {
    const before = renderState(createInitialState(CONFIG));
    const first = visibleStrings(before.container);
    for (const secret of ['777', '888', '555']) expect(first).not.toContain(secret);
    before.unmount();
    const after = renderState(play(CONFIG, shoot('□ = ○ + 2')));
    const second = visibleStrings(after.container);
    for (const secret of ['777', '888', '555']) expect(second).not.toContain(secret);
  });

  it('발사 전에는 ✓/✕·패널·레이저가 없다', () => {
    const { container } = renderState(createInitialState(CONFIG));
    expect(container.querySelector('[data-testid="shooter-canvas"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-gem]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-badge]')).toHaveLength(0);
    expect(container.querySelector('[data-testid="miss-panel"]')).toBeNull();
    expect(container.querySelectorAll('[data-laser]')).toHaveLength(0);
  });

  it('□ = ○ + 2: ✓ 1개·✕ 2개·패널 2줄·레이저 점은 원과 십자', () => {
    const { container } = renderState(play(CONFIG, shoot('□ = ○ + 2')));
    expect(container.querySelectorAll('[data-badge="hit"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-badge="miss"]')).toHaveLength(2);
    const rows = container.querySelectorAll('[data-testid="miss-panel"] [data-miss]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector('span')?.textContent).toBe(
      '이 보석의 ○는 2인데, 내 식에 넣으면 □는 4이에요.',
    );
    expect(rows[1]?.querySelector('span')?.textContent).toBe(
      '이 보석의 ○는 4인데, 내 식에 넣으면 □는 6이에요.',
    );
    const laser = container.querySelector('[data-laser="1"]');
    expect(laser?.querySelector('circle')).not.toBeNull();
    expect(laser?.querySelector('path')).not.toBeNull();
    expect(container.querySelector('[data-testid="shooter-summary"]')?.textContent).toBe(
      '보석 3개 가운데 1개를 맞혔어요',
    );
  });

  it('보석 지름은 24px 이상이다(논리 28)', () => {
    const { container } = renderState(createInitialState(CONFIG));
    const polygon = container.querySelector('[data-gem="0"] polygon');
    const points = (polygon?.getAttribute('points') ?? '')
      .split(' ')
      .map((pair) => pair.split(',').map(Number));
    const xs = points.map((p) => p[0] ?? 0);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(24);
  });

  it('식이 하나로 정해지지 않으면 패널이 그 말을 쓴다', () => {
    const { container } = renderState(play(CONFIG, shoot('□ × 0 = ○')));
    expect(container.querySelector('[data-testid="miss-panel"]')?.textContent).toContain(
      '내 식으로는 □를 하나로 정할 수 없어요',
    );
  });

  it('식을 고치면 결과 표시가 사라진다', () => {
    const state = play(CONFIG, [...shoot('□ = ○ + 2'), { type: 'backspace', target: 'rule' }]);
    const { container } = renderState(state);
    expect(container.querySelectorAll('[data-badge]')).toHaveLength(0);
    expect(container.querySelector('[data-testid="miss-panel"]')).toBeNull();
  });

  it('missPanel: false면 패널이 없고 ✓/✕만 있다', () => {
    const { container } = renderState(
      play({ ...CONFIG, missPanel: false } as FunctionConfig, shoot('□ = ○ + 2')),
    );
    expect(container.querySelector('[data-testid="miss-panel"]')).toBeNull();
    expect(container.querySelectorAll('[data-badge]')).toHaveLength(3);
  });

  it('발사 단추는 fire Action을 보내고, allowedOps에 없는 연산 단추는 없다', () => {
    const dispatch = vi.fn();
    const state = createInitialState({ ...CONFIG, allowedOps: ['+', '-'] } as FunctionConfig);
    const { getByRole, queryByRole } = renderState(state, dispatch);
    fireEvent.click(getByRole('button', { name: '발사' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'fire' });
    expect(queryByRole('button', { name: /^×$/ })).toBeNull();
    expect(queryByRole('button', { name: /^[+]$/ })).not.toBeNull();
    expect(queryByRole('button', { name: '규칙 시험하기' })).toBeNull();
  });

  it('look: table이면 격자 대신 대응표를 그린다(레이저 없음, ✓/✕는 표 아래)', () => {
    const state = play({ ...CONFIG, look: 'table' } as FunctionConfig, shoot('□ = ○ + 2'));
    const { container } = renderState(state);
    expect(container.querySelector('[data-testid="shooter-canvas"]')).toBeNull();
    expect(container.querySelector('[data-testid="relation-canvas"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-mark="ok"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-mark="bad"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-laser]')).toHaveLength(0);
  });

  it('설정 오류 판', () => {
    const { container } = renderState(createInitialState({ mode: 'rule-shooter', gems: [[1, 2]] }));
    expect(container.querySelector('[data-testid="function-error"]')).not.toBeNull();
  });

  it('학년·점수 글자가 없다', () => {
    const { container } = renderState(play(CONFIG, shoot('□ = ○ + 2')));
    expect(container.textContent).not.toMatch(/학년|점수|랭킹/);
  });
});

describe('E16 rule-shooter 오버레이', () => {
  const props = (state: FunctionState) => ({
    config: { mode: 'rule-shooter' } as FunctionConfig,
    state,
    args: undefined,
  });

  it('laser-miss: 빗나간 보석마다 세로 점선과 두 □ 값, 맞힌 보석은 ✓ 고리', () => {
    const { container } = render(<LaserMissOverlay {...props(play(CONFIG, shoot('□ = ○ + 2')))} />);
    expect(container.querySelectorAll('[data-testid="laser-miss-gap"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-testid="laser-miss-gap"] line')).toHaveLength(2);
    expect(container.querySelectorAll('[data-testid="laser-miss-hit"]')).toHaveLength(1);
    const texts = [...container.querySelectorAll('[data-testid="laser-miss-text"]')].map(
      (node) => node.textContent,
    );
    expect(texts).toEqual(['보석 □ = 6, 내 식 □ = 4', '보석 □ = 12, 내 식 □ = 6']);
  });

  it('laser-miss: 식을 시험하지 않았거나 table 모양이면 그리지 않는다', () => {
    expect(
      render(<LaserMissOverlay {...props(createInitialState(CONFIG))} />).container.querySelector(
        'svg',
      ),
    ).toBeNull();
    const table = play({ ...CONFIG, look: 'table' } as FunctionConfig, shoot('□ = ○ + 2'));
    expect(
      render(<LaserMissOverlay {...props(table)} />).container.querySelector('svg'),
    ).toBeNull();
  });

  it('swap-check: 격자에서는 보석 설명을 쓰고, long-chain은 격자에서 그리지 않는다', () => {
    const state = play(CONFIG, shoot('○ = □ × 3'));
    const { container } = render(<SwapCheckOverlay {...props(state)} />);
    expect(container.querySelector('[data-testid="swap-check-mine"]')?.textContent).toBe(
      '○ = 1일 때 내 식의 □ = 1/3',
    );
    expect(container.querySelector('[data-testid="swap-check-actual"]')?.textContent).toBe(
      '보석의 □ = 3',
    );
    cleanup();
    expect(
      render(<LongChainOverlay {...props(play(CONFIG, shoot('+3')))} />).container.querySelector(
        'svg',
      ),
    ).toBeNull();
  });

  it('swap-check·long-chain: table 모양에서는 기존 대응표 위에 그린다', () => {
    const table = { ...CONFIG, look: 'table' } as FunctionConfig;
    const swap = render(<SwapCheckOverlay {...props(play(table, shoot('○ = □ × 3')))} />);
    expect(swap.container.querySelector('svg')).not.toBeNull();
    cleanup();
    const chain = render(<LongChainOverlay {...props(play(table, shoot('+3')))} />);
    expect(
      chain.container.querySelectorAll('[data-testid="long-chain-step"]').length,
    ).toBeGreaterThan(0);
  });
});
