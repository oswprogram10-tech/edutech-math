/** @vitest-environment jsdom */
/** E12 3D 렌더러 결정·카메라 좌표·오버레이 보조 그림·색상 무늬 단위 테스트. */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { observe } from '../observe';
import { HiddenRevealOverlay } from '../overlays/hidden-reveal';
import { RowLineupOverlay } from '../overlays/row-lineup';
import { SideEyeOverlay } from '../overlays/side-eye';
import { createInitialState, reduce } from '../reduce';
import {
  RENDERER_STORAGE_KEY,
  decideRenderer,
  readStoredRenderer,
  setActiveRenderer,
  writeStoredRenderer,
} from '../renderer';
import {
  ISO_POLAR_RAD,
  MAX_POLAR_RAD,
  azimuthFor,
  computeFitZoom,
  targetAnglesForPreset,
  toWorld,
} from '../three/camera';
import type { CubesState, SolidConfig } from '../types';
import { SolidView } from '../View';

afterEach(() => {
  cleanup();
  setActiveRenderer('isometric');
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('decideRenderer 순수 분기', () => {
  it('WebGL이 없으면 설정과 상관없이 등각 2D를 고른다', () => {
    expect(decideRenderer({ configStage: '3d', webgl: false, stored: '3d', probeFps: 60 })).toBe(
      'isometric',
    );
    expect(
      decideRenderer({ configStage: 'auto', webgl: false, stored: null, probeFps: null }),
    ).toBe('isometric');
  });

  it('설정 stage가 isometric 또는 3d면 저장/측정값보다 우선한다', () => {
    expect(
      decideRenderer({ configStage: 'isometric', webgl: true, stored: '3d', probeFps: 60 }),
    ).toBe('isometric');
    expect(
      decideRenderer({ configStage: '3d', webgl: true, stored: 'isometric', probeFps: 10 }),
    ).toBe('3d');
  });

  it('auto일 때 저장값 → probe → fps(30 기준) 순서로 결정한다', () => {
    expect(decideRenderer({ configStage: 'auto', webgl: true, stored: '3d', probeFps: null })).toBe(
      '3d',
    );
    expect(
      decideRenderer({ configStage: 'auto', webgl: true, stored: 'isometric', probeFps: 60 }),
    ).toBe('isometric');
    expect(decideRenderer({ configStage: 'auto', webgl: true, stored: null, probeFps: null })).toBe(
      'probe',
    );
    expect(decideRenderer({ configStage: 'auto', webgl: true, stored: null, probeFps: 30 })).toBe(
      '3d',
    );
    expect(decideRenderer({ configStage: 'auto', webgl: true, stored: null, probeFps: 29.9 })).toBe(
      'isometric',
    );
  });
});

describe('localStorage 예외 안전성', () => {
  it('localStorage 접근이 예외를 던져도 깨지지 않고 null 반환 / 무시한다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(readStoredRenderer()).toBeNull();
    expect(() => writeStoredRenderer('3d')).not.toThrow();
  });

  it('잘못된 문자열이 저장되어 있으면 null을 돌려준다', () => {
    window.localStorage.setItem(RENDERER_STORAGE_KEY, 'unknown');
    expect(readStoredRenderer()).toBeNull();
    writeStoredRenderer('3d');
    expect(readStoredRenderer()).toBe('3d');
  });
});

describe('3D 카메라·좌표 순수 계산', () => {
  it('toWorld는 (0,0,0), 정중앙, (cols-1,rows-1), 직사각형 격자를 정확히 변환한다', () => {
    expect(toWorld(0, 0, 0, [5, 5])).toEqual([-2, 0.5, 2]);
    expect(toWorld(2, 2, 0, [5, 5])).toEqual([0, 0.5, 0]);
    expect(toWorld(4, 3, 2, [5, 4])).toEqual([2, 2.5, -1.5]);
  });

  it('azimuthFor는 turn 0에서 앞-오른쪽(+π/4)이고 회전마다 90°씩 돈다', () => {
    expect(azimuthFor(0)).toBeCloseTo(Math.PI / 4, 8);
    expect(azimuthFor(1)).toBeCloseTo(-Math.PI / 4, 8);
    expect(azimuthFor(2)).toBeCloseTo((-3 * Math.PI) / 4, 8);
    expect(azimuthFor(3)).toBeCloseTo((-5 * Math.PI) / 4, 8);
  });

  it('시점 프리셋은 등각 각도와 최대 극각 제약을 만족한다', () => {
    const iso = targetAnglesForPreset('iso', 0);
    expect(iso.polar).toBeCloseTo(ISO_POLAR_RAD, 8);
    expect(targetAnglesForPreset('front', 0).polar).toBeLessThanOrEqual(MAX_POLAR_RAD);
    expect(targetAnglesForPreset('side', 0).polar).toBeLessThanOrEqual(MAX_POLAR_RAD);
    expect(computeFitZoom(400, 400, 5, 5, 5)).toBeGreaterThan(12);
  });
});

describe('렌더러와 엔진 상태/Observation 분리', () => {
  it('createInitialState·reduce·observe에 활성 렌더러나 fps가 들어가지 않는다', () => {
    const config: SolidConfig = { stage: '3d', initial: [{ at: [0, 0, 0], color: 'red' }] };
    const s0 = createInitialState(config);
    const s1 = reduce(s0, { type: 'add', x: 1, y: 0 });
    const obs = observe(s1);

    expect('renderer' in s1).toBe(false);
    expect('probeFps' in s1).toBe(false);
    expect('renderer' in obs).toBe(false);
    expect('stage' in obs).toBe(false);
    expect('probeFps' in obs).toBe(false);
  });

  it('jsdom(WebGL 없음)에서 stage가 3d여도 등각 2D로 폴백하고 색 무늬를 세 면에 그린다', () => {
    const config: SolidConfig = {
      stage: '3d',
      colorHints: true,
      initial: [
        { at: [0, 0, 0], color: 'red' },
        { at: [1, 0, 0], color: 'blue' },
      ],
    };
    const state = createInitialState(config);
    const { getByTestId, container } = render(
      <SolidView
        config={config}
        state={state}
        dispatch={() => undefined}
        cpa="C"
        mode="cubes"
        targetSize={48}
      />,
    );
    expect(getByTestId('cubes-stage').getAttribute('data-renderer')).toBe('isometric');
    expect(getByTestId('cubes-canvas')).not.toBeNull();
    // 색깔 있는 쌓기나무는 윗·앞·오른쪽 면 3개 + 각 면의 무늬 3개 = polygon 6개
    expect(container.querySelectorAll('[data-cube="0,0,0"] polygon')).toHaveLength(6);
  });
});

describe('3D 모드 힌트 ② 도움 그림 상자', () => {
  it('활성 렌더러가 3d면 오버레이 세 가지 모두 왼쪽 위 도움 그림 상자에 담긴다', () => {
    const config: SolidConfig = {
      grid: [2, 2],
      maxHeight: 2,
      initial: [
        { at: [0, 0, 0] },
        { at: [0, 0, 1] },
        { at: [1, 0, 0] },
        { at: [1, 0, 1] },
        { at: [0, 1, 0] },
        { at: [0, 1, 1] },
        { at: [1, 1, 0] },
        { at: [1, 1, 1] },
      ],
    };
    const state = createInitialState(config) as CubesState;

    const canvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    canvas.setAttribute('data-testid', 'cubes-3d-canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 400,
      width: 400,
      height: 400,
      toJSON: () => ({}),
    });
    document.body.appendChild(canvas);

    act(() => {
      setActiveRenderer('3d');
    });

    const overlays = [
      <HiddenRevealOverlay key="h" config={config} state={state} />,
      <SideEyeOverlay key="s" config={config} state={state} />,
      <RowLineupOverlay key="r" config={config} state={state} args={{ x: 0 }} />,
    ];

    for (const overlay of overlays) {
      const { getByTestId, unmount } = render(overlay);
      const box = getByTestId('cubes-helper-diagram');
      expect(box.textContent).toContain('도움 그림');
      unmount();
    }

    canvas.remove();
  });
});
