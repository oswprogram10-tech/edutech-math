/** @vitest-environment jsdom */
/**
 * E11 화면 테스트.
 *
 * 기본 설정에서는 도형 이름·넓이·각도 숫자를 DOM 글자로 쓰지 않는다.
 * 합 표시는 `showSum: 'after-gather'`이고 학생이 다 모았을 때만 나온다.
 * `prefers-reduced-motion`이면 경첩 연출과 `data-animating`을 쓰지 않는다.
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import type { CutAction, CutConfig, CutState } from '../types';
import { CutView } from '../View';
import { bestTurn } from '../angle-gather/fan';
import { RadiusHeightOverlay } from '../overlays/radius-height';
import { sToJson } from '../tangram/surd';
import { patternSpawnPoint } from '../tangram/tray';

const FORBIDDEN = ['직사각형', '평행사변형', '삼각형', '사각형', '180', '360', '°', '넓이'];

const TRIANGLE_CONFIG: CutConfig = {
  mode: 'formula-derive',
  shape: { type: 'triangle', base: 6, height: 4, apex: 2 },
};

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: originalMatchMedia,
  });
});

function renderView(config: CutConfig, state?: CutState): string {
  const current = state ?? createInitialState(config);
  return (
    render(
      <CutView
        config={config}
        state={current}
        dispatch={() => {}}
        cpa="C"
        mode={current.mode}
        targetSize={48}
      />,
    ).container.textContent ?? ''
  );
}

function apply(config: CutConfig, actions: readonly CutAction[]): CutState {
  return actions.reduce<CutState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

function gatheredTriangle(config: CutConfig): CutState {
  let state = reduce(createInitialState(config), { type: 'cut-corners' });
  for (let index = 0; index < 3; index += 1) {
    if (state.mode !== 'angle-gather') return state;
    state = reduce(state, {
      type: 'gather-corner',
      index,
      turned: bestTurn(state, index),
    });
  }
  return state;
}

function mockReducedMotion(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

describe('E11 기본 화면은 정답 단서를 쓰지 않는다', () => {
  it('slice 기본 설정에 도형 이름·넓이·각도 숫자가 없다', () => {
    const text = renderView({ mode: 'slice' });
    for (const forbidden of FORBIDDEN) expect(text).not.toContain(forbidden);
  });

  it('formula-derive 기본 설정에 도형 이름·넓이·각도 숫자가 없다', () => {
    const text = renderView({ mode: 'formula-derive' });
    for (const forbidden of FORBIDDEN) expect(text).not.toContain(forbidden);
  });

  it('angle-gather 기본 설정에 도형 이름·넓이·각도 숫자가 없다', () => {
    const text = renderView({ mode: 'angle-gather' });
    for (const forbidden of FORBIDDEN) expect(text).not.toContain(forbidden);
  });

  it('기본 showSum: never에서는 다 모아도 180°를 쓰지 않는다', () => {
    const text = renderView({ mode: 'angle-gather' }, gatheredTriangle({ mode: 'angle-gather' }));
    expect(text).not.toContain('180');
    expect(text).not.toContain('°');
    expect(text).toContain('3 / 3');
  });
});

describe('E11 showSum: after-gather', () => {
  it('다 모은 삼각형에서만 "180°"가 보인다', () => {
    const config: CutConfig = { mode: 'angle-gather', showSum: 'after-gather' };
    const text = renderView(config, gatheredTriangle(config));
    expect(text).toContain('180°');
  });

  it('다 모으기 전에는 "180°"가 없다', () => {
    const config: CutConfig = { mode: 'angle-gather', showSum: 'after-gather' };
    const text = renderView(config);
    expect(text).not.toContain('180');
    expect(text).not.toContain('°');
  });
});

describe('E11 T107 tangram·circle-sectors 기본 화면', () => {
  const T107_FORBIDDEN = [
    '세모',
    '네모',
    '삼각형',
    '사각형',
    '직사각형',
    '원주',
    '반지름',
    '3.14',
    'π',
  ];

  it('tangram 기본 설정에 조각 이름·도형 이름·정답 단서가 없다', () => {
    const text = renderView({ mode: 'tangram' });
    for (const forbidden of T107_FORBIDDEN) expect(text).not.toContain(forbidden);
    expect(text).toContain('돌리기');
    expect(text).toContain('뒤집기');
  });

  it('circle-sectors 기본 설정에 원주·반지름·π가 없다', () => {
    const text = renderView({ mode: 'circle-sectors' });
    for (const forbidden of T107_FORBIDDEN) expect(text).not.toContain(forbidden);
    expect(text).toContain('더 잘게 나누기');
  });
});

describe('E11 T107 답을 드러내는 data 속성', () => {
  it('패턴 블록 조각·쟁반에 kind·corners·tray-kind가 없다', () => {
    const config: CutConfig = { mode: 'tangram', pieceSet: 'pattern-blocks' };
    const spawn = patternSpawnPoint();
    const state = apply(config, [
      { type: 'add-piece', kind: 'triangle', at: [sToJson(spawn.x), sToJson(spawn.y)] },
    ]);
    const { container } = render(
      <CutView
        config={config}
        state={state}
        dispatch={() => {}}
        cpa="C"
        mode="tangram"
        targetSize={48}
      />,
    );
    expect(container.querySelectorAll('[data-kind]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-corners]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-tray-kind]')).toHaveLength(0);
    // E2E가 쓰는 위치·회전 값은 남긴다.
    expect(container.querySelectorAll('[data-ax]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-rot]').length).toBeGreaterThan(0);
  });
});

describe('E11 T107 반지름 오버레이 제목', () => {
  it("showDimensions가 'named'가 아니면 '반지름'을 쓰지 않는다", () => {
    const config: CutConfig = { mode: 'circle-sectors' };
    const view = render(<RadiusHeightOverlay config={config} state={createInitialState(config)} />);
    expect((view.container.textContent ?? '').includes('반지름')).toBe(false);
    expect(view.container.textContent ?? '').toContain('원의 중심에서 테두리까지');
  });

  it("showDimensions: 'named'일 때만 반지름 어휘를 쓴다", () => {
    const config: CutConfig = { mode: 'circle-sectors', showDimensions: 'named' };
    const view = render(<RadiusHeightOverlay config={config} state={createInitialState(config)} />);
    expect(view.container.textContent ?? '').toContain('반지름');
  });
});

describe('E11 T107 자동 배열 1초 연출', () => {
  const config: CutConfig = { mode: 'circle-sectors', divisions: [16] };
  const autoArranged = reduce(createInitialState(config), { type: 'auto-arrange' });

  function renderCircle(state: CutState) {
    return render(
      <CutView
        config={config}
        state={state}
        dispatch={() => {}}
        cpa="C"
        mode="circle-sectors"
        targetSize={48}
      />,
    );
  }

  it('reduced motion이 아니면 부채꼴마다 원→줄 시작 오프셋이 붙는다', () => {
    mockReducedMotion(false);
    const { container } = renderCircle(autoArranged);
    expect(container.querySelectorAll('[style*="--from-x"]').length).toBeGreaterThan(0);
  });

  it('prefers-reduced-motion이면 연출 없이 바로 놓는다', () => {
    mockReducedMotion(true);
    const { container } = renderCircle(autoArranged);
    expect(container.querySelectorAll('[style*="--from-x"]')).toHaveLength(0);
  });
});

describe('E11 경첩 연출', () => {
  function hingedState(): CutState {
    return apply(TRIANGLE_CONFIG, [
      { type: 'duplicate', piece: 'p1' },
      { type: 'hinge', piece: 'p2', at: ['14', '4'] },
    ]);
  }

  it('연출 중에는 그 조각에 data-animating이 붙는다', async () => {
    mockReducedMotion(false);
    const { container } = render(
      <CutView
        config={TRIANGLE_CONFIG}
        state={hingedState()}
        dispatch={() => {}}
        cpa="C"
        mode="formula-derive"
        targetSize={48}
      />,
    );
    await waitFor(() =>
      expect(container.querySelectorAll('[data-animating="true"]')).toHaveLength(1),
    );
  });

  it('prefers-reduced-motion이면 data-animating이 없다', () => {
    mockReducedMotion(true);
    const { container } = render(
      <CutView
        config={TRIANGLE_CONFIG}
        state={hingedState()}
        dispatch={() => {}}
        cpa="C"
        mode="formula-derive"
        targetSize={48}
      />,
    );
    expect(container.querySelectorAll('[data-animating="true"]')).toHaveLength(0);
  });
});
