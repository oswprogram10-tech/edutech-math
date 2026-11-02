// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { OverlayLayer } from '../overlay';
import demo from '../../../engines/E00-demo';

afterEach(cleanup);

describe('OverlayLayer', () => {
  it('엔진이 제공한 오버레이를 그린다', () => {
    const state = demo.createInitialState({});
    render(<OverlayLayer definition={demo} overlay="lasso-guide" config={{}} state={state} />);
    expect(screen.getByTestId('overlay-lasso-guide')).toBeDefined();
  });

  it('없는 이름이면 아무것도 그리지 않는다', () => {
    const state = demo.createInitialState({});
    const { container } = render(
      <OverlayLayer definition={demo} overlay="missing" config={{}} state={state} />,
    );
    expect(container.querySelector('[data-overlay]')).toBeNull();
  });
});
