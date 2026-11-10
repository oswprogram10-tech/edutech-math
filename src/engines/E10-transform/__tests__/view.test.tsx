/** @vitest-environment jsdom */
/** E10 화면 테스트: 기본 설정에서 정답 단서가 없고, predict 확인 전 결과 자리를 그리지 않는다. */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../reduce';
import type { PredictConfig, SlideFlipTurnConfig, TransformConfig } from '../types';
import { TransformView } from '../View';

afterEach(cleanup);

function renderView(config: TransformConfig) {
  const state = createInitialState(config);
  return render(
    <TransformView
      config={config}
      state={state}
      dispatch={() => {}}
      cpa="C"
      mode={state.mode}
      targetSize={48}
    />,
  );
}

const TURN_PREDICT: PredictConfig = {
  mode: 'predict',
  at: [1, 1],
  operation: { type: 'turn', direction: 'cw', angle: 90, center: 'vertex-A' },
};

describe('E10 predict 확인 전에는 결과를 그리지 않는다', () => {
  it('확인 전 [data-result]·[data-arc]·[data-ghost]가 없고 칠하지 않은 결과 칸도 없다', () => {
    const { container } = renderView(TURN_PREDICT);
    expect(container.querySelectorAll('[data-result]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-arc]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-ghost]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-painted]')).toHaveLength(0);
    const canvas = container.querySelector('svg[data-testid="transform-canvas"]');
    expect(canvas?.getAttribute('data-motion')).toBe('full');
  });
});

describe('E10 기본 화면은 정답 단서를 쓰지 않는다', () => {
  it.each<TransformConfig>([
    { mode: 'slide-flip-turn' } satisfies SlideFlipTurnConfig,
    { mode: 'predict' } satisfies PredictConfig,
  ])('$mode 기본 설정에 "정답"·"딱 맞아요"·"맞았어요"가 없다', (config) => {
    const text = renderView(config).container.textContent ?? '';
    expect(text).not.toContain('정답');
    expect(text).not.toContain('딱 맞아요');
    expect(text).not.toContain('맞았어요');
  });

  it('slide-flip-turn은 이동 전에 잔상이 없다', () => {
    const { container } = renderView({ mode: 'slide-flip-turn' });
    expect(container.querySelectorAll('[data-ghost]')).toHaveLength(0);
  });

  it('목표가 있는 과제는 목표 칸을 그리지만 이동 방법은 쓰지 않는다', () => {
    const config: SlideFlipTurnConfig = {
      mode: 'slide-flip-turn',
      at: [1, 1],
      target: { orientation: 'cw90', at: [2, 3] },
    };
    const text = renderView(config).container.textContent ?? '';
    expect(text).not.toContain('정답');
  });
});

describe('E10 줄인 움직임', () => {
  it('matchMedia가 줄인 움직임이면 data-motion이 reduced다', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      const { container } = renderView({ mode: 'slide-flip-turn' });
      const canvas = container.querySelector('svg[data-testid="transform-canvas"]');
      expect(canvas?.getAttribute('data-motion')).toBe('reduced');
    } finally {
      window.matchMedia = original;
    }
  });
});
