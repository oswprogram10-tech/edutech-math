/** @vitest-environment jsdom */
/** T102 화면 테스트: 기본 화면과 snapDiameter 없이 정답 단서를 쓰지 않는다. */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { GeoAction, GeoConfig, GeoState } from '../types';
import { createInitialState, reduce } from '../reduce';
import { GeoView } from '../View';

afterEach(cleanup);

function textOf(config: GeoConfig, actions: readonly GeoAction[] = []): string {
  const state: GeoState = actions.reduce<GeoState>(
    (value, action) => reduce(value, action),
    createInitialState(config),
  );
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

describe('E09 T102 기본 화면은 정답 단서를 쓰지 않는다', () => {
  it('circle 기본 설정에 지름·반지름 글자가 없다', () => {
    const text = textOf({ mode: 'circle' });
    expect(text).not.toContain('지름');
    expect(text).not.toContain('반지름');
  });

  it('angle 기본 설정에 각 종류와 50이 없다', () => {
    const text = textOf({ mode: 'angle' });
    expect(text).not.toContain('예각');
    expect(text).not.toContain('직각');
    expect(text).not.toContain('둔각');
    expect(text).not.toContain('50');
  });

  it('snapDiameter가 없으면 현이 중심을 지나도 지름 글자가 없다', () => {
    const text = textOf({ mode: 'circle', radius: 3, chordExplorer: true }, [
      { type: 'select-circle-tool', tool: 'chord' },
      { type: 'set-chord', end: 0, pos: 3 },
      { type: 'set-chord', end: 1, pos: 27 },
    ]);
    expect(text).not.toContain('지름');
  });

  it('snapDiameter가 있으면 중심을 지나는 현에 지름 이름표가 붙는다', () => {
    const text = textOf({ mode: 'circle', radius: 3, chordExplorer: true, snapDiameter: true }, [
      { type: 'select-circle-tool', tool: 'chord' },
      { type: 'set-chord', end: 0, pos: 3 },
      { type: 'set-chord', end: 1, pos: 27 },
    ]);
    expect(text).toContain('지름');
  });
});
