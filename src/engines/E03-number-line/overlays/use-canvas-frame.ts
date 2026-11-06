/**
 * 힌트 ② 오버레이를 엔진의 본 수직선 svg와 같은 자리·크기에 놓기 위한 측정 훅.
 *
 * 실행기(ActivityRunner)는 오버레이를 엔진 칸 전체(점프 버튼·기록 줄·안내 문구 포함) 위에
 * `inset: 0`으로 펼친다. 그래서 오버레이 svg에 viewBox 1000×600을 그대로 펴면
 * 본 수직선 svg보다 큰 상자에 그려져 눈금과 어긋난다.
 *
 * 오버레이 상자 안에서 본 수직선 svg(`data-testid="number-line-canvas"`)를 찾아
 * getBoundingClientRect 차이만큼 옮기고 같은 크기로 맞춘다. 두 svg의 viewBox와
 * preserveAspectRatio가 같으므로 논리 좌표가 화면에서도 정확히 겹친다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface CanvasFrame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

const CANVAS_SELECTOR = 'svg[data-testid="number-line-canvas"]';

function sameFrame(a: CanvasFrame | null, b: CanvasFrame | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

export function useCanvasFrame(): {
  readonly hostRef: (node: HTMLDivElement | null) => void;
  readonly frame: CanvasFrame | null;
} {
  const [frame, setFrame] = useState<CanvasFrame | null>(null);
  const host = useRef<HTMLDivElement | null>(null);

  const measure = useCallback(() => {
    const element = host.current;
    if (!element) return;
    // element = 오버레이 칸 전체(inset 0) → 부모 = OverlayLayer(inset 0) → 부모의 부모가
    // 엔진 View와 오버레이를 함께 담는 실행기 패널(또는 샌드박스 판)이다.
    const container = element.parentElement?.parentElement;
    const canvas = container?.querySelector(CANVAS_SELECTOR);
    if (!(canvas instanceof SVGSVGElement)) {
      setFrame((current) => (current === null ? current : null));
      return;
    }
    const hostBox = element.getBoundingClientRect();
    const canvasBox = canvas.getBoundingClientRect();
    if (canvasBox.width < 1 || canvasBox.height < 1) return;
    const next: CanvasFrame = {
      left: canvasBox.left - hostBox.left,
      top: canvasBox.top - hostBox.top,
      width: canvasBox.width,
      height: canvasBox.height,
    };
    setFrame((current) => (sameFrame(current, next) ? current : next));
  }, []);

  const hostRef = useCallback((node: HTMLDivElement | null) => {
    host.current = node;
  }, []);

  // 힌트가 나타나거나 상태가 바뀌어 본 svg 위치가 달라질 수 있으므로 매 렌더 뒤 다시 잰다.
  useEffect(() => {
    measure();
  });

  useEffect(() => {
    const element = host.current;
    const container = element?.parentElement?.parentElement;
    const canvas = container?.querySelector(CANVAS_SELECTOR) ?? null;
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    if (container) observer?.observe(container);
    if (canvas) observer?.observe(canvas);
    window.addEventListener('resize', measure);
    // 실행기 판 안쪽(.viewport)이 스크롤되면 본 svg도 함께 움직인다.
    window.addEventListener('scroll', measure, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  return { hostRef, frame };
}
