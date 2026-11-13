/**
 * 3D 무대 힌트 ② 오버레이 크기·좌표 계산 도우미.
 */
import { useCallback, useEffect, useState } from 'react';
import type { RendererKind } from '../renderer';

export const CUBE_CANVAS_SELECTOR =
  'svg[data-testid="cubes-canvas"], svg[data-testid="cubes-3d-canvas"]';

export interface HelperOverlayMetrics {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
}

function read3dCanvasRect(): { readonly width: number; readonly height: number } | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector('svg[data-testid="cubes-3d-canvas"]');
  if (!(el instanceof SVGSVGElement)) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  return { width: rect.width, height: rect.height };
}

/** 3D 무대에서는 `cubes-3d-canvas` 실제 화면 크기를 따라가 왼쪽 위 여백이 가운데로 밀리지 않게 한다. */
export function useHelperOverlayMetrics(
  activeRenderer: RendererKind,
  fallbackWidth: number,
  fallbackHeight: number,
): HelperOverlayMetrics {
  const [box, setBox] = useState<{ readonly width: number; readonly height: number } | null>(() =>
    activeRenderer === '3d' ? read3dCanvasRect() : null,
  );

  const measure = useCallback(() => {
    const next = activeRenderer === '3d' ? read3dCanvasRect() : null;
    setBox((prev) => {
      if (next === null) return prev === null ? prev : null;
      if (
        prev &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5
      ) {
        return prev;
      }
      return next;
    });
  }, [activeRenderer]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raf = window.requestAnimationFrame(measure);
    if (activeRenderer !== '3d' || typeof document === 'undefined') {
      return () => window.cancelAnimationFrame(raf);
    }
    const el = document.querySelector('svg[data-testid="cubes-3d-canvas"]');
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    if (el) observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [activeRenderer, measure]);

  if (activeRenderer === '3d' && box) {
    return { logicalWidth: box.width, logicalHeight: box.height };
  }
  return { logicalWidth: fallbackWidth, logicalHeight: fallbackHeight };
}
