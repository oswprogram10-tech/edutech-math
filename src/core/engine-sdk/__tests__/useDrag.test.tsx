// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { DragInfo } from '../useDrag';
import { useDrag } from '../useDrag';
import { firePointer } from './pointer';

afterEach(cleanup);

function DragHarness({
  onEnd,
  disabled = false,
}: {
  onEnd: (info: DragInfo) => void;
  disabled?: boolean;
}) {
  const drag = useDrag({
    getPoint: (event) => ({ x: event.clientX, y: event.clientY }),
    onEnd,
    disabled,
  });
  return (
    <>
      <div data-testid="surface" {...drag.handlers} />
      <output data-testid="state">{drag.dragging ? 'dragging' : 'idle'}</output>
    </>
  );
}

describe('useDrag', () => {
  it('손을 뗄 때 한 번만 끝 좌표를 알려 준다', () => {
    const onEnd = vi.fn();
    render(<DragHarness onEnd={onEnd} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 10, clientY: 20 });
    expect(screen.getByTestId('state').textContent).toBe('dragging');
    firePointer(surface, 'pointermove', { clientX: 30, clientY: 40 });
    firePointer(surface, 'pointermove', { clientX: 50, clientY: 60 });
    expect(onEnd).not.toHaveBeenCalled();

    firePointer(surface, 'pointerup', { clientX: 50, clientY: 60 });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0]?.[0]).toMatchObject({
      start: { x: 10, y: 20 },
      current: { x: 50, y: 60 },
      delta: { x: 40, y: 40 },
    });
    expect(screen.getByTestId('state').textContent).toBe('idle');
  });

  it('다른 pointerId의 움직임은 무시한다', () => {
    const onEnd = vi.fn();
    render(<DragHarness onEnd={onEnd} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    firePointer(surface, 'pointermove', { pointerId: 2, clientX: 99, clientY: 99 });
    firePointer(surface, 'pointerup', { pointerId: 2, clientX: 99, clientY: 99 });

    expect(onEnd).not.toHaveBeenCalled();
    firePointer(surface, 'pointerup', { pointerId: 1, clientX: 5, clientY: 5 });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('보조 포인터·보조 버튼·읽기 전용에서는 시작하지 않는다', () => {
    const onEnd = vi.fn();
    render(<DragHarness onEnd={onEnd} disabled />);
    firePointer(screen.getByTestId('surface'), 'pointerdown', {});
    expect(screen.getByTestId('state').textContent).toBe('idle');

    cleanup();
    render(<DragHarness onEnd={onEnd} />);
    const surface = screen.getByTestId('surface');
    firePointer(surface, 'pointerdown', { isPrimary: false });
    expect(screen.getByTestId('state').textContent).toBe('idle');
    firePointer(surface, 'pointerdown', { button: 2 });
    expect(screen.getByTestId('state').textContent).toBe('idle');
  });
});
