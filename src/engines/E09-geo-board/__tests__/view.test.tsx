/** @vitest-environment jsdom */
/** E09 화면 테스트: 기본 설정에서 도형 이름·개수 같은 정답 단서가 DOM에 없다. */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../reduce';
import type { GeoConfig } from '../types';
import { GeoView } from '../View';

afterEach(cleanup);

function textOf(config: GeoConfig): string {
  const state = createInitialState(config);
  return (
    render(
      <GeoView
        config={config}
        state={state}
        dispatch={() => {}}
        cpa="C"
        mode={state.mode}
        targetSize={48}
      />,
    ).container.textContent ?? ''
  );
}

describe('E09 기본 화면은 정답 단서를 쓰지 않는다', () => {
  it('geoboard 기본 설정에 "꼭짓점"·"삼각형"·"사각형"이 없다', () => {
    const text = textOf({ mode: 'geoboard' });
    expect(text).not.toContain('꼭짓점');
    expect(text).not.toContain('삼각형');
    expect(text).not.toContain('사각형');
  });

  it('construct 기본 설정에도 도형 이름이 없다', () => {
    const text = textOf({ mode: 'construct' });
    expect(text).not.toContain('꼭짓점');
    expect(text).not.toContain('삼각형');
    expect(text).not.toContain('사각형');
  });

  it('showCounts: always일 때만 개수를 쓰고 도형 이름은 여전히 쓰지 않는다', () => {
    const text = textOf({
      mode: 'geoboard',
      showCounts: 'always',
      shapes: [
        [
          [0, 0],
          [2, 0],
          [0, 2],
        ],
      ],
    });
    expect(text).toContain('꼭짓점 3개');
    expect(text).not.toContain('삼각형');
    expect(text).not.toContain('사각형');
  });
});
