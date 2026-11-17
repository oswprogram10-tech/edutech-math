/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxisCompareOverlay } from '../overlays/axis-compare';
import { NGrowOverlay } from '../overlays/n-grow';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { LatheConfig, LatheState, SolidAction, SolidConfig, SolidState } from '../types';
import { SolidView } from '../View';

let latest: LatheState | null = null;

function mockMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  latest = null;
  mockMotion(true);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const CUT = { crossSection: { planes: ['perpendicular', 'through-axis'] } } as const;

function Harness({
  config = {},
  initialActions = [],
  readOnly = false,
  overlay,
}: {
  readonly config?: Partial<LatheConfig>;
  readonly initialActions?: readonly SolidAction[];
  readonly readOnly?: boolean;
  readonly overlay?: 'axis-compare' | 'n-grow';
}) {
  const full: LatheConfig = { mode: 'lathe', ...config };
  const [state, setState] = useState<LatheState>(() => {
    let s: LatheState = createInitialState(full);
    for (const act of initialActions) s = reduce(s, act);
    return s;
  });
  useEffect(() => {
    latest = state;
  }, [state]);
  return (
    <div style={{ position: 'relative', width: 960, height: 640 }}>
      <SolidView
        config={full}
        state={state}
        dispatch={(action) => setState((prev) => reduce(prev, action))}
        cpa="C"
        mode="lathe"
        targetSize={48}
        readOnly={readOnly}
      />
      {overlay === 'axis-compare' ? <AxisCompareOverlay config={full} state={state} /> : null}
      {overlay === 'n-grow' ? <NGrowOverlay config={full} state={state} /> : null}
    </div>
  );
}

const pick = (profile: 'rectangle' | 'right-triangle' | 'semicircle'): SolidAction => ({
  type: 'lt-pick-profile',
  profile,
});
const attach = (edge: string): SolidAction => ({ type: 'lt-attach', edge: edge as never });
const angle = (a: number): SolidAction => ({ type: 'lt-set-angle', angle: a });
const click = (id: string) => fireEvent.click(screen.getByTestId(id));

function obsOf() {
  if (!latest) throw new Error('no state');
  return observe(latest);
}

const NAME_WORDS = /원기둥|원뿔|구$|구 |팽이|마름모|이등변|직사각형|삼각형|반원|점$/;

