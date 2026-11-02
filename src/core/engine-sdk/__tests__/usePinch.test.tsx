// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { clampScale, pinchScale, usePinch } from '../usePinch';
import { firePointer } from './pointer';

afterEach(cleanup);

function PinchHarness() {
  const pinch = usePinch({ min: 1, max: 3, step: 0.25 });
  return (
    <div data-testid="surface" {...pinch.handlers}>
      <output data-testid="scale">{pinch.scale}</output>
      <button type="button" onClick={pinch.zoomIn}>
        확대
      </button>
      <button type="button" onClick={pinch.zoomOut}>
        축소
      </button>
    </div>
  );
}

describe('usePinch', () => {
  it('버튼으로 확대·축소하고 범위를 지킨다', () => {
    render(<PinchHarness />);
    const scale = screen.getByTestId('scale');
    expect(scale.textContent).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: '확대' }));
    expect(scale.textContent).toBe('1.25');
    for (let i = 0; i < 20; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: '확대' }));
    }
    expect(scale.textContent).toBe('3');
    expect(screen.getByRole('button', { name: '확대' })).toBeDefined();
  });

  it('Ctrl+휠로만 확대한다', () => {
    render(<PinchHarness />);
    const surface = screen.getByTestId('surface');
    fireEvent.wheel(surface, { deltaY: -1 });
    expect(screen.getByTestId('scale').textContent).toBe('1');

    fireEvent.wheel(surface, { deltaY: -1, ctrlKey: true });
    expect(screen.getByTestId('scale').textContent).toBe('1.25');
  });

  it('두 손가락 거리 비율로 확대한다', () => {
    render(<PinchHarness />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    firePointer(surface, 'pointerdown', { pointerId: 2, clientX: 100, clientY: 0 });
    firePointer(surface, 'pointermove', { pointerId: 2, clientX: 200, clientY: 0 });
    expect(screen.getByTestId('scale').textContent).toBe('2');

    firePointer(surface, 'pointerup', { pointerId: 2 });
    firePointer(surface, 'pointermove', { pointerId: 1, clientX: 50, clientY: 0 });
    expect(screen.getByTestId('scale').textContent).toBe('2');
  });

  it('순수 계산도 경계값을 지킨다', () => {
    expect(pinchScale(100, 200, 1)).toBe(2);
    expect(pinchScale(0, 200, 1)).toBe(1);
    expect(clampScale(5, 1, 2)).toBe(2);
    expect(clampScale(0, 1, 2)).toBe(1);
  });
});
