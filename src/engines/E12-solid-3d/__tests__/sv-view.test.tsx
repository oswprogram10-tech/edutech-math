/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { UnitZoomOverlay } from '../overlays/unit-zoom';
import { UnpaintedBlinkOverlay } from '../overlays/unpainted-blink';
import { WrapsCompareOverlay } from '../overlays/wraps-compare';
import { WrapVsFillOverlay } from '../overlays/wrap-vs-fill';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { SolidAction, SurfaceVolumeConfig, SvState } from '../types';
import { SolidView } from '../View';

afterEach(() => {
  cleanup();
});

let latest: SvState | null = null;

function Harness({
  config,
  initialActions = [],
  overlays = false,
  readOnly = false,
}: {
  readonly config: Partial<SurfaceVolumeConfig>;
  readonly initialActions?: readonly SolidAction[];
  readonly overlays?: boolean;
  readonly readOnly?: boolean;
}) {
  const full: SurfaceVolumeConfig = { mode: 'surface-volume', ...config };
  const [state, setState] = useState<SvState>(() => {
    let s: SvState = createInitialState(full);
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
        mode="surface-volume"
        targetSize={48}
        readOnly={readOnly}
      />
      {overlays ? (
        <>
          <UnpaintedBlinkOverlay config={full} state={state} />
          <WrapVsFillOverlay config={full} state={state} />
          <UnitZoomOverlay config={full} state={state} />
          <WrapsCompareOverlay config={full} state={state} />
        </>
      ) : null}
    </div>
  );
}

function click(testId: string) {
  fireEvent.click(screen.getByTestId(testId));
}

const FACES = ['front', 'back', 'left', 'right', 'top', 'bottom'] as const;

describe('E12 surface-volume View: 정답 노출 금지', () => {
  it('steps 모든 단계에서 넓이·부피·개수 결과가 화면에 없다(치수 글자는 예외)', () => {
    const { container } = render(<Harness config={{}} />);
    const check = () => {
      const text = container.textContent ?? '';
      // 4×3×2의 겉넓이 52, 부피 24, 한 층 12, 보이는 3면 합 26
      expect(text).not.toMatch(/(^|\D)(52|24|12|26)(\D|$)/);
      expect(text).not.toMatch(/넓이|부피|개수|몇 개 쌓/);
    };
    check();
    click('sv-step-unfold');
    click('sv-unfold');
    check();
    click('sv-step-paint');
    for (const f of FACES) fireEvent.click(screen.getByTestId(`sv-face-${f}`));
    check();
    click('sv-step-fill-voxels');
    click('sv-fill-layer');
    check();
    click('sv-fill-layer');
    check();
    expect(latest?.filled).toHaveLength(24);
    expect(latest?.painted).toHaveLength(6);
    // 치수 글자는 있다
    click('sv-step-rotate');
    expect(screen.getByTestId('sv-box-length-w').textContent).toBe('4cm');
    expect(screen.getByTestId('sv-box-length-d').textContent).toBe('3cm');
    expect(screen.getByTestId('sv-box-length-h').textContent).toBe('2cm');
  });

  it('fixed-volume 화면에 겉넓이 값이 없다(입력한 값만 보인다)', () => {
    const { container } = render(<Harness config={{ variant: 'fixed-volume', volume: 24 }} />);
    click('sv-w-2');
    click('sv-d-3');
    click('sv-log-add');
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/(^|\D)(52|98)(\D|$)/);
    expect(text).not.toMatch(/겉넓이는|부피는|맞았|틀렸/);
    // 학생이 적은 값은 입력 칸에만 있다
    fireEvent.change(screen.getByTestId('sv-log-cell-0'), { target: { value: '52' } });
    expect((screen.getByTestId('sv-log-cell-0') as HTMLInputElement).value).toBe('52');
    expect(screen.getByTestId('sv-log').textContent).not.toMatch(/맞|정답|틀/);
  });
});

