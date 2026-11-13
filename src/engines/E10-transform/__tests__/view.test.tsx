/** @vitest-environment jsdom */
/** E10 화면 테스트: 기본 설정에서 정답 단서가 없고, predict 확인 전 결과 자리를 그리지 않는다. */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { predicates } from '../events';
import { observePredict, createPredictState, resultFigure, reducePredict } from '../modes/predict';
import { createInitialState } from '../reduce';
import type {
  CongruenceConfig,
  LineSymmetryConfig,
  PointSymmetryConfig,
  PredictConfig,
  SlideFlipTurnConfig,
  TessellationConfig,
  TransformAction,
  TransformConfig,
} from '../types';
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

describe('E10 predict selfCheck:false (T122)', () => {
  it('확인·다시 해 보기 단추와 결과 그림이 없고 칠하기는 남는다', () => {
    const config: PredictConfig = {
      mode: 'predict',
      at: [1, 1],
      operation: { type: 'slide', direction: 'right', cells: 3 },
      selfCheck: false,
    };
    const state = createInitialState(config);
    const { container, getByText, queryByText } = render(
      <TransformView
        config={config}
        state={state}
        dispatch={() => {}}
        cpa="C"
        mode="predict"
        targetSize={48}
      />,
    );
    expect(getByText('칠한 칸 지우기')).toBeTruthy();
    expect(queryByText('확인')).toBeNull();
    expect(queryByText('다시 해 보기')).toBeNull();
    expect(container.querySelectorAll('[data-result]')).toHaveLength(0);
  });

  it('안내 문구가 없는 확인 단추를 말하지 않는다', () => {
    const noCheck = renderView({ mode: 'predict', selfCheck: false });
    expect(noCheck.container.textContent).not.toContain('확인을 누르면');
    noCheck.unmount();
    const withCheck = renderView({ mode: 'predict' });
    expect(withCheck.container.textContent).toContain('확인을 누르면');
  });

  it('selfCheck:false에서는 confirm·retry 액션이 상태를 바꾸지 않는다', () => {
    const config: PredictConfig = { mode: 'predict', selfCheck: false };
    const start = createPredictState(config);
    const painted = reducePredict(start, { type: 'paint', cells: [[1, 1]], value: true });
    expect(painted.painted).toHaveLength(1);
    expect(reducePredict(painted, { type: 'confirm' })).toBe(painted);
    expect(reducePredict(painted, { type: 'retry' })).toBe(painted);
  });

  it('맞게 칠하면 confirmed 없이 predictionMatches가 참이다', () => {
    const config: PredictConfig = {
      mode: 'predict',
      at: [1, 1],
      operation: { type: 'slide', direction: 'right', cells: 3 },
      selfCheck: false,
    };
    let state = createPredictState(config);
    for (const cell of resultFigure(state).cells) {
      state = reducePredict(state, { type: 'paint', cells: [cell], value: true });
    }
    const observation = observePredict(state);
    expect(observation.confirmed).toBe(false);
    expect(predicates['predictionMatches']?.(observation, null)).toBe(true);
    expect(predicates['predictionMatches']?.(observation, { confirmed: true })).toBe(false);
  });
});

describe('E10 기본 화면은 정답 단서를 쓰지 않는다', () => {
  it.each<TransformConfig>([
    { mode: 'slide-flip-turn' } satisfies SlideFlipTurnConfig,
    { mode: 'predict' } satisfies PredictConfig,
    { mode: 'tessellation' } satisfies TessellationConfig,
    { mode: 'congruence' } satisfies CongruenceConfig,
    { mode: 'line-symmetry' } satisfies LineSymmetryConfig,
    { mode: 'point-symmetry' } satisfies PointSymmetryConfig,
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

describe('E10 T105 기본 화면은 정답 표시를 미리 그리지 않는다', () => {
  it('line-symmetry 기본 설정에는 찾은 축·접힌 빈틈이 없다', () => {
    const { container } = renderView({ mode: 'line-symmetry' });
    expect(container.querySelectorAll('[data-axis-found]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-fold-gap]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-mirror]')).toHaveLength(0);
  });

  it('line-symmetry 완성하기는 남은 반쪽 경로를 그리지 않는다', () => {
    const { container } = renderView({ mode: 'line-symmetry', task: 'complete' });
    expect(container.querySelectorAll('[data-mirror]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-student-path]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-axis-found]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-fold-gap]')).toHaveLength(0);
  });

  it('point-symmetry 기본 설정에는 중심·이등분 표시와 도형 이름이 없다', () => {
    const { container } = renderView({ mode: 'point-symmetry' });
    expect(container.querySelectorAll('[data-center-mark]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-bisect]')).toHaveLength(0);
    const text = container.textContent ?? '';
    expect(text).not.toContain('대칭의 중심');
    expect(text).not.toContain('평행사변형');
    expect(text).not.toContain('글자');
    expect(text).not.toContain('정오각형');
  });

  it('congruence 기본 설정에는 대응 표시가 없다', () => {
    const { container } = renderView({ mode: 'congruence' });
    expect(container.querySelectorAll('[data-corr]')).toHaveLength(0);
  });

  it('tessellation 기본 설정에는 빈 칸 표시가 없고 "채울 수 없" 문구도 없다', () => {
    const { container } = renderView({ mode: 'tessellation' });
    expect(container.querySelectorAll('[data-gap-cell]')).toHaveLength(0);
    expect(container.textContent ?? '').not.toContain('채울 수 없');
  });
});

describe('E10 tessellation 키보드', () => {
  it('방향키는 move(slide), Enter는 place 액션으로 보낸다', () => {
    const actions: TransformAction[] = [];
    const state = createInitialState({ mode: 'tessellation' } satisfies TessellationConfig);
    const { container } = render(
      <TransformView
        config={{ mode: 'tessellation' }}
        state={state}
        dispatch={(action) => actions.push(action)}
        cpa="C"
        mode="tessellation"
        targetSize={48}
      />,
    );
    const canvas = container.querySelector('svg[data-testid="transform-canvas"]');
    if (!canvas) throw new Error('tessellation canvas missing');
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    fireEvent.keyDown(canvas, { key: 'Enter' });
    expect(actions).toEqual([
      { type: 'move', move: { kind: 'slide', dx: 6, dy: 0 } },
      { type: 'place' },
    ]);
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
