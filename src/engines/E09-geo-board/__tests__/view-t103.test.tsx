/** @vitest-environment jsdom */
/** T103 화면 테스트: 전체 대각선 수·도형 이름·최대 넓이가 화면에 없다. */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { GeoAction, GeoConfig, GeoState } from '../types';
import { createInitialState, reduce } from '../reduce';
import { GeoView } from '../View';

afterEach(cleanup);

function renderConfig(config: GeoConfig, actions: readonly GeoAction[] = []) {
  const state: GeoState = actions.reduce<GeoState>(
    (value, action) => reduce(value, action),
    createInitialState(config),
  );
  return render(
    <GeoView
      config={config}
      state={state}
      dispatch={() => {}}
      cpa="C"
      mode={state.mode}
      targetSize={48}
    />,
  );
}

function textOf(config: GeoConfig, actions: readonly GeoAction[] = []): string {
  return renderConfig(config, actions).container.textContent ?? '';
}

describe('E09 T103 diagonal 화면은 정답 단서를 쓰지 않는다', () => {
  it('기본 설정에 전체 대각선 개수와 도형 이름이 없다', () => {
    const { container } = renderConfig({ mode: 'diagonal' });
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/대각선\s*\d+\s*개/);
    for (const name of ['삼각형', '사각형', '오각형', '육각형']) {
      expect(text).not.toContain(name);
    }
    expect(container.querySelector('[data-testid="diagonal-table"]')).toBeNull();
  });

  it('countTable이 켜져도 아무것도 긋지 않았으면 그은 수 칸은 비어 있다', () => {
    const { container } = renderConfig({ mode: 'diagonal', countTable: true });
    const cells = container.querySelectorAll('[data-testid^="diagonal-count-"]');
    expect(cells).toHaveLength(4);
    for (const cell of Array.from(cells)) {
      expect(cell.textContent ?? '').toBe('');
    }
  });
});

describe('E09 T103 fixed-perimeter 화면은 최대 넓이를 쓰지 않는다', () => {
  it('처음 3×7 화면에 25(최대 넓이)가 없다', () => {
    const text = textOf({
      mode: 'geoboard',
      grid: [12, 12],
      constraint: { type: 'fixed-perimeter', value: 20, shape: 'rectangle' },
      log: true,
    });
    expect(text).not.toContain('25');
    expect(text).toContain('넓이 21');
    expect(text).toContain('둘레 20');
    expect(text).not.toContain('최대');
  });
});

describe('E09 T103 읽기 전용 그림', () => {
  it('openShapes·curvedShapes는 [data-given] 그룹으로만 그린다', () => {
    const { container } = renderConfig({
      mode: 'geoboard',
      grid: [5, 5],
      openShapes: [
        [
          [0, 0],
          [2, 1],
          [4, 0],
        ],
      ],
      curvedShapes: [
        {
          pegs: [
            [0, 4],
            [4, 4],
            [3, 2],
            [1, 2],
          ],
          curved: [0],
        },
      ],
    });
    const given = container.querySelector('[data-given="true"]');
    expect(given).not.toBeNull();
    expect(given?.querySelectorAll('path').length).toBe(2);
    expect(given?.querySelector('[data-given-open="0"]')).not.toBeNull();
    expect(given?.querySelector('[data-given-curved="0"]')).not.toBeNull();
  });
});