describe('E12 surface-volume View: 단계 이동', () => {
  it('단계 표시줄: 번호·이름, 현재 단계 aria-current, 48px 이상 스타일 클래스', () => {
    render(<Harness config={{}} />);
    const names = ['rotate', 'unfold', 'paint', 'fill-voxels'] as const;
    for (const [i, name] of names.entries()) {
      const btn = screen.getByTestId(`sv-step-${name}`);
      expect(btn.textContent).toContain(String(i + 1));
    }
    expect(screen.getByTestId('sv-step-rotate').getAttribute('aria-current')).toBe('step');
    expect(screen.getByTestId('sv-step-paint').getAttribute('aria-current')).toBeNull();
    click('sv-step-paint');
    expect(screen.getByTestId('sv-step-paint').getAttribute('aria-current')).toBe('step');
    expect(screen.getByTestId('sv-step-rotate').getAttribute('aria-current')).toBeNull();
    expect(screen.getByTestId('sv-view').getAttribute('data-step')).toBe('paint');
    expect(screen.getByTestId('sv-view').getAttribute('data-mode')).toBe('surface-volume');
  });

  it('steps에 놓은 단계만 표시줄에 나온다', () => {
    render(<Harness config={{ steps: ['fill-voxels', 'rotate'] }} />);
    expect(screen.queryByTestId('sv-step-paint')).toBeNull();
    expect(screen.getByTestId('sv-step-fill-voxels').getAttribute('aria-current')).toBe('step');
    expect(screen.getByTestId('sv-fill-stage')).toBeTruthy();
    click('sv-step-rotate');
    expect(screen.getByTestId('sv-box-stage')).toBeTruthy();
  });

  it('단계가 하나뿐이면 표시줄을 그리지 않는다', () => {
    render(<Harness config={{ steps: ['rotate'] }} />);
    expect(screen.queryByTestId('sv-steps')).toBeNull();
    expect(screen.getByTestId('sv-box-stage')).toBeTruthy();
  });

  it('돌리기 단추와 끌기 없이도 시점이 바뀌고 15도 단위다', () => {
    render(<Harness config={{}} />);
    click('sv-turn-right');
    expect(latest?.view).toEqual({ yaw: 75, pitch: 30 });
    click('sv-turn-left');
    click('sv-tilt-up');
    expect(latest?.view).toEqual({ yaw: 30, pitch: 60 });
    click('sv-tilt-down');
    expect(latest?.view.pitch).toBe(30);
  });
});

