/** @vitest-environment jsdom */
/** T101 화면 테스트: 기본 설정에서 도형 이름·각도가 DOM에 없다. */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeoAction, GeoConfig, GeoState } from '../types';
import { createInitialState, reduce } from '../reduce';
import { GeoView } from '../View';

afterEach(cleanup);

const FIGURE_NAMES = [
  '삼각형',
  '사각형',
  '이등변',
  '정삼각형',
  '직사각형',
  '정사각형',
  '마름모',
  '평행사변형',
  '사다리꼴',
];

function textOf(config: GeoConfig, actions: readonly GeoAction[] = []): string {
  const state: GeoState = actions.reduce<GeoState>(
    (value, action) => reduce(value, action),
    createInitialState(config),
  );
  return (
    render(
      <GeoView
        config={config}
        state={state}
        dispatch={() => {}}
        cpa="C"
        mode={state.mode}
        targetSize={48}
      />,
    ).container.textContent ?? ''
  );
}

function expectNoNames(text: string): void {
  for (const name of FIGURE_NAMES) expect(text).not.toContain(name);
}

describe('E09 T101 기본 화면은 정답 단서를 쓰지 않는다', () => {
  it('classify 기본 설정에 도형 이름·직각·각도 기호가 없다', () => {
    const text = textOf({ mode: 'classify' });
    expectNoNames(text);
    expect(text).not.toContain('직각');
    expect(text).not.toContain('°');
  });

  it('drag-test 기본 설정에도 도형 이름·직각·각도 기호가 없다', () => {
    const text = textOf({ mode: 'drag-test' });
    expectNoNames(text);
    expect(text).not.toContain('직각');
    expect(text).not.toContain('°');
  });

  it('classifyLive를 켜도 이름 글자는 없고 성질 수만 쓴다', () => {
    const config: GeoConfig = { mode: 'drag-test', classifyLive: true };
    const text = textOf(config, [
      { type: 'add-point', at: [0, 0] },
      { type: 'add-point', at: [6, 0] },
      { type: 'add-point', at: [3, 4] },
      { type: 'add-segment', a: 'n1', b: 'n2' },
      { type: 'add-segment', a: 'n1', b: 'n3' },
      { type: 'add-segment', a: 'n2', b: 'n3' },
    ]);
    expectNoNames(text);
    expect(text).toContain('직각');
    expect(text).not.toContain('°');
  });

  it('classify showProperties는 성질 수를 쓰지만 이름은 쓰지 않는다', () => {
    const text = textOf({
      mode: 'classify',
      grid: [6, 6],
      showProperties: ['rightAngles', 'equalSides'],
      shapes: [
        [
          [0, 0],
          [3, 0],
          [0, 4],
        ],
      ],
    });
    expectNoNames(text);
    expect(text).toContain('직각 1개');
    expect(text).not.toContain('°');
  });
});

/** 이등변삼각형을 만든 drag-test 상태를 그린다. */
function renderIsosceles(measure: readonly ('sideLengths' | 'angles')[]) {
  const config: GeoConfig = { mode: 'drag-test', measure };
  const actions: readonly GeoAction[] = [
    { type: 'add-point', at: [0, 0] },
    { type: 'add-point', at: [6, 0] },
    { type: 'add-point', at: [3, 4] },
    { type: 'add-segment', a: 'n1', b: 'n2' },
    { type: 'add-segment', a: 'n2', b: 'n3' },
    { type: 'add-segment', a: 'n3', b: 'n1' },
  ];
  const state = actions.reduce<GeoState>(
    (value, action) => reduce(value, action),
    createInitialState(config),
  );
  return render(
    <GeoView
      config={config}
      state={state}
      dispatch={() => {}}
      cpa="P"
      mode={state.mode}
      targetSize={48}
    />,
  );
}

describe('E09 T101 같은 변 눈금은 측정을 켰을 때만 그린다', () => {
  it('기본 measure: []에서는 이등변삼각형에도 눈금이 없다', () => {
    const { container } = renderIsosceles([]);
    expect(container.querySelectorAll('[data-testid="drag-tick"]')).toHaveLength(0);
  });

  it('measure: sideLengths면 같은 변에 눈금을 그린다', () => {
    const { container } = renderIsosceles(['sideLengths']);
    expect(container.querySelectorAll('[data-testid="drag-tick"]').length).toBeGreaterThan(0);
  });
});

describe('E09 T101 사각형 손잡이 키보드 조작', () => {
  it('손잡이를 고르고 방향키로 한 단계씩 set-quad-params를 보낸다', () => {
    const config: GeoConfig = { mode: 'drag-test', construction: 'from-diagonals' };
    const state = createInitialState(config);
    const dispatch = vi.fn();
    const { getByTestId } = render(
      <GeoView
        config={config}
        state={state}
        dispatch={dispatch}
        cpa="P"
        mode={state.mode}
        targetSize={48}
      />,
    );
    const canvas = getByTestId('geo-canvas');
    fireEvent.keyDown(canvas, { key: '2' });
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'set-quad-params',
      params: [{ param: 't', value: 5 }],
    });
    fireEvent.keyDown(canvas, { key: 'ArrowUp' });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'set-quad-params',
      params: [{ param: 'beta', value: 6 }],
    });
  });
});
