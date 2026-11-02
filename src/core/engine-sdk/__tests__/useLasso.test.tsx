// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { LassoGesture } from '../useLasso';
import { useLasso } from '../useLasso';
import { firePointer } from './pointer';

afterEach(cleanup);

function LassoHarness({ onGesture }: { onGesture: (gesture: LassoGesture) => void }) {
  const lasso = useLasso({
    getPoint: (event) => ({ x: event.clientX, y: event.clientY }),
    onGesture,
    tapThreshold: 10,
  });
  return (
    <>
      <div data-testid="surface" {...lasso.handlers} />
      <output data-testid="points">{lasso.path.length}</output>
    </>
  );
}

describe('useLasso', () => {
  it('자유 곡선을 모아 손을 뗄 때 넘긴다', () => {
    const onGesture = vi.fn();
    render(<LassoHarness onGesture={onGesture} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 0, clientY: 0 });
    firePointer(surface, 'pointermove', { clientX: 100, clientY: 0 });
    firePointer(surface, 'pointermove', { clientX: 100, clientY: 100 });
    firePointer(surface, 'pointermove', { clientX: 0, clientY: 100 });
    expect(Number(screen.getByTestId('points').textContent)).toBeGreaterThan(2);

    firePointer(surface, 'pointerup', { clientX: 0, clientY: 0 });
    expect(onGesture).toHaveBeenCalledTimes(1);
    const gesture = onGesture.mock.calls[0]?.[0] as LassoGesture;
    expect(gesture.isTap).toBe(false);
    expect(gesture.points.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByTestId('points').textContent).toBe('0');
  });

  it('거의 움직이지 않으면 탭으로 알려 준다', () => {
    const onGesture = vi.fn();
    render(<LassoHarness onGesture={onGesture} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 50, clientY: 50 });
    firePointer(surface, 'pointerup', { clientX: 52, clientY: 51 });

    expect(onGesture).toHaveBeenCalledTimes(1);
    const gesture = onGesture.mock.calls[0]?.[0] as LassoGesture;
    expect(gesture.isTap).toBe(true);
    expect(gesture.points).toEqual([{ x: 52, y: 51 }]);
  });

  it('취소하면 아무것도 넘기지 않고 경로를 지운다', () => {
    const onGesture = vi.fn();
    render(<LassoHarness onGesture={onGesture} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 0, clientY: 0 });
    firePointer(surface, 'pointermove', { clientX: 50, clientY: 50 });
    firePointer(surface, 'pointercancel', {});

    expect(onGesture).not.toHaveBeenCalled();
    expect(screen.getByTestId('points').textContent).toBe('0');
  });
});
