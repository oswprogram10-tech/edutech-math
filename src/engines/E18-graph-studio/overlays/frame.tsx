/**
 * E18 오버레이 틀. core의 `CanvasAlignedOverlay`와 같이 본 캔버스 svg 자리에 맞추되,
 * 그래프 영역이 스크롤될 때(누르는 ○ 그래프) 다음 두 가지를 더 한다.
 * - 스크롤할 때마다 다시 재서 칸과 어긋나지 않게 한다.
 * - 스크롤 칸(그래프 영역) 밖으로 나간 부분은 잘라서 표·단추 위로 번지지 않게 한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface Frame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** 본 svg 상자 안에서 잘라 낼 크기(top right bottom left). */
  readonly clip: readonly [number, number, number, number];
}

function same(a: Frame | null, b: Frame | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5 &&
    a.clip.every((value, index) => Math.abs(value - (b.clip[index] ?? 0)) < 0.5)
  );
}

export interface GraphOverlayFrameProps {
  readonly testId?: string;
  readonly canvasSelector: string;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly children: ReactNode;
}

export function GraphOverlayFrame({
  testId,
  canvasSelector,
  logicalWidth,
  logicalHeight,
  children,
}: GraphOverlayFrameProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);

  const measure = useCallback(() => {
    const element = host.current;
    if (!element) return;
    // element = 오버레이 칸(inset 0) → OverlayLayer → 엔진 View와 오버레이를 함께 담는 판.
    const container = element.parentElement?.parentElement;
    const canvas = container?.querySelector(canvasSelector);
    if (!(canvas instanceof SVGSVGElement)) {
      setFrame((current) => (current === null ? current : null));
      return;
    }
    const hostBox = element.getBoundingClientRect();
    const box = canvas.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    const area = canvas.parentElement?.getBoundingClientRect() ?? box;
    const clip: [number, number, number, number] = [
      Math.max(0, area.top - box.top),
      Math.max(0, box.right - area.right),
      Math.max(0, box.bottom - area.bottom),
      Math.max(0, area.left - box.left),
    ];
    const next: Frame = {
      left: box.left - hostBox.left,
      top: box.top - hostBox.top,
      width: box.width,
      height: box.height,
      clip,
    };
    setFrame((current) => (same(current, next) ? current : next));
  }, [canvasSelector]);

  const hostRef = useCallback((node: HTMLDivElement | null) => {
    host.current = node;
  }, []);

  useEffect(() => {
    measure();
  });

  useEffect(() => {
    const container = host.current?.parentElement?.parentElement;
    const canvas = container?.querySelector(canvasSelector) ?? null;
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    if (container) observer?.observe(container);
    if (canvas) observer?.observe(canvas);
    window.addEventListener('resize', measure);
    // 그래프 영역·판 안쪽이 스크롤되면 본 svg도 함께 움직인다(캡처 단계라 안쪽 스크롤도 잡힌다).
    window.addEventListener('scroll', measure, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure, canvasSelector]);

  const clipped = frame ? frame.clip.some((value) => value > 0.5) : false;
  return (
    <div ref={hostRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        style={
          frame
            ? {
                position: 'absolute',
                left: frame.left,
                top: frame.top,
                width: frame.width,
                height: frame.height,
                clipPath: clipped
                  ? `inset(${frame.clip.map((value) => `${value}px`).join(' ')})`
                  : undefined,
              }
            : { position: 'absolute', inset: 0 }
        }
      >
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