describe('E12 lathe 화면', () => {
  it('도형 카드를 고르고 변을 붙이면 상태가 바뀐다', () => {
    render(<Harness />);
    expect(screen.queryByTestId('lt-edge-long')).toBeNull();
    click('lt-profile-rectangle');
    expect(latest?.profile).toBe('rectangle');
    expect(screen.getByTestId('lt-edge-long')).toBeTruthy();
    expect(screen.getByTestId('lt-edge-short')).toBeTruthy();
    expect(screen.queryByTestId('lt-edge-hypotenuse')).toBeNull();
    click('lt-edge-long');
    expect(latest).toMatchObject({ edge: 'long', angle: 0 });
    expect(screen.getByTestId('lt-attached-edge')).toBeTruthy();
  });

  it('허용된 도형 카드만 나온다', () => {
    render(<Harness config={{ profiles: ['semicircle'] }} />);
    expect(screen.queryByTestId('lt-profile-rectangle')).toBeNull();
    expect(screen.getByTestId('lt-profile-semicircle')).toBeTruthy();
  });

  it('잔상 수는 θ/30이고 360°에서 잔상이 사라지고 입체가 나온다', () => {
    render(<Harness initialActions={[pick('rectangle'), attach('long')]} />);
    const stage = screen.getByTestId('lt-stage');
    expect(stage.getAttribute('data-ghosts')).toBe('0');
    expect(screen.queryAllByTestId(/^lt-ghost-/)).toHaveLength(0);
    for (const deg of [30, 120, 330]) {
      cleanup();
      render(
        <Harness
          initialActions={[pick('rectangle'), attach('long'), angle(deg)]}
          key={`angle-${deg}`}
        />,
      );
      expect(screen.getByTestId('lt-stage').getAttribute('data-ghosts')).toBe(String(deg / 30));
      expect(screen.queryAllByTestId(/^lt-ghost-/)).toHaveLength(deg / 30);
      expect(screen.getByTestId('lt-profile-now')).toBeTruthy();
      expect(screen.queryByTestId('lt-solid')).toBeNull();
    }
    cleanup();
    render(<Harness initialActions={[pick('rectangle'), attach('long'), angle(360)]} />);
    expect(screen.queryAllByTestId(/^lt-ghost-/)).toHaveLength(0);
    expect(screen.queryByTestId('lt-profile-now')).toBeNull();
    expect(screen.getByTestId('lt-solid')).toBeTruthy();
    expect(screen.getByTestId('lt-stage').getAttribute('data-complete')).toBe('true');
  });

  it('입체·단면 이름 글자가 화면에 없다', () => {
    render(
      <Harness
        config={CUT}
        initialActions={[
          pick('right-triangle'),
          attach('hypotenuse'),
          angle(360),
          { type: 'lt-set-laser', plane: 'through-axis', t: 5 },
        ]}
      />,
    );
    const view = screen.getByTestId('lt-view');
    expect(view.textContent ?? '').not.toMatch(NAME_WORDS);
    for (const el of Array.from(view.querySelectorAll('[aria-label],[title]'))) {
      const label = `${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''}`;
      expect(label).not.toMatch(/원기둥|원뿔|팽이|마름모|이등변|구형/);
    }
    // 단면 패널에 모양 이름 속성도 없다
    expect(screen.getByTestId('lt-section').getAttribute('data-shape')).toBeNull();
    expect(view.querySelector('[data-shape]')).toBeNull();
    expect(view.innerHTML).not.toMatch(/cylinder|cone|sphere|kite|isosceles/);
  });

  it('회전 손잡이: aria-valuenow가 각도를 따라가고 ← → 로 30°씩 돌린다', () => {
    render(<Harness initialActions={[pick('semicircle'), attach('diameter')]} />);
    const dial = screen.getByTestId('lt-dial');
    expect(dial.getAttribute('aria-valuenow')).toBe('0');
    expect(dial.getAttribute('aria-valuemax')).toBe('360');
    const view = screen.getByTestId('lt-view');
    fireEvent.keyDown(view, { key: 'ArrowRight' });
    fireEvent.keyDown(view, { key: 'ArrowRight' });
    expect(latest?.angle).toBe(60);
    expect(screen.getByTestId('lt-dial').getAttribute('aria-valuenow')).toBe('60');
    expect(screen.getByTestId('lt-dial-text').textContent).toBe('60°');
    fireEvent.keyDown(view, { key: 'ArrowLeft' });
    expect(latest?.angle).toBe(30);
    fireEvent.keyDown(view, { key: 'ArrowLeft' });
    fireEvent.keyDown(view, { key: 'ArrowLeft' });
    expect(latest?.angle).toBe(0);
  });

  it('손잡이를 끌면 놓을 때 30°에 맞춘다', () => {
    render(<Harness initialActions={[pick('semicircle'), attach('diameter')]} />);
    const dial = screen.getByTestId('lt-dial');
    dial.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 112,
        bottom: 112,
        width: 112,
        height: 112,
        x: 0,
        y: 0,
      }) as DOMRect;
    // 위(0°)에서 잡고 오른쪽(90°)을 지나 약 100°에서 놓는다.
    fireEvent.pointerDown(dial, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 56,
      clientY: 0,
    });
    fireEvent.pointerMove(dial, { pointerId: 1, pointerType: 'mouse', clientX: 112, clientY: 56 });
    expect(latest?.angle).toBe(90);
    fireEvent.pointerMove(dial, { pointerId: 1, pointerType: 'mouse', clientX: 110, clientY: 66 });
    fireEvent.pointerUp(dial, { pointerId: 1, pointerType: 'mouse' });
    expect(latest?.angle).toBe(90);
    // 계속 끌면 360°에서 멈춘다(한 바퀴 넘겨 돌려도 360을 넘지 않는다)
    fireEvent.pointerDown(dial, {
      pointerId: 2,
      pointerType: 'mouse',
      button: 0,
      clientX: 112,
      clientY: 56,
    });
    const around: readonly [number, number][] = [
      [56, 112],
      [0, 56],
      [56, 0],
      [112, 56],
      [56, 112],
      [0, 56],
      [56, 0],
    ];
    for (const [x, y] of around) {
      fireEvent.pointerMove(dial, { pointerId: 2, pointerType: 'mouse', clientX: x, clientY: y });
    }
    fireEvent.pointerUp(dial, { pointerId: 2, pointerType: 'mouse' });
    expect(latest?.angle).toBe(360);
  });

  it('rotateHandle:false면 손잡이가 없다', () => {
    render(<Harness config={{ rotateHandle: false }} />);
    expect(screen.queryByTestId('lt-dial')).toBeNull();
    expect(screen.getByTestId('lt-spin')).toBeTruthy();
  });

  it('한 바퀴 돌리기(움직임 줄이기)는 바로 360°다', () => {
    render(<Harness initialActions={[pick('rectangle'), attach('short')]} />);
    expect((screen.getByTestId('lt-spin') as HTMLButtonElement).disabled).toBe(false);
    click('lt-spin');
    expect(latest?.angle).toBe(360);
    expect(obsOf()).toMatchObject({ solid: 'cylinder', complete: true });
    expect(screen.getByTestId('lt-view').getAttribute('data-running')).toBe('false');
  });

  it('키보드: 1·2·3 도형, Space 한 바퀴, H·V 레이저, ↑↓ 높이, Q·E 돌려 보기', () => {
    render(<Harness config={CUT} />);
    const view = screen.getByTestId('lt-view');
    fireEvent.keyDown(view, { key: '2' });
    expect(latest?.profile).toBe('right-triangle');
    fireEvent.keyDown(view, { key: '3' });
    expect(latest?.profile).toBe('semicircle');
    fireEvent.keyDown(view, { key: ' ' });
    expect(latest?.angle).toBe(0); // 변을 안 붙였으면 돌지 않는다
    click('lt-edge-diameter');
    fireEvent.keyDown(view, { key: ' ' });
    expect(latest?.angle).toBe(360);
    fireEvent.keyDown(view, { key: 'h' });
    expect(latest?.laser).toEqual({ plane: 'perpendicular', t: 5 });
    fireEvent.keyDown(view, { key: 'ArrowUp' });
    fireEvent.keyDown(view, { key: 'ArrowUp' });
    expect(latest?.laser?.t).toBe(7);
    fireEvent.keyDown(view, { key: 'ArrowDown' });
    expect(latest?.laser?.t).toBe(6);
    fireEvent.keyDown(view, { key: 'v' });
    expect(latest?.laser?.plane).toBe('through-axis');
    fireEvent.keyDown(view, { key: 'e' });
    expect(latest?.view.yaw).toBe(15);
    fireEvent.keyDown(view, { key: 'q' });
    fireEvent.keyDown(view, { key: 'q' });
    expect(latest?.view.yaw).toBe(-15);
    expect(obsOf()).toMatchObject({ section: 'circle' });
  });

  it('없는 레이저 면의 키·완성 전 키는 무시한다', () => {
    render(
      <Harness
        config={{ crossSection: { planes: ['perpendicular'] } }}
        initialActions={[pick('rectangle'), attach('long'), angle(180)]}
      />,
    );
    const view = screen.getByTestId('lt-view');
    fireEvent.keyDown(view, { key: 'h' });
    expect(latest?.laser).toBeNull();
    expect(screen.queryByTestId('lt-laser-v')).toBeNull();
    fireEvent.keyDown(view, { key: 'e' });
    expect(latest?.view.yaw).toBe(0);
  });

  it('레이저 단추·슬라이더는 완성 뒤에 켜지고 단면 그림이 나온다', () => {
    render(
      <Harness config={CUT} initialActions={[pick('right-triangle'), attach('leg-vertical')]} />,
    );
    expect((screen.getByTestId('lt-laser-h') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('lt-laser-t') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('lt-section').getAttribute('data-state')).toBe('empty');
    click('lt-spin');
    expect((screen.getByTestId('lt-laser-h') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByTestId('lt-laser-t'), { target: { value: '10' } });
    expect(obsOf()).toMatchObject({ laser: { plane: 'perpendicular', t: 10 }, section: 'point' });
    expect(screen.getByTestId('lt-section').getAttribute('data-state')).toBe('shown');
    expect(screen.getByTestId('lt-laser-h-line')).toBeTruthy();
    click('lt-laser-v');
    expect(obsOf()).toMatchObject({ section: 'isosceles-triangle' });
    expect(screen.getByTestId('lt-laser-v-plane')).toBeTruthy();
    expect(screen.queryByTestId('lt-laser-h-line')).toBeNull();
    click('lt-laser-off');
    expect(latest?.laser).toBeNull();
  });

  it('crossSection이 없으면 레이저와 단면 패널이 없다', () => {
    render(<Harness initialActions={[pick('rectangle'), attach('long'), angle(360)]} />);
    expect(screen.queryByTestId('lt-laser-h')).toBeNull();
    expect(screen.queryByTestId('lt-section')).toBeNull();
    expect(screen.queryByTestId('lt-laser-t')).toBeNull();
  });

  it('showSection:false면 단면 대신 "?" 카드를 보인다(판정 값은 그대로다)', () => {
    render(
      <Harness
        config={{
          ...CUT,
          showSection: false,
          preset: { profile: 'right-triangle', edge: 'leg-vertical' },
        }}
        initialActions={[{ type: 'lt-set-laser', plane: 'perpendicular', t: 5 }]}
      />,
    );
    const section = screen.getByTestId('lt-section');
    expect(section.getAttribute('data-state')).toBe('hidden');
    expect(screen.getByTestId('lt-section-unknown').textContent).toBe('?');
    expect(section.querySelector('circle, polygon')).toBeNull();
    expect(obsOf()).toMatchObject({ section: 'circle' });
  });

  it('처음으로 단추는 비우고 preset이면 preset으로 돌아간다', () => {
    render(<Harness initialActions={[pick('rectangle'), attach('long'), angle(90)]} />);
    click('lt-reset');
    expect(latest).toMatchObject({ profile: null, edge: null, angle: 0 });
    cleanup();
    render(<Harness config={{ preset: { profile: 'semicircle', edge: 'diameter' } }} />);
    click('lt-profile-rectangle');
    click('lt-reset');
    expect(latest).toMatchObject({ profile: 'semicircle', edge: 'diameter', angle: 360 });
  });

  it('readOnly면 조작이 막힌다', () => {
    render(<Harness readOnly initialActions={[pick('rectangle'), attach('long')]} />);
    click('lt-spin');
    fireEvent.keyDown(screen.getByTestId('lt-view'), { key: 'ArrowRight' });
    expect(latest?.angle).toBe(0);
    expect((screen.getByTestId('lt-profile-semicircle') as HTMLButtonElement).disabled).toBe(true);
  });

  it('조작 단추는 48px 터치 규칙(.button)을 쓰고 데이터 속성에 크기가 있다', () => {
    render(<Harness config={CUT} />);
    expect(screen.getByTestId('lt-view').getAttribute('data-target-size')).toBe('48');
    expect(screen.getByTestId('lt-view').getAttribute('data-mode')).toBe('lathe');
  });
});

