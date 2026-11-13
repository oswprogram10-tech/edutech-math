/**
 * E12 렌더러 결정·WebGL 감지·성능 저장·오버레이용 활성 렌더러 저장소.
 *
 * three·@react-three/fiber는 절대 import하지 않는다(번들 경계 규칙).
 * 렌더러 선택은 기기 사정이므로 엔진 상태(CubesState)·Observation에 넣지 않는다.
 */
import { useSyncExternalStore } from 'react';
import type { StageMode } from './types';

export const RENDERER_STORAGE_KEY = 'mathexplorer.e12.renderer.v1';

export type RendererKind = 'isometric' | '3d';
export type RendererDecision = RendererKind | 'probe';

export interface DecideRendererInput {
  readonly configStage: StageMode;
  readonly webgl: boolean;
  readonly stored: RendererKind | null;
  readonly probeFps: number | null;
}

/** 설정·WebGL 가능 여부·저장된 측정 결과·측정 fps로 렌더러를 고르는 순수 함수. */
export function decideRenderer({
  configStage,
  webgl,
  stored,
  probeFps,
}: DecideRendererInput): RendererDecision {
  if (!webgl) return 'isometric';
  if (configStage === 'isometric') return 'isometric';
  if (configStage === '3d') return '3d';
  if (stored === '3d' || stored === 'isometric') return stored;
  if (probeFps === null) return 'probe';
  return probeFps >= 30 ? '3d' : 'isometric';
}

let cachedWebGL: boolean | null = null;

export function resetWebGLCache(): void {
  cachedWebGL = null;
}

/** 현재 환경에서 WebGL2 또는 WebGL 컨텍스트를 만들 수 있는지 한 번 확인해 캐시한다. */
export function detectWebGL(): boolean {
  if (cachedWebGL !== null) return cachedWebGL;
  if (typeof document === 'undefined') {
    cachedWebGL = false;
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (gl && 'getExtension' in gl && typeof gl.getExtension === 'function') {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    cachedWebGL = gl !== null;
    return cachedWebGL;
  } catch {
    cachedWebGL = false;
    return false;
  }
}

export function readStoredRenderer(): RendererKind | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(RENDERER_STORAGE_KEY);
    if (value === '3d' || value === 'isometric') return value;
    return null;
  } catch {
    return null;
  }
}

export function writeStoredRenderer(renderer: RendererKind): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RENDERER_STORAGE_KEY, renderer);
  } catch {
    // 저장소 접근이 막힌 환경(사생활 보호 모드 등)에서는 조용히 무시한다.
  }
}

let activeRenderer: RendererKind = 'isometric';
const listeners = new Set<() => void>();

export function setActiveRenderer(renderer: RendererKind): void {
  if (activeRenderer === renderer) return;
  activeRenderer = renderer;
  for (const listener of listeners) {
    listener();
  }
}

export function getActiveRenderer(): RendererKind {
  return activeRenderer;
}

function subscribeActiveRenderer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 힌트 ② 오버레이가 현재 그려지는 무대 종류(`'isometric'` | `'3d'`)를 구독한다. */
export function useActiveRenderer(): RendererKind {
  return useSyncExternalStore(subscribeActiveRenderer, getActiveRenderer, () => 'isometric');
}
