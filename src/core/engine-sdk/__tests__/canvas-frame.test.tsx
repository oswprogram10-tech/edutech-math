// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CanvasAlignedOverlay } from '../canvas-frame';

const CANVAS_SELECTOR = 'svg[data-testid="test-canvas"]';

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function mockCanvas(box: DOMRect | null): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (box && this.getAttribute('data-testid') === 'test-canvas') return box;
    return rect(0, 0, 0, 0);
  });
}

function overlayBox(): HTMLElement {
  const svg = screen.getByTestId('overlay-test');
  return svg.parentElement as HTMLElement;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CanvasAlignedOverlay', () => {
  it('선택자로 찾은 본 캔버스 자리에 오버레이 상자를 맞춘다', () => {
    mockCanvas(rect(110, 60, 500, 300));
    render(
      <div>
        <svg data-testid="test-canvas" />
        <div>
          <CanvasAlignedOverlay
            testId="overlay-test"
            canvasSelector={CANVAS_SELECTOR}
            logicalWidth={1000}
            logicalHeight={600}
          >
            <circle cx={1} cy={1} r={1} />
          </CanvasAlignedOverlay>
        </div>
      </div>,
    );

    const box = overlayBox();
    expect(box.style.position).toBe('absolute');
    expect(box.style.left).toBe('110px');
    expect(box.style.top).toBe('60px');
    expect(box.style.width).toBe('500px');
    expect(box.style.height).toBe('300px');
  });

  it('본 캔버스를 찾지 못하면 칸 전체에 펼친다', () => {
    mockCanvas(null);
    render(
      <div>
        <div>
          <CanvasAlignedOverlay
            testId="overlay-test"
            canvasSelector={CANVAS_SELECTOR}
            logicalWidth={1000}
            logicalHeight={600}
          >
            <circle cx={1} cy={1} r={1} />
          </CanvasAlignedOverlay>
        </div>
      </div>,
    );

    const box = overlayBox();
    expect(box.style.position).toBe('absolute');
    expect(box.style.left).toBe('');
    expect(box.style.inset).not.toBe('');
  });

  it('오버레이 svg는 받은 논리 크기의 viewBox를 쓴다', () => {
    mockCanvas(null);
    render(
      <div>
        <div>
          <CanvasAlignedOverlay
            testId="overlay-test"
            canvasSelector={CANVAS_SELECTOR}
            logicalWidth={800}
            logicalHeight={480}
          >
            <circle cx={1} cy={1} r={1} />
          </CanvasAlignedOverlay>
        </div>
      </div>,
    );

    expect(screen.getByTestId('overlay-test').getAttribute('viewBox')).toBe('0 0 800 480');
  });
});
