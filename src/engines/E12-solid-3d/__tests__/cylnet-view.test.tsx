/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observe } from '../observe';
import { RollMatchOverlay } from '../overlays/roll-match';
import { createInitialState, reduce } from '../reduce';
import type { CylinderNetConfig, CylinderNetState, SolidAction } from '../types';
import { SolidView } from '../View';

let latest: CylinderNetState | null = null;

beforeEach(() => {
  latest = null;
  // 움직임 줄이기: 연출 없이 끝 위치로 간다.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness({
  config = {},
  initialActions = [],
  readOnly = false,
  overlay = false,
}: {
  readonly config?: Partial<CylinderNetConfig>;
  readonly initialActions?: readonly SolidAction[];
  readonly readOnly?: boolean;
  readonly overlay?: boolean;
}) {
  const full: CylinderNetConfig = { mode: 'net-fold', target: 'cylinder', ...config };
  const [state, setState] = useState<CylinderNetState>(() => {
    let s: CylinderNetState = createInitialState(full);
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
        mode="net-fold"
        targetSize={48}
        readOnly={readOnly}
      />
      {overlay ? <RollMatchOverlay config={full} state={state} /> : null}
    </div>
  );
}

const assemble: SolidAction = { type: 'cn-set-step', step: 'assemble' };
const click = (id: string) => fireEvent.click(screen.getByTestId(id));
const press = (key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(screen.getByTestId('cn-view'), { key, ...init });

/** 금지 낱말: 원주·자국 길이 수, 틈·겹침·맞음 글. */
const FORBIDDEN = /12\.56|12\.5(?!\d)|4π|2π|원주|틈|겹침|겹쳐|맞아|맞음|같아요|똑같/;

function visibleText(): string {
  return screen.getByTestId('cn-view').textContent ?? '';
}

describe('E12 cylinder-net 화면: 굴리기', () => {
  it('굴리기 단계 무대와 단추가 나온다', () => {
    render(<Harness />);
    expect(screen.getByTestId('cn-roll-stage')).toBeTruthy();
    expect(screen.getByTestId('cn-mark')).toBeTruthy();
    expect(screen.queryByTestId('cn-board')).toBeNull();
    expect(screen.queryByTestId('cn-track')).toBeNull();
    expect(screen.getByTestId('cn-dim-radius').textContent).toBe('반지름 2cm');
    expect(screen.getByTestId('cn-dim-height').textContent).toBe('높이 5cm');
  });

  it('굴릴 때마다 상태가 1/8바퀴씩 바뀌고 자국이 나온다', () => {
    render(<Harness />);
    click('cn-roll-step');
    expect(latest?.rollEighths).toBe(1);
    expect(screen.getByTestId('cn-track')).toBeTruthy();
    expect(screen.getByTestId('cn-roll-stage').getAttribute('data-eighths')).toBe('1');
    click('cn-roll-back');
    expect(latest?.rollEighths).toBe(0);
    expect(screen.queryByTestId('cn-track')).toBeNull();
  });

  it('한 바퀴(8/8)에서만 강조가 나오고, 되돌리면 사라진다', () => {
    render(<Harness />);
    for (let i = 0; i < 7; i += 1) press('ArrowRight');
    expect(latest?.rollEighths).toBe(7);
    expect(screen.queryByTestId('cn-roll-match')).toBeNull();
    press('ArrowRight');
    expect(latest?.rollEighths).toBe(8);
    expect(screen.getByTestId('cn-roll-match')).toBeTruthy();
    expect(screen.getByTestId('cn-roll-match').textContent).toBe('한 바퀴');
    press('ArrowLeft');
    expect(screen.queryByTestId('cn-roll-match')).toBeNull();
  });

  it('Space와 단추로 한 바퀴를 굴리고 처음으로 돌린다', () => {
    render(<Harness />);
    press(' ');
    expect(latest?.rollEighths).toBe(8);
    click('cn-roll-reset');
    expect(latest?.rollEighths).toBe(0);
    click('cn-roll-full');
    expect(latest?.rollEighths).toBe(8);
  });

  it('rollPaint false면 자국을 그리지 않는다', () => {
    render(<Harness config={{ rollPaint: false }} initialActions={[{ type: 'cn-roll', by: 1 }]} />);
    expect(latest?.rollEighths).toBe(1);
    expect(screen.queryByTestId('cn-track')).toBeNull();
  });

  it('showDims false면 반지름·높이 글이 없다', () => {
    render(<Harness config={{ showDims: false }} />);
    expect(screen.queryByTestId('cn-dim-radius')).toBeNull();
    expect(screen.queryByTestId('cn-dim-height')).toBeNull();
  });

  it('steps가 비면 원기둥 그림만 보이고 단추가 없다', () => {
    render(<Harness config={{ steps: [] }} />);
    expect(screen.getByTestId('cn-roll-stage')).toBeTruthy();
    expect(screen.queryByTestId('cn-roll-step')).toBeNull();
    expect(screen.queryByTestId('cn-step-roll')).toBeNull();
    expect(screen.queryByTestId('cn-fold')).toBeNull();
    press('ArrowRight');
    expect(latest?.rollEighths).toBe(0);
  });

  it('원주·자국 길이 수와 틈·겹침 글이 화면에 없다(굴리기)', () => {
    render(
      <Harness initialActions={Array.from({ length: 8 }, () => ({ type: 'cn-roll', by: 1 }))} />,
    );
    expect(visibleText()).not.toMatch(FORBIDDEN);
  });
});

describe('E12 cylinder-net 화면: 맞추기·접기', () => {
  it('2단계로 가면 전개도 판과 조절 단추가 나온다', () => {
    render(<Harness />);
    click('cn-step-assemble');
    expect(latest?.step).toBe('assemble');
    expect(screen.getByTestId('cn-board')).toBeTruthy();
    expect(screen.getByTestId('cn-piece-side')).toBeTruthy();
    expect(screen.getByTestId('cn-piece-top')).toBeTruthy();
    expect(screen.getByTestId('cn-piece-bottom')).toBeTruthy();
    expect(screen.queryByTestId('cn-roll-stage')).toBeNull();
    for (const id of [
      'cn-width-m1',
      'cn-width-m01',
      'cn-width-p01',
      'cn-width-p1',
      'cn-height-m',
      'cn-height-p',
      'cn-radius-m',
      'cn-radius-p',
      'cn-fold',
    ]) {
      expect(screen.getByTestId(id), id).toBeTruthy();
    }
    expect(screen.getByTestId('cn-board').textContent).toContain('가로 6cm');
    expect(screen.getByTestId('cn-board').textContent).toContain('반지름 1cm');
  });

  it('단추로 가로·세로·반지름을 바꾼다', () => {
    render(<Harness initialActions={[assemble]} />);
    click('cn-width-p1');
    click('cn-width-p01');
    expect(latest?.widthTenths).toBe(71);
    click('cn-width-m1');
    click('cn-width-m01');
    expect(latest?.widthTenths).toBe(60);
    click('cn-height-p');
    expect(latest?.pieceHeightHalves).toBe(7);
    click('cn-radius-p');
    expect(latest?.pieceRadiusHalves).toBe(3);
  });

  it('키보드로 조절하고 Enter로 접고 편다', () => {
    render(<Harness initialActions={[assemble]} />);
    press('d');
    expect(latest?.widthTenths).toBe(61);
    press('D', { shiftKey: true });
    expect(latest?.widthTenths).toBe(71);
    press('a');
    press('A', { shiftKey: true });
    expect(latest?.widthTenths).toBe(60);
    press('w');
    expect(latest?.pieceHeightHalves).toBe(7);
    press('s');
    expect(latest?.pieceHeightHalves).toBe(6);
    press('r');
    expect(latest?.pieceRadiusHalves).toBe(3);
    press('f');
    expect(latest?.pieceRadiusHalves).toBe(2);
    press('Enter');
    expect(latest?.folded).toBe(true);
    press('d');
    expect(latest?.widthTenths).toBe(60);
    press('Enter');
    expect(latest?.folded).toBe(false);
  });

  it('1·2 키로 단계를 바꾼다', () => {
    render(<Harness />);
    press('2');
    expect(latest?.step).toBe('assemble');
    press('1');
    expect(latest?.step).toBe('roll');
  });

  it('접으면 접은 그림이 나오고 조절 단추가 꺼진다', () => {
    render(<Harness initialActions={[assemble]} />);
    click('cn-fold');
    expect(latest?.folded).toBe(true);
    expect(screen.getByTestId('cn-folded')).toBeTruthy();
    expect(screen.queryByTestId('cn-net')).toBeNull();
    expect((screen.getByTestId('cn-width-p1') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('cn-fold').textContent).toBe('펴기');
    click('cn-fold');
    expect(latest?.folded).toBe(false);
    expect(screen.getByTestId('cn-net')).toBeTruthy();
  });

  it('접은 그림의 이음선: 모자라면 빗금 띠, 남으면 진한 띠, 맞으면 실선 하나', () => {
    const fit: SolidAction[] = [
      assemble,
      ...Array.from({ length: 6 }, () => ({ type: 'cn-width', by: 10 }) as SolidAction),
      ...Array.from({ length: 6 }, () => ({ type: 'cn-width', by: 1 }) as SolidAction),
    ];
    render(<Harness initialActions={[...fit, { type: 'cn-fold' }]} />);
    // 반지름 1(처음 값)의 원주는 6.28이라 가로 12.6은 남는다.
    expect(screen.getByTestId('cn-seam-overlap')).toBeTruthy();
    expect(screen.queryByTestId('cn-seam-gap')).toBeNull();
    cleanup();

    render(
      <Harness
        initialActions={[
          assemble,
          { type: 'cn-width', by: 1 },
          { type: 'cn-width', by: 1 },
          { type: 'cn-width', by: 1 },
          { type: 'cn-fold' },
        ]}
      />,
    );
    // 반지름 1의 원주 6.28에 가로 6.3은 0.1 이내로 맞다.
    expect(screen.getByTestId('cn-seam-closed')).toBeTruthy();
    cleanup();

    render(
      <Harness
        initialActions={[
          assemble,
          { type: 'cn-radius', by: 1 },
          { type: 'cn-radius', by: 1 },
          { type: 'cn-fold' },
        ]}
      />,
    );
    // 반지름 2의 원주는 12.56이고 가로 6은 모자라다.
    expect(screen.getByTestId('cn-seam-gap')).toBeTruthy();
    const band = screen.getByTestId('cn-seam-gap');
    expect(Number(band.getAttribute('width'))).toBeGreaterThanOrEqual(4);
  });

  it('접은 그림에 aria-label은 접은 모습뿐이고 틈·겹침 낱말이 없다', () => {
    render(
      <Harness initialActions={[assemble, { type: 'cn-radius', by: 1 }, { type: 'cn-fold' }]} />,
    );
    const label = screen.getByTestId('cn-board').getAttribute('aria-label') ?? '';
    expect(label).toBe('접은 모습');
    expect(label).not.toMatch(/틈|겹|맞/);
    expect(visibleText()).not.toMatch(FORBIDDEN);
    expect(document.body.innerHTML).not.toMatch(/aria-label="[^"]*(틈|겹침|맞음)/);
  });

  it('맞추기 화면에 원주 수가 없다(가로를 12.6으로 맞춰도 12.56 등은 없다)', () => {
    const actions: SolidAction[] = [
      assemble,
      ...Array.from({ length: 6 }, () => ({ type: 'cn-width', by: 10 }) as SolidAction),
      ...Array.from({ length: 6 }, () => ({ type: 'cn-width', by: 1 }) as SolidAction),
      { type: 'cn-radius', by: 1 },
      { type: 'cn-radius', by: 1 },
    ];
    render(<Harness initialActions={actions} />);
    expect(visibleText()).toContain('가로 12.6cm');
    expect(visibleText()).not.toMatch(FORBIDDEN);
    expect(observe(latest as CylinderNetState)).toMatchObject({ widthFits: true });
  });

  it('읽기 전용이면 눌러도 바뀌지 않는다', () => {
    render(<Harness readOnly initialActions={[assemble]} />);
    expect((screen.getByTestId('cn-width-p1') as HTMLButtonElement).disabled).toBe(true);
    press('d');
    expect(latest?.widthTenths).toBe(60);
    press('Enter');
    expect(latest?.folded).toBe(false);
  });
});

describe('E12 cylinder-net 오버레이 roll-match', () => {
  it('roll 단계: 굴리기 무대 svg에 맞춘 한 바퀴 선과 지름 막대', () => {
    render(<Harness overlay />);
    const round = screen.getByTestId('roll-match-round');
    const diameter = screen.getByTestId('roll-match-diameter');
    const roundLen = Number(round.getAttribute('width'));
    const diameterLen = Number(diameter.getAttribute('width'));
    expect(roundLen).toBeGreaterThan(diameterLen * 2);
    expect(screen.getByTestId('roll-match').tagName.toLowerCase()).toBe('svg');
    const text = screen.getByTestId('roll-match').textContent ?? '';
    expect(text).not.toMatch(/\d/);
  });

  it('assemble 단계에도 그린다', () => {
    render(<Harness overlay initialActions={[assemble]} />);
    expect(screen.getByTestId('roll-match-round')).toBeTruthy();
    expect(screen.getByTestId('roll-match-diameter')).toBeTruthy();
  });

  it('다른 모드·단계 없음이면 그리지 않는다', () => {
    render(<Harness overlay config={{ steps: [] }} />);
    expect(screen.queryByTestId('roll-match')).toBeNull();
  });
});
