/**
 * SVG 교구의 터치 타깃 크기 계산.
 *
 * 엔진 상태의 반지름은 논리 좌표라서, 화면에서 실제로 몇 px인지는 SVG가 그려진
 * 크기에 따라 달라진다. 좁은 화면에서도 조작 요소의 지름이 targetSize 이상이 되도록
 * 화면 크기 → 논리 좌표 비율을 구한다.
 */
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { LogicalSize } from './coordinates';
import type { TargetSize } from './types';

const EMPTY_SIZE: LogicalSize = { width: 0, height: 0 };

/**
 * SVG viewBox가 화면에 그려질 때의 배율.
 * `preserveAspectRatio` 기본값(meet)처럼 가로·세로 중 작은 쪽을 쓴다.
 */
export function svgScaleFactor(rendered: LogicalSize, logical: LogicalSize): number {
  if (rendered.width <= 0 || rendered.height <= 0 || logical.width <= 0 || logical.height <= 0) {
    return 0;
  }
  return Math.min(rendered.width / logical.width, rendered.height / logical.height);
}

/** 화면 px를 논리 좌표 길이로 바꾼다. 아직 크기를 모르면 0. */
export function screenPixelsToLogical(
  pixels: number,
  rendered: LogicalSize,
  logical: LogicalSize,
): number {
  const scale = svgScaleFactor(rendered, logical);
  return scale > 0 ? pixels / scale : 0;
}

/**
 * 화면에서 지름이 targetSize(px) 이상이 되는 최소 논리 반지름.
 * 엔진은 `Math.ceil(minTouchRadius(...))`를 기본 반지름과 비교해 쓴다.
 */
export function minTouchRadius(
  targetSize: TargetSize,
  rendered: LogicalSize,
  logical: LogicalSize,
): number {
  return screenPixelsToLogical(targetSize / 2, rendered, logical);
}

/**
 * 요소의 실제 렌더링 크기(CSS px)를 추적한다.
 * ResizeObserver가 없는 환경(테스트·구형 브라우저)은 window resize로 대체한다.
 */
export function useRenderedSize<T extends Element>(ref: RefObject<T | null>): LogicalSize {
  const [size, setSize] = useState<LogicalSize>(EMPTY_SIZE);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      setSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        update(entry.contentRect.width, entry.contentRect.height);
      });
      observer.observe(element);
      return () => observer.disconnect();
    }

    const updateFromRect = () => {
      const rect = element.getBoundingClientRect();
      update(rect.width, rect.height);
    };
    const frame = requestAnimationFrame(updateFromRect);
    window.addEventListener('resize', updateFromRect);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateFromRect);
    };
  }, [ref]);

  return size;
}
