/**
 * 힌트 ② 오버레이를 엔진의 본 캔버스 svg와 같은 자리·크기에 놓기 위한 공용 도우미.
 *
 * 실행기(ActivityRunner)는 오버레이를 엔진 칸 전체(버튼·안내 문구 포함) 위에
 * `inset: 0`으로 펼친다. 그래서 오버레이 svg에 viewBox 1000×600을 그대로 펴면
 * 본 캔버스 svg보다 큰 상자에 그려져 엔진 그림과 어긋난다.
 *
 * 오버레이 상자 안에서 본 캔버스 svg(`canvasSelector`)를 찾아
 * getBoundingClientRect 차이만큼 옮기고 같은 크기로 맞춘다. 두 svg의 viewBox와
 * preserveAspectRatio가 같으므로 논리 좌표가 화면에서도 정확히 겹친다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export interface CanvasFrame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function sameFrame(a: CanvasFrame | null, b: CanvasFrame | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function useCanvasFrame(canvasSelector: string): {
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
    const canvas = container?.querySelector(canvasSelector);
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
  }, [canvasSelector]);

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
    const canvas = container?.querySelector(canvasSelector) ?? null;
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
  }, [measure, canvasSelector]);

  return { hostRef, frame };
}

export interface CanvasAlignedOverlayProps {
  /** 기존 오버레이 svg가 쓰던 `data-testid`. 없으면 붙이지 않는다. */
  readonly testId?: string;
  /** 본 캔버스 svg를 찾을 선택자(예: `svg[data-testid="base-ten-canvas"]`). */
  readonly canvasSelector: string;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly children: ReactNode;
}

/**
 * 본 캔버스 svg 자리에 맞춘 오버레이 svg.
 * 본 svg를 찾지 못하면(엔진을 숨긴 과제의 힌트 칸) 예전처럼 칸 전체에 펼친다.
 */
export function CanvasAlignedOverlay({
  testId,
  canvasSelector,
  logicalWidth,
  logicalHeight,
  children,
}: CanvasAlignedOverlayProps) {
  const { hostRef, frame } = useCanvasFrame(canvasSelector);
  const box: CSSProperties = frame
    ? {
        position: 'absolute',
        left: frame.left,
        top: frame.top,
        width: frame.width,
        height: frame.height,
      }
    : { position: 'absolute', inset: 0 };
  return (
    <div ref={hostRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={box}>
        <svg
          viewBox={`0 0 ${logicalWidth} ${logicalHeight}`}
          width="100%"
          height="100%"
          data-testid={testId}
          aria-hidden="true"
          style={{ display: 'block' }}
        >
          {children}
        </svg>
      </div>
    </div>
  );
}