describe('E12 surface-volume View: 펼치기와 칠하기', () => {
  it('접힌 상태에서는 상자 그림, 펼치면 전개도 여섯 면, 접으면 다시 상자', () => {
    render(<Harness config={{}} initialActions={[{ type: 'go-step', step: 'paint' }]} />);
    expect(screen.getByTestId('sv-box-stage')).toBeTruthy();
    expect(screen.queryByTestId('sv-net-stage')).toBeNull();
    expect(screen.getByTestId('sv-unfold').textContent).toContain('펼치기');
    click('sv-unfold');
    expect(screen.getByTestId('sv-net-stage')).toBeTruthy();
    for (const f of FACES) expect(screen.getByTestId(`sv-face-${f}`)).toBeTruthy();
    expect(screen.getByTestId('sv-unfold').textContent).toContain('접기');
    click('sv-unfold');
    expect(screen.queryByTestId('sv-net-stage')).toBeNull();
  });

  it('면을 누르면 data-painted가 바뀌고 색과 무늬(패턴)를 함께 쓴다', () => {
    render(
      <Harness
        config={{}}
        initialActions={[{ type: 'go-step', step: 'paint' }, { type: 'toggle-unfold' }]}
      />,
    );
    const rectFill = (face: string) =>
      screen.getByTestId(`sv-face-${face}`).querySelector('rect')?.getAttribute('fill') ?? '';
    expect(screen.getByTestId('sv-face-front').getAttribute('data-painted')).toBe('false');
    expect(rectFill('front')).toBe('#ffffff');
    fireEvent.click(screen.getByTestId('sv-face-front'));
    fireEvent.click(screen.getByTestId('sv-face-back'));
    fireEvent.click(screen.getByTestId('sv-face-left'));
    fireEvent.click(screen.getByTestId('sv-face-right'));
    fireEvent.click(screen.getByTestId('sv-face-top'));
    expect(screen.getByTestId('sv-face-front').getAttribute('data-painted')).toBe('true');
    // 마주 보는 면 쌍은 같은 패턴, 쌍마다 다른 패턴
    expect(rectFill('front')).toMatch(/^url\(#/);
    expect(rectFill('front')).toBe(rectFill('back'));
    expect(rectFill('left')).toBe(rectFill('right'));
    expect(rectFill('front')).not.toBe(rectFill('left'));
    expect(rectFill('top')).not.toBe(rectFill('left'));
    expect(rectFill('bottom')).toBe('#ffffff');
    // 패턴 정의: 점·줄·격자(색 + 무늬)
    const defs = screen.getByTestId('sv-net-stage').querySelector('defs');
    expect(defs?.querySelectorAll('pattern').length).toBe(4);
    expect(defs?.querySelector('circle')).toBeTruthy();
    expect(defs?.querySelector('path[d^="M-1"]')).toBeTruthy();
    // 칠하지 않은 면은 흰 바탕에 격자만 있다
    const bottom = screen.getByTestId('sv-face-bottom');
    expect(bottom.querySelectorAll('line').length).toBe(3 + 2);
    click('sv-clear-paint');
    expect(latest?.painted).toEqual([]);
  });

  it('pairColors:false면 칠한 면이 모두 같은 무늬다', () => {
    render(
      <Harness
        config={{ pairColors: false }}
        initialActions={[
          { type: 'go-step', step: 'paint' },
          { type: 'toggle-unfold' },
          { type: 'paint-face', face: 'front' },
          { type: 'paint-face', face: 'left' },
        ]}
      />,
    );
    const rectFill = (face: string) =>
      screen.getByTestId(`sv-face-${face}`).querySelector('rect')?.getAttribute('fill');
    expect(rectFill('front')).toBe(rectFill('left'));
  });

  it("'unfold' 단계에서는 칠하기 도구가 없다", () => {
    render(
      <Harness
        config={{}}
        initialActions={[{ type: 'go-step', step: 'unfold' }, { type: 'toggle-unfold' }]}
      />,
    );
    expect(screen.queryByTestId('sv-clear-paint')).toBeNull();
    expect(screen.getByTestId('sv-face-front').getAttribute('role')).toBeNull();
    fireEvent.click(screen.getByTestId('sv-face-front'));
    expect(latest?.painted).toEqual([]);
  });

  it('전개도 면은 Tab·Enter로 칠한다(키보드)', () => {
    render(
      <Harness
        config={{}}
        initialActions={[{ type: 'go-step', step: 'paint' }, { type: 'toggle-unfold' }]}
      />,
    );
    const face = screen.getByTestId('sv-face-top');
    expect(face.getAttribute('tabindex')).toBe('0');
    expect(face.getAttribute('role')).toBe('button');
    fireEvent.keyDown(face, { key: 'Enter' });
    expect(latest?.painted).toEqual(['top']);
    fireEvent.keyDown(face, { key: ' ' });
    expect(latest?.painted).toEqual([]);
  });

  it('전개도 위에 치수 글자만 붙는다', () => {
    render(
      <Harness
        config={{}}
        initialActions={[{ type: 'go-step', step: 'paint' }, { type: 'toggle-unfold' }]}
      />,
    );
    expect(screen.getByTestId('sv-net-length-w').textContent).toBe('4cm');
    expect(screen.getByTestId('sv-net-length-d').textContent).toBe('3cm');
    expect(screen.getByTestId('sv-net-length-h').textContent).toBe('2cm');
  });
});

describe('E12 surface-volume View: 쌓기나무 채우기', () => {
  it('바닥 칸을 누르면 놓고 다시 누르면 뺀다, 개수는 쓰지 않는다', () => {
    const { container } = render(
      <Harness config={{}} initialActions={[{ type: 'go-step', step: 'fill-voxels' }]} />,
    );
    expect(container.querySelectorAll('[data-testid^="sv-cell-"]')).toHaveLength(12);
    fireEvent.click(screen.getByTestId('sv-cell-1-2'));
    expect(latest?.filled).toEqual([[1, 2, 0]]);
    expect(screen.getByTestId('sv-cube-1-2-0')).toBeTruthy();
    expect(screen.getByTestId('sv-cell-1-2').getAttribute('data-filled')).toBe('true');
    fireEvent.click(screen.getByTestId('sv-cell-1-2'));
    expect(latest?.filled).toEqual([]);
  });

  it('칸은 Tab + Enter로 놓는다(키보드)', () => {
    render(<Harness config={{}} initialActions={[{ type: 'go-step', step: 'fill-voxels' }]} />);
    const cell = screen.getByTestId('sv-cell-0-0');
    expect(cell.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(latest?.filled).toEqual([[0, 0, 0]]);
  });

  it('윗층의 공중 칸은 눌러도 놓이지 않고 비활성이다', () => {
    render(<Harness config={{}} initialActions={[{ type: 'go-step', step: 'fill-voxels' }]} />);
    click('sv-layer-up');
    expect(latest?.layer).toBe(1);
    const cell = screen.getByTestId('sv-cell-0-0');
    expect(cell.getAttribute('data-enabled')).toBe('false');
    expect(cell.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(cell);
    expect(latest?.filled).toEqual([]);
    expect(screen.getByTestId('sv-layer-up').hasAttribute('disabled')).toBe(true);
    click('sv-layer-down');
    expect(latest?.layer).toBe(0);
    expect(screen.getByTestId('sv-layer-down').hasAttribute('disabled')).toBe(true);
  });

  it('한 층 채우기·층 고르기·모두 비우기', () => {
    render(<Harness config={{}} initialActions={[{ type: 'go-step', step: 'fill-voxels' }]} />);
    click('sv-fill-layer');
    expect(latest?.filled).toHaveLength(12);
    expect(latest?.layer).toBe(1);
    click('sv-layer-1');
    expect(latest?.layer).toBe(0);
    expect(screen.getByTestId('sv-layer-1').textContent).toBe('1층');
    expect(screen.getByTestId('sv-layer-2').textContent).toBe('2층');
    click('sv-clear-cubes');
    expect(latest?.filled).toEqual([]);
  });

  it('layerFill:false면 한 층 채우기 단추가 없다', () => {
    render(
      <Harness
        config={{ layerFill: false }}
        initialActions={[{ type: 'go-step', step: 'fill-voxels' }]}
      />,
    );
    expect(screen.queryByTestId('sv-fill-layer')).toBeNull();
  });
});

describe('E12 surface-volume View: 키보드', () => {
  it('1~4 단계, Q/E/W/S 돌리기, U 펼치기, PageUp/PageDown 층, L 한 층 채우기', () => {
    render(<Harness config={{}} />);
    const root = screen.getByTestId('sv-step-rotate');
    fireEvent.keyDown(root, { key: 'e' });
    expect(latest?.view.yaw).toBe(45);
    fireEvent.keyDown(root, { key: 'Q' });
    fireEvent.keyDown(root, { key: 'q' });
    expect(latest?.view.yaw).toBe(15);
    fireEvent.keyDown(root, { key: 'w' });
    expect(latest?.view.pitch).toBe(45);
    fireEvent.keyDown(root, { key: 's' });
    expect(latest?.view.pitch).toBe(30);

    fireEvent.keyDown(root, { key: '3' });
    expect(latest?.step).toBe('paint');
    fireEvent.keyDown(screen.getByTestId('sv-step-paint'), { key: 'u' });
    expect(latest?.unfolded).toBe(true);
    fireEvent.keyDown(screen.getByTestId('sv-step-paint'), { key: 'U' });
    expect(latest?.unfolded).toBe(false);

    fireEvent.keyDown(root, { key: '4' });
    expect(latest?.step).toBe('fill-voxels');
    fireEvent.keyDown(root, { key: 'l' });
    expect(latest?.filled).toHaveLength(12);
    fireEvent.keyDown(root, { key: 'PageDown' });
    expect(latest?.layer).toBe(0);
    fireEvent.keyDown(root, { key: 'PageUp' });
    expect(latest?.layer).toBe(1);
    fireEvent.keyDown(root, { key: '9' });
    expect(latest?.step).toBe('fill-voxels');
    fireEvent.keyDown(root, { key: '1' });
    expect(latest?.step).toBe('rotate');
  });

  it('입력 칸에서 누른 키는 단계 이동으로 쓰지 않는다', () => {
    render(<Harness config={{ variant: 'fixed-volume' }} />);
    click('sv-log-add');
    fireEvent.keyDown(screen.getByTestId('sv-log-cell-0'), { key: '1' });
    expect(latest?.step).toBe('rotate');
  });
});

describe('E12 surface-volume View: fixed-volume', () => {
  it('가로·세로 고르기, 높이는 계산되어 보인다, 약수 단추만 있다', () => {
    render(<Harness config={{ variant: 'fixed-volume', volume: 24 }} />);
    expect(screen.queryByTestId('sv-steps')).toBeNull();
    expect(screen.getByTestId('sv-box-stage')).toBeTruthy();
    const wButtons = [1, 2, 3, 4, 6, 8, 12, 24];
    for (const n of wButtons) expect(screen.getByTestId(`sv-w-${n}`)).toBeTruthy();
    expect(screen.queryByTestId('sv-w-5')).toBeNull();
    expect(screen.getByTestId('sv-height').textContent).toBe('높이 24cm');
    click('sv-w-2');
    // 가로 2이면 세로는 12의 약수
    for (const n of [1, 2, 3, 4, 6, 12]) expect(screen.getByTestId(`sv-d-${n}`)).toBeTruthy();
    expect(screen.queryByTestId('sv-d-8')).toBeNull();
    click('sv-d-3');
    expect(latest?.dims).toEqual([2, 3, 4]);
    expect(screen.getByTestId('sv-height').textContent).toBe('높이 4cm');
    expect(screen.getByTestId('sv-w-2').getAttribute('aria-pressed')).toBe('true');
    // 가로를 바꿔도 세로가 약수로 남으면 그대로 두고, 아니면 1로 돌아간다
    click('sv-w-8');
    expect(latest?.dims).toEqual([8, 3, 1]);
    click('sv-w-24');
    expect(latest?.dims).toEqual([24, 1, 1]);
  });

  it('기록표: 기록하기, 겉넓이 적기, 지우기, 같은 상자는 비활성', () => {
    render(<Harness config={{ variant: 'fixed-volume', volume: 24 }} />);
    expect(screen.queryByTestId('sv-log-cell-0')).toBeNull();
    click('sv-log-add');
    expect(screen.getByTestId('sv-log-add').hasAttribute('disabled')).toBe(true);
    click('sv-w-2');
    click('sv-d-3');
    click('sv-log-add');
    expect(latest?.logRows).toHaveLength(2);
    fireEvent.change(screen.getByTestId('sv-log-cell-1'), { target: { value: '5a2' } });
    expect(latest?.logRows[1]?.surface).toBe(52);
    fireEvent.change(screen.getByTestId('sv-log-cell-1'), { target: { value: '' } });
    expect(latest?.logRows[1]?.surface).toBeNull();
    fireEvent.change(screen.getByTestId('sv-log-cell-1'), { target: { value: '123456' } });
    expect(latest?.logRows[1]?.surface).toBe(1234);
    expect(observe(latest as SvState)['logDistinct']).toBe(2);
    click('sv-log-remove-0');
    expect(latest?.logRows).toHaveLength(1);
    expect(latest?.logRows[0]?.w).toBe(2);
  });

  it('log:false면 기록표가 없다', () => {
    render(<Harness config={{ variant: 'fixed-volume', log: false }} />);
    expect(screen.queryByTestId('sv-log')).toBeNull();
  });

  it('readOnly면 단추·입력이 모두 잠긴다', () => {
    render(<Harness config={{ variant: 'fixed-volume' }} readOnly />);
    expect(screen.getByTestId('sv-w-2').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('sv-log-add').hasAttribute('disabled')).toBe(true);
    cleanup();
    render(<Harness config={{}} readOnly />);
    expect(screen.getByTestId('sv-step-paint').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('sv-turn-left').hasAttribute('disabled')).toBe(true);
  });
});

describe('E12 surface-volume 오버레이(힌트 ②)', () => {
  it('unpainted-blink: 칠하지 않은 면에만 깜빡임 표시, 모두 칠하면 그리지 않는다', () => {
    const { container } = render(
      <Harness
        config={{}}
        overlays
        initialActions={[
          { type: 'go-step', step: 'paint' },
          { type: 'toggle-unfold' },
          { type: 'paint-face', face: 'front' },
        ]}
      />,
    );
    expect(container.querySelector('[data-testid="unpainted-blink"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="unpainted-blink-title"]')?.textContent).toBe(
      '전개도에서 아직 세지 않은 면이 있을까요?',
    );
    expect(
      container
        .querySelector('[data-testid="unpainted-blink-face-front"]')
        ?.getAttribute('data-blink'),
    ).toBeNull();
    expect(
      container
        .querySelector('[data-testid="unpainted-blink-face-back"]')
        ?.getAttribute('data-blink'),
    ).toBe('true');
    expect(
      container.querySelectorAll('[data-testid^="unpainted-blink-face-"][data-blink="true"]'),
    ).toHaveLength(5);
    // 모션 줄임 환경(jsdom은 matchMedia가 없어 줄임으로 본다): 굵은 테두리, animate 없음
    expect(container.querySelector('[data-testid="unpainted-blink"] animate')).toBeNull();
  });

  it('unpainted-blink: 모두 칠했으면 null', () => {
    const { container } = render(
      <Harness
        config={{}}
        overlays
        initialActions={[
          { type: 'go-step', step: 'paint' },
          { type: 'toggle-unfold' },
          ...FACES.map((face): SolidAction => ({ type: 'paint-face', face })),
        ]}
      />,
    );
    expect(container.querySelector('[data-testid="unpainted-blink"]')).toBeNull();
  });

  it('wrap-vs-fill·unit-zoom은 sv 모드에서 그려지고 문구에 개수 결과가 없다', () => {
    const { container } = render(<Harness config={{}} overlays />);
    const wrap = container.querySelector('[data-testid="wrap-vs-fill"]');
    expect(wrap).toBeTruthy();
    expect(container.querySelector('[data-testid="wrap-vs-fill-wrap"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="wrap-vs-fill-fill"]')).toBeTruthy();
    expect(wrap?.textContent).toContain('상자를 감싸는 양일까요, 채우는 양일까요?');
    const zoom = container.querySelector('[data-testid="unit-zoom"]');
    expect(zoom).toBeTruthy();
    expect(zoom?.textContent).toContain('한 줄에 몇 개, 한 층에는 몇 줄, 몇 층일까요?');
    expect(container.querySelector('[data-testid="unit-zoom-length"]')?.textContent).toBe(
      '1m = 100cm',
    );
    expect(container.querySelectorAll('[data-testid="unit-zoom-arrow"]')).toHaveLength(2);
    for (const el of [wrap, zoom]) {
      expect(el?.textContent).not.toMatch(/(^|\D)(1000000|10000|1000)(\D|$)/);
    }
  });

  it('wraps-compare는 fixed-volume에서만 그리고 넓이 수를 쓰지 않는다', () => {
    const steps = render(<Harness config={{}} overlays />);
    expect(steps.container.querySelector('[data-testid="wraps-compare"]')).toBeNull();
    steps.unmount();
    const fixed = render(<Harness config={{ variant: 'fixed-volume', volume: 24 }} overlays />);
    const el = fixed.container.querySelector('[data-testid="wraps-compare"]');
    expect(el).toBeTruthy();
    expect(el?.textContent).toBe('두 상자의 포장지 크기를 칸으로 비교해 볼까요?');
    expect(fixed.container.querySelector('[data-testid="wraps-compare-long"]')).toBeTruthy();
    expect(fixed.container.querySelector('[data-testid="wraps-compare-best"]')).toBeTruthy();
    // 두 전개도 모두 면 여섯 개
    expect(
      fixed.container.querySelectorAll('[data-testid="wraps-compare-long"] > g > g'),
    ).toHaveLength(6);
    expect(
      fixed.container.querySelectorAll('[data-testid="wraps-compare-best"] > g > g'),
    ).toHaveLength(6);
  });

  it('다른 모드 상태에서는 네 오버레이 모두 그리지 않는다', () => {
    const other = createInitialState({});
    const cfg: SurfaceVolumeConfig = { mode: 'surface-volume' };
    const { container } = render(
      <div>
        <UnpaintedBlinkOverlay config={cfg} state={other} />
        <WrapVsFillOverlay config={cfg} state={other} />
        <UnitZoomOverlay config={cfg} state={other} />
        <WrapsCompareOverlay config={cfg} state={other} />
      </div>,
    );
    expect(container.querySelector('svg')).toBeNull();
  });
});
