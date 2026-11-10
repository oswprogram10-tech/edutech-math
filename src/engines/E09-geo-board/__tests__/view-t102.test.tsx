/** @vitest-environment jsdom */
/** T102 화면 테스트: 기본 화면과 snapDiameter 없이 정답 단서를 쓰지 않는다. */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeoAction, GeoConfig, GeoState } from '../types';
import { createInitialState, reduce } from '../reduce';
import { GeoView } from '../View';
import { ChordGapOverlay } from '../overlays/chord-gap';

afterEach(cleanup);

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

describe('E09 T102 기본 화면은 정답 단서를 쓰지 않는다', () => {
  it('circle 기본 설정에 지름·반지름 글자가 없다', () => {
    const text = textOf({ mode: 'circle' });
    expect(text).not.toContain('지름');
    expect(text).not.toContain('반지름');
  });

  it('angle 기본 설정에 각 종류와 50이 없다', () => {
    const text = textOf({ mode: 'angle' });
    expect(text).not.toContain('예각');
    expect(text).not.toContain('직각');
    expect(text).not.toContain('둔각');
    expect(text).not.toContain('50');
  });

  it('snapDiameter가 없으면 현이 중심을 지나도 지름 글자가 없다', () => {
    const text = textOf({ mode: 'circle', radius: 3, chordExplorer: true }, [
      { type: 'select-circle-tool', tool: 'chord' },
      { type: 'set-chord', end: 0, pos: 3 },
      { type: 'set-chord', end: 1, pos: 27 },
    ]);
    expect(text).not.toContain('지름');
  });

  it('snapDiameter가 있으면 중심을 지나는 현에 지름 이름표가 붙는다', () => {
    const text = textOf({ mode: 'circle', radius: 3, chordExplorer: true, snapDiameter: true }, [
      { type: 'select-circle-tool', tool: 'chord' },
      { type: 'set-chord', end: 0, pos: 3 },
      { type: 'set-chord', end: 1, pos: 27 },
    ]);
    expect(text).toContain('지름');
  });
});

function stateOf(config: GeoConfig, actions: readonly GeoAction[] = []): GeoState {
  return actions.reduce<GeoState>(
    (value, action) => reduce(value, action),
    createInitialState(config),
  );
}

describe('E09 T102 현 길이 막대와 중심 거리', () => {
  const config: GeoConfig = { mode: 'circle', radius: 3, chordExplorer: true };
  const diameter: readonly GeoAction[] = [
    { type: 'select-circle-tool', tool: 'chord' },
    { type: 'set-chord', end: 0, pos: 3 },
    { type: 'set-chord', end: 1, pos: 27 },
  ];

  it('지름이어도 막대가 틀을 꽉 채우지 않는다(틀 = 지름 × 1.25)', () => {
    const state = stateOf(config, diameter);
    const { getByTestId } = render(
      <GeoView
        config={config}
        state={state}
        dispatch={() => {}}
        cpa="P"
        mode={state.mode}
        targetSize={48}
      />,
    );
    const bar = getByTestId('chord-bar');
    const rects = bar.querySelectorAll('rect');
    const inner = rects[1];
    expect(inner).toBeDefined();
    expect(Number(inner?.getAttribute('width'))).toBeCloseTo((560 * 2) / 2.5, 5);
    expect(inner?.getAttribute('fill')).toBe('#2f6fde');
  });

  it('현이 중심을 지나면 chord-gap 오버레이가 떨어짐 글자를 쓰지 않는다', () => {
    const state = stateOf(config, diameter);
    const { container } = render(<ChordGapOverlay config={config} state={state} />);
    expect(container.textContent ?? '').not.toContain('중심에서 떨어져 있어요');
  });

  it('현이 중심을 지나지 않으면 chord-gap 오버레이가 떨어짐 글자를 쓴다', () => {
    const state = stateOf(config, [
      { type: 'select-circle-tool', tool: 'chord' },
      { type: 'set-chord', end: 0, pos: 3 },
      { type: 'set-chord', end: 1, pos: 26 },
    ]);
    const { container } = render(<ChordGapOverlay config={config} state={state} />);
    expect(container.textContent ?? '').toContain('중심에서 떨어져 있어요');
  });
});

describe('E09 T102 각도기 조작', () => {
  it('각도를 올려도 자동으로 돌지 않고 키보드 1°는 스냅하지 않는다', () => {
    const config: GeoConfig = { mode: 'angle', angles: [{ degrees: 60, base: 0 }] };
    const state = stateOf(config, [{ type: 'place-protractor', on: 'a1' }]);
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
    expect(state.mode).toBe('angle');
    if (state.mode === 'angle') expect(state.protractor.rotation).toBe(0);
    fireEvent.keyDown(getByTestId('geo-canvas'), { key: 'ArrowRight' });
    // 4° 스냅을 거치면 0으로 되돌아가지만, 키보드는 정확히 1° 움직인다.
    expect(dispatch).toHaveBeenCalledWith({ type: 'rotate-protractor', rotation: 1 });
  });
});
