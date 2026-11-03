/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 별 컴포넌트를 가짜로 바꿔 렌더 횟수만 센다.
 * 확대·이동은 부모(StarMapView)만 다시 그려야 하고, 별은 다시 그리면 안 된다.
 */
const renderState = vi.hoisted(() => ({ count: 0 }));

vi.mock('../ConceptStar', async () => {
  const React = await import('react');
  const ConceptStar = React.memo(function MockConceptStar() {
    renderState.count += 1;
    return React.createElement('g');
  });
  return { ConceptStar };
});

import type { StarMapLayout } from '../layout';
import { StarMapView } from '../StarMapView';

afterEach(() => {
  cleanup();
  renderState.count = 0;
});

const layout: StarMapLayout = {
  width: 1000,
  height: 1000,
  stars: [
    { index: 0, conceptId: 'c1', unitId: 'u1', label: '개념 하나', x: 100, y: 100 },
    { index: 1, conceptId: 'c2', unitId: 'u1', label: '개념 둘', x: 160, y: 100 },
    { index: 2, conceptId: 'c3', unitId: 'u1', label: '개념 셋', x: 220, y: 100 },
  ],
  units: [],
  links: [],
  zones: [],
};

describe('StarMapView 렌더 횟수', () => {
  it('확대·화살표 이동·처음 보기에서 별을 다시 렌더하지 않는다', () => {
    render(
      <StarMapView
        layout={layout}
        brightness={new Map()}
        sparkle={new Set()}
        enabledUnits={new Set(['u1'])}
        activitiesByConcept={new Map()}
        targetSize={48}
        onOpenActivity={() => {}}
      />,
    );

    expect(renderState.count).toBe(3);
    renderState.count = 0;

    const canvas = screen.getByTestId('map-canvas');

    fireEvent.click(screen.getByRole('button', { name: '확대' }));
    fireEvent.click(screen.getByRole('button', { name: '축소' }));
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    fireEvent.keyDown(canvas, { key: 'ArrowUp' });
    fireEvent.click(screen.getByRole('button', { name: '처음 보기' }));

    expect(screen.getByTestId('map-zoom').textContent).toBe('400%');
    expect(renderState.count).toBe(0);
  });
});
