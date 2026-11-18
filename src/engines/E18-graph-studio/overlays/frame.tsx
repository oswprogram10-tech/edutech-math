/**
 * E18 오버레이 틀. core의 `CanvasAlignedOverlay`와 같이 본 캔버스 svg 자리에 맞추되,
 * 그래프 영역이 스크롤될 때(누르는 ○ 그래프) 다음 두 가지를 더 한다.
 * - 스크롤할 때마다 다시 재서 칸과 어긋나지 않게 한다.
 * - 스크롤 칸(그래프 영역) 밖으로 나간 부분은 잘라서 표·단추 위로 번지지 않게 한다.
 *   (본 svg 위쪽 조상 중 넘침을 자르는 칸이 있으면 모두 겹친 영역 밖을 자른다.)
 * - 그림그래프처럼 그림 크기를 화면 폭에 맞춰 정하는 캔버스는 `data-logical-width`·`data-logical-height`·
 *   `data-icon-side` 속성으로 자기 크기를 알린다. 이때는 children을 함수로 주면 그 값을 받는다.
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
  /** 캔버스가 알린 논리 크기와 작은 그림 한 변(없으면 null). */
  readonly info: CanvasInfo | null;
}

export interface CanvasInfo {
  readonly width: number;
  readonly height: number;
  readonly icon: number;
}

function infoOf(canvas: Element): CanvasInfo | null {
  const width = Number(canvas.getAttribute('data-logical-width'));
  const height = Number(canvas.getAttribute('data-logical-height'));
  const icon = Number(canvas.getAttribute('data-icon-side'));
  if (!(width > 0) || !(height > 0)) return null;
  return { width, height, icon: icon > 0 ? icon : 0 };
}

function sameInfo(a: CanvasInfo | null, b: CanvasInfo | null): boolean {
  if (a === null || b === null) return a === b;
  return a.width === b.width && a.height === b.height && a.icon === b.icon;
}

function same(a: Frame | null, b: Frame | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5 &&
    a.clip.every((value, index) => Math.abs(value - (b.clip[index] ?? 0)) < 0.5) &&
    sameInfo(a.info, b.info)
  );
}

export interface GraphOverlayFrameProps {
  readonly testId?: string;
  readonly canvasSelector: string;
  readonly logicalWidth?: number;
  readonly logicalHeight?: number;
  readonly children: ReactNode | ((info: CanvasInfo) => ReactNode);
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
    // 본 svg의 조상 중 넘침을 자르는 칸(overflow가 visible이 아닌 것)을 모두 겹친 영역.
    let area = { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
    let clipped = false;
    for (let node = canvas.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
        const rect = node.getBoundingClientRect();
        area = clipped
          ? {
              top: Math.max(area.top, rect.top),
              right: Math.min(area.right, rect.right),
              bottom: Math.min(area.bottom, rect.bottom),
              left: Math.max(area.left, rect.left),
            }
          : { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
        clipped = true;
      }
      if (node === container) break;
    }
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
      info: infoOf(canvas),
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
  const info = frame?.info ?? null;
  const viewWidth = info?.width ?? logicalWidth ?? 1000;
  const viewHeight = info?.height ?? logicalHeight ?? 700;
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
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          width="100%"
          height="100%"
          data-testid={testId}
          aria-hidden="true"
          style={{ display: 'block' }}
        >
          {typeof children === 'function' ? (info ? children(info) : null) : children}
        </svg>
      </div>
    </div>
  );
}