const N_GROW_SIDES = [3, 4, 6, 12] as const;

describe('E12 lathe 힌트 ② 오버레이', () => {
  it('axis-compare: 직각삼각형을 골랐을 때 두 그림(빗변·높이 변)을 그린다', () => {
    render(<Harness overlay="axis-compare" initialActions={[pick('right-triangle')]} />);
    expect(screen.getByTestId('axis-compare')).toBeTruthy();
    expect(screen.getByTestId('axis-compare-hypotenuse')).toBeTruthy();
    expect(screen.getByTestId('axis-compare-leg')).toBeTruthy();
    expect(screen.getByTestId('axis-compare-title').textContent).toBe(
      '축을 어느 변에 붙이면 꼭짓점이 하나로 모일까요?',
    );
    const text = screen.getByTestId('axis-compare').textContent ?? '';
    expect(text).not.toMatch(/원뿔|팽이|원기둥/);
  });

  it('axis-compare: 직각삼각형이 아니거나 도형이 없으면 안 그린다', () => {
    render(<Harness overlay="axis-compare" initialActions={[pick('rectangle')]} />);
    expect(screen.queryByTestId('axis-compare')).toBeNull();
    cleanup();
    render(<Harness overlay="axis-compare" />);
    expect(screen.queryByTestId('axis-compare')).toBeNull();
  });

  it('axis-compare: lathe가 아닌 상태면 안 그린다', () => {
    const other: SolidState = createInitialState({ mode: 'shapes-sort' });
    const { container } = render(
      <AxisCompareOverlay config={{ mode: 'shapes-sort' } as SolidConfig} state={other} />,
    );
    expect(container.querySelector('[data-testid="axis-compare"]')).toBeNull();
  });

  it('n-grow: 각뿔 그림 네 장과 끝에 정지한 원뿔 그림을 그린다(애니메이션 없음)', () => {
    render(<Harness overlay="n-grow" />);
    expect(screen.getByTestId('n-grow')).toBeTruthy();
    expect(N_GROW_SIDES).toEqual([3, 4, 6, 12]);
    for (let i = 0; i < N_GROW_SIDES.length; i += 1) {
      expect(screen.getByTestId(`n-grow-pyramid-${i}`)).toBeTruthy();
    }
    expect(screen.getByTestId('n-grow-cone')).toBeTruthy();
    expect(screen.getByTestId('n-grow-title').textContent).toBe('원뿔의 밑면은 다각형일까요?');
    expect(screen.getByTestId('n-grow').querySelector('animate, animateTransform')).toBeNull();
    // 밑면 변이 많아질수록 꼭짓점이 많은 윤곽이다(그림 변화)
    const polygonCounts = N_GROW_SIDES.map(
      (_, i) => screen.getByTestId(`n-grow-pyramid-${i}`).querySelectorAll('line').length,
    );
    expect(polygonCounts[3] ?? 0).toBeGreaterThan(polygonCounts[0] ?? 0);
  });

  it('n-grow: lathe가 아닌 상태면 안 그린다', () => {
    const other: SolidState = createInitialState({});
    const { container } = render(<NGrowOverlay config={{} as SolidConfig} state={other} />);
    expect(container.querySelector('[data-testid="n-grow"]')).toBeNull();
  });
});
