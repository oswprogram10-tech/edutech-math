/** @vitest-environment jsdom */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../reduce';
import { countersStrings as S } from '../strings.ko';
import type { CountersConfig, CountersState } from '../types';
import { CountersView } from '../View';

afterEach(cleanup);

function renderView(config: CountersConfig, state: CountersState) {
  return render(
    <CountersView
      config={config}
      state={state}
      dispatch={() => {}}
      cpa="P"
      mode={state.mode}
      readOnly={false}
      targetSize={48}
    />,
  );
}

describe('E02 기본 설정은 개수 숫자를 화면에 쓰지 않는다', () => {
  it('summon에서 총 개수를 숨긴다', () => {
    const config: CountersConfig = { mode: 'summon', start: 7 };
    const state = createInitialState(config);
    const { container, queryByTestId } = renderView(config, state);
    expect(queryByTestId('counter-total')).toBeNull();
    expect(container.textContent).not.toContain(S.total(7));
    expect(container.textContent).not.toContain('지금');
  });

  it('ten-frame에서도 개수 문구를 숨긴다', () => {
    const config: CountersConfig = { mode: 'ten-frame', frames: 1, prefill: 10 };
    const state = createInitialState(config);
    const { container, queryByTestId } = renderView(config, state);
    expect(queryByTestId('counter-total')).toBeNull();
    expect(container.textContent).not.toContain(S.total(10));
  });

  it('flash에서는 보여 준 수를 문구로 쓰지 않는다', () => {
    const config: CountersConfig = { mode: 'flash', count: 6 };
    const state = createInitialState(config);
    const { container } = renderView(config, state);
    expect(container.textContent).not.toContain('6개');
    expect(container.textContent).toContain(S.flashReady);
  });

  it('showNumeral=always일 때만 총 개수를 보여 준다', () => {
    const config: CountersConfig = { mode: 'summon', start: 7, showNumeral: 'always' };
    const state = createInitialState(config);
    const { container, queryByTestId } = renderView(config, state);
    expect(queryByTestId('counter-total')).not.toBeNull();
    expect(container.textContent).toContain(S.total(7));
  });
});

describe('E02 접근성', () => {
  it('셈돌마다 키보드로 닿을 수 있는 이름이 있다', () => {
    const config: CountersConfig = { mode: 'summon', start: 2 };
    const state = createInitialState(config);
    const { getAllByRole } = renderView(config, state);
    expect(getAllByRole('button', { name: /번째 셈돌/ })).toHaveLength(2);
  });
});
