/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TurnSameOverlay } from '../overlays/turn-same';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { ShapesSortConfig, ShapesState, SolidAction } from '../types';
import { SolidView } from '../View';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

let latest: ShapesState | null = null;

function Harness({
  config = {},
  initialActions = [],
  readOnly = false,
  overlay = false,
}: {
  readonly config?: Partial<ShapesSortConfig>;
  readonly initialActions?: readonly SolidAction[];
  readonly readOnly?: boolean;
  readonly overlay?: boolean;
}) {
  const full: ShapesSortConfig = { mode: 'shapes-sort', ...config };
  const [state, setState] = useState<ShapesState>(() => {
    let s: ShapesState = createInitialState(full);
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
        mode="shapes-sort"
        targetSize={64}
        readOnly={readOnly}
      />
      {overlay ? <TurnSameOverlay config={full} state={state} /> : null}
    </div>
  );
}

function click(testId: string) {
  fireEvent.click(screen.getByTestId(testId));
}

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

describe('E12 shapes-sort View: 정답·결과 노출 금지', () => {
  it('굴려도 쌓아도 결과 글·숫자가 화면에 없고 ss-ramp-item에 결과 속성이 없다', () => {
    const { container } = render(<Harness />);
    const check = () => {
      const text = container.textContent ?? '';
      expect(text).not.toMatch(/굴러|멈춰|멈췄|떨어|쌓였|맞|틀|정답/);
      expect(text).not.toMatch(/\d/);
    };
    check();
    click('ss-shelf-sphere');
    click('ss-ramp-place');
    click('ss-play');
    check();
    expect(screen.getByTestId('ss-ramp-item').getAttribute('data-result')).toBeNull();
    expect(
      Array.from(screen.getByTestId('ss-ramp-item').attributes).map((a) => a.name),
    ).not.toContain('data-result');
    for (const id of ['box', 'cylinder']) {
      click(`ss-shelf-${id}`);
      click('ss-tower-stack');
    }
    click('ss-shelf-sphere');
    click('ss-tower-stack');
    check();
    expect(latest?.tower).toEqual(['box', 'cylinder']);
    expect(latest?.fallen).toHaveLength(1);
  });

  it('가린 상자: 단서를 모두 드러내도 모양 이름이 화면 글에 없다', () => {
    for (const kind of ['box', 'cylinder', 'sphere'] as const) {
      const { container, unmount } = render(
        <Harness config={{ scene: 'mystery', mystery: { kind, shadow: 'top' } }} />,
      );
      click('ss-touch');
      click('ss-touch');
      const text = container.textContent ?? '';
      expect(text).not.toMatch(/상자|둥근기둥|원기둥|공|구/);
      expect(text).not.toMatch(/\d/);
      unmount();
    }
  });
});

describe('E12 shapes-sort View: 선반·방향', () => {
  it('선반 단추는 aria-pressed·aria-label을 갖고, 고르면 ✓ 표시가 붙는다', () => {
    render(<Harness />);
    const sphere = screen.getByTestId('ss-shelf-sphere');
    expect(sphere.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('ss-shelf-box').getAttribute('aria-label')).toBe('빨간 큰 상자 모양');
    expect(screen.getByTestId('ss-shelf-cylinder').getAttribute('aria-label')).toBe(
      '파란 작은 둥근기둥 모양',
    );
    expect(sphere.getAttribute('aria-label')).toBe('노란 큰 공 모양');
    click('ss-shelf-sphere');
    expect(screen.getByTestId('ss-shelf-sphere').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('ss-shelf-sphere').textContent).toContain('✓');
    click('ss-shelf-sphere');
    expect(screen.getByTestId('ss-shelf-sphere').getAttribute('aria-pressed')).toBe('false');
    expect(latest?.selected).toBeNull();
  });

  it('세우기·눕히기 단추는 둥근기둥을 골랐을 때만 나온다', () => {
    render(<Harness />);
    expect(screen.queryByTestId('ss-pose-standing')).toBeNull();
    click('ss-shelf-box');
    expect(screen.queryByTestId('ss-pose-lying')).toBeNull();
    click('ss-shelf-cylinder');
    expect(screen.getByTestId('ss-pose-standing').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('ss-pose-lying').getAttribute('aria-pressed')).toBe('false');
    click('ss-pose-lying');
    expect(latest?.pose['cylinder']).toBe('lying');
    expect(screen.getByTestId('ss-pose-lying').getAttribute('aria-pressed')).toBe('true');
    click('ss-pose-standing');
    expect(latest?.pose['cylinder']).toBe('standing');
  });

  it('장면별로 경사로·탑·가린 상자만 그린다', () => {
    const { unmount } = render(<Harness config={{ scene: 'ramp' }} />);
    expect(screen.getByTestId('ss-ramp')).toBeTruthy();
    expect(screen.queryByTestId('ss-tower')).toBeNull();
    expect(screen.queryByTestId('ss-mystery')).toBeNull();
    unmount();
    const t = render(<Harness config={{ scene: 'tower', towerMax: 3 }} />);
    expect(screen.queryByTestId('ss-ramp')).toBeNull();
    expect(screen.getByTestId('ss-tower-slot-2')).toBeTruthy();
    expect(screen.queryByTestId('ss-tower-slot-3')).toBeNull();
    t.unmount();
    render(<Harness config={{ scene: 'mystery', mystery: { kind: 'box', shadow: 'side' } }} />);
    expect(screen.getByTestId('ss-mystery')).toBeTruthy();
    expect(screen.getByTestId('ss-shadow').getAttribute('data-view')).toBe('side');
    expect(screen.queryByTestId('ss-ramp')).toBeNull();
  });

  it('readOnly면 조작 단추가 모두 막힌다', () => {
    render(<Harness readOnly />);
    for (const id of ['ss-shelf-box', 'ss-ramp-place', 'ss-play', 'ss-tower-stack']) {
      expect((screen.getByTestId(id) as HTMLButtonElement).disabled, id).toBe(true);
    }
  });

  it('조작 단추는 고른 것·경사로 물건이 있을 때만 켜진다', () => {
    render(<Harness />);
    expect((screen.getByTestId('ss-ramp-place') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('ss-tower-stack') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('ss-play') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('ss-tower-unstack') as HTMLButtonElement).disabled).toBe(true);
    click('ss-shelf-box');
    expect((screen.getByTestId('ss-ramp-place') as HTMLButtonElement).disabled).toBe(false);
    click('ss-ramp-place');
    expect((screen.getByTestId('ss-play') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('E12 shapes-sort View: 키보드', () => {
  it('방향키로 고르고 S/L로 돌리고 R로 올리고 Space로 굴린다(한 번만)', () => {
    render(<Harness />);
    const first = screen.getByTestId('ss-shelf-box');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(latest?.selected).toBe('box');
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(latest?.selected).toBe('cylinder');
    expect(document.activeElement).toBe(screen.getByTestId('ss-shelf-cylinder'));
    fireEvent.keyDown(document.activeElement ?? first, { key: 'l' });
    expect(latest?.pose['cylinder']).toBe('lying');
    fireEvent.keyDown(document.activeElement ?? first, { key: 'S' });
    expect(latest?.pose['cylinder']).toBe('standing');
    fireEvent.keyDown(document.activeElement ?? first, { key: 'r' });
    expect(latest?.rampItem).toBe('cylinder');
    fireEvent.keyDown(document.activeElement ?? first, { key: ' ' });
    expect(latest?.trials).toHaveLength(1);
    fireEvent.keyDown(document.activeElement ?? first, { key: ' ', repeat: true });
    expect(latest?.trials).toHaveLength(1);
    fireEvent.keyDown(document.activeElement ?? first, { key: 'ArrowLeft' });
    expect(latest?.selected).toBe('box');
    // 끝에서 더 가면 그대로
    fireEvent.keyDown(document.activeElement ?? first, { key: 'ArrowLeft' });
    expect(latest?.selected).toBe('box');
  });

  it('T로 쌓고 U로 내린다, M으로 만진다', () => {
    const { unmount } = render(<Harness />);
    const first = screen.getByTestId('ss-shelf-box');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    fireEvent.keyDown(first, { key: 't' });
    expect(latest?.tower).toEqual(['box']);
    fireEvent.keyDown(first, { key: 'u' });
    expect(latest?.tower).toEqual([]);
    unmount();
    render(<Harness config={{ scene: 'mystery', mystery: { kind: 'box' } }} />);
    const shelf = screen.getByTestId('ss-shelf-box');
    fireEvent.keyDown(shelf, { key: 'm' });
    expect(latest?.cluesShown).toBe(1);
    expect(screen.getByTestId('ss-clue-0')).toBeTruthy();
    fireEvent.keyDown(shelf, { key: 'm', ctrlKey: true });
    expect(latest?.cluesShown).toBe(1);
  });

  it('Space는 keyup 기본 동작(단추 누름)도 막는다', () => {
    render(<Harness />);
    const btn = screen.getByTestId('ss-shelf-box');
    const notCancelled = fireEvent.keyUp(btn, { key: ' ' });
    expect(notCancelled).toBe(false);
  });
});

describe('E12 shapes-sort View: 연출', () => {
  it('움직임을 줄이면(또는 matchMedia가 없으면) ▶ 직후 바로 끝 위치로 간다', () => {
    mockMotion(true);
    render(<Harness config={{ scene: 'ramp' }} />);
    click('ss-shelf-sphere');
    click('ss-ramp-place');
    const start = screen.getByTestId('ss-ramp-item').getAttribute('transform') ?? '';
    click('ss-play');
    expect(screen.getByTestId('ss-ramp').getAttribute('data-running')).toBe('false');
    const end = screen.getByTestId('ss-ramp-item').getAttribute('transform') ?? '';
    expect(end).not.toBe(start);
    expect(end).toContain('translate(372 224)');
  });

  it('머무는 물건은 움직임을 줄여도 제자리에 있다', () => {
    mockMotion(true);
    render(<Harness config={{ scene: 'ramp' }} />);
    click('ss-shelf-box');
    click('ss-ramp-place');
    const start = screen.getByTestId('ss-ramp-item').getAttribute('transform') ?? '';
    click('ss-play');
    expect(screen.getByTestId('ss-ramp-item').getAttribute('transform')).toBe(start);
  });

  it('움직임을 줄이지 않으면 1.2초 연출 뒤에 끝 위치로 간다', async () => {
    mockMotion(false);
    render(<Harness config={{ scene: 'ramp' }} />);
    click('ss-shelf-sphere');
    click('ss-ramp-place');
    click('ss-play');
    expect(screen.getByTestId('ss-ramp').getAttribute('data-running')).toBe('true');
    await waitFor(
      () => expect(screen.getByTestId('ss-ramp').getAttribute('data-running')).toBe('false'),
      { timeout: 3000 },
    );
    expect(screen.getByTestId('ss-ramp-item').getAttribute('transform')).toContain(
      'translate(372 224)',
    );
    // 관찰은 연출과 상관없이 바로 정해진다
    expect(observe(latest as ShapesState)['rampResult']).toBe('roll');
  });

  it('탑에서 떨어진 물건은 움직임을 줄이면 바로 탑 옆 바닥에 놓인다', () => {
    mockMotion(true);
    render(<Harness config={{ scene: 'tower' }} />);
    click('ss-shelf-box');
    click('ss-tower-stack');
    click('ss-shelf-box');
    click('ss-shelf-sphere');
    click('ss-tower-stack');
    expect(screen.getByTestId('ss-tower').getAttribute('data-running')).toBe('false');
    const fallen = screen.getByTestId('ss-tower-fallen-0');
    expect(fallen.getAttribute('transform')).toContain('translate(168 272)');
    // 탑은 그대로 한 칸만 차 있다
    expect(screen.getByTestId('ss-tower-slot-0').getAttribute('data-filled')).toBe('true');
    expect(screen.getByTestId('ss-tower-slot-1').getAttribute('data-filled')).toBe('false');
  });

  it('지난 시도는 그림 줄로만 남고 글이 없다', () => {
    render(<Harness config={{ scene: 'ramp' }} />);
    click('ss-shelf-sphere');
    click('ss-ramp-place');
    click('ss-play');
    click('ss-play');
    expect(screen.getByTestId('ss-trial-0')).toBeTruthy();
    expect(screen.getByTestId('ss-trial-1')).toBeTruthy();
    expect(screen.getByTestId('ss-trial-0').textContent).toBe('');
  });
});

describe('E12 shapes-sort 오버레이 turn-same', () => {
  it('세운 그림과 눕힌 그림, 화살표, 제목이 있고 모양 이름은 없다', () => {
    mockMotion(true);
    const { container } = render(<Harness overlay />);
    expect(screen.getByTestId('turn-same')).toBeTruthy();
    expect(screen.getByTestId('turn-same-standing')).toBeTruthy();
    expect(screen.getByTestId('turn-same-lying')).toBeTruthy();
    expect(screen.getByTestId('turn-same-arrow')).toBeTruthy();
    expect(screen.getByTestId('turn-same-title').textContent).toBe('돌려 놓아도 같은 물건일까요?');
    const overlayText = screen.getByTestId('turn-same').textContent ?? '';
    expect(overlayText).not.toMatch(/상자|둥근기둥|원기둥|공/);
    // 움직임을 줄이면 회전 연출(animateTransform)이 없다
    expect(container.querySelector('[data-testid="turn-same"] animateTransform')).toBeNull();
  });

  it('움직임을 줄이지 않으면 0.9초 회전 연출이 있다', () => {
    mockMotion(false);
    const { container } = render(<Harness overlay />);
    const anim = container.querySelector('[data-testid="turn-same"] animateTransform');
    expect(anim).not.toBeNull();
    expect(anim?.getAttribute('dur')).toBe('0.9s');
  });

  it('shapes-sort 상태가 아니면 아무것도 그리지 않는다', () => {
    const other = createInitialState({});
    const { container } = render(<TurnSameOverlay config={{}} state={other} />);
    expect(container.innerHTML).toBe('');
  });
});
