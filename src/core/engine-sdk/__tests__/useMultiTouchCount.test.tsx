// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useMultiTouchCount } from '../useMultiTouchCount';
import { firePointer } from './pointer';

afterEach(cleanup);

function MultiTouchHarness() {
  const multi = useMultiTouchCount();
  return (
    <div data-testid="surface" {...multi.handlers}>
      <output data-testid="count">{multi.count}</output>
      <output data-testid="max">{multi.maxCount}</output>
      <button type="button" onClick={multi.reset}>
        초기화
      </button>
    </div>
  );
}

describe('useMultiTouchCount', () => {
  it('동시에 눌린 손가락 수와 최대치를 센다', () => {
    render(<MultiTouchHarness />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { pointerId: 1 });
    firePointer(surface, 'pointerdown', { pointerId: 2 });
    firePointer(surface, 'pointerdown', { pointerId: 3 });
    expect(screen.getByTestId('count').textContent).toBe('3');
    expect(screen.getByTestId('max').textContent).toBe('3');

    firePointer(surface, 'pointerup', { pointerId: 2 });
    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(screen.getByTestId('max').textContent).toBe('3');
  });

  it('취소와 초기화를 처리한다', () => {
    render(<MultiTouchHarness />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { pointerId: 1 });
    firePointer(surface, 'pointercancel', { pointerId: 1 });
    expect(screen.getByTestId('count').textContent).toBe('0');

    firePointer(surface, 'pointerdown', { pointerId: 1 });
    firePointer(surface, 'pointerup', { pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('max').textContent).toBe('0');
  });
});
