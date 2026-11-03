/** @vitest-environment jsdom */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../reduce';
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

describe('E02 part-whole는 기본 설정에서 개수 숫자를 쓰지 않는다', () => {
  it('groups [3,2]를 합친 상태에도 접시 이름·상태 줄·가르기 나무에 숫자가 없다', () => {
    const config: CountersConfig = { mode: 'part-whole', groups: [3, 2], parts: 2 };
    const state = reduce(createInitialState(config), { type: 'merge', from: 1, to: 0 });
    const { container, getByLabelText, queryByTestId } = renderView(config, state);
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/\d개/);
    expect(text).not.toMatch(/짝 \d/);
    expect(text).not.toContain(' · ');
    expect(queryByTestId('counter-total')).toBeNull();
    // 접시 aria-label도 이름만 쓴다.
    expect(getByLabelText(S.plateLabel(0))).toBeTruthy();
    expect(getByLabelText(S.plateLabel(1))).toBeTruthy();

    const tree = queryByTestId('bond-tree');
    expect(tree).not.toBeNull();
    expect(tree?.getAttribute('data-display')).toBe('structure');
    expect(tree?.textContent ?? '').toBe('');
  });

  it('compare에서 짝을 지어도 짝 수·남은 수를 상태 줄에 쓰지 않는다', () => {
    const config: CountersConfig = {
      mode: 'part-whole',
      scene: { icon: 'dot', kind: 'compare', numbers: [3, 3] },
      parts: 2,
    };
    let state = createInitialState(config);
    if (state.mode !== 'part-whole') throw new Error('part-whole 상태가 아닙니다.');
    const first = state.counters.find((counter) => counter.plate === 0);
    const second = state.counters.find((counter) => counter.plate === 1);
    if (!first || !second) throw new Error('셈돌이 없습니다.');
    state = reduce(state, { type: 'pair', a: first.id, b: second.id });

    const { container } = renderView(config, state);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/짝 \d/);
    expect(text).not.toMatch(/\d개/);
    expect(text).toContain(S.pairHint);
  });

  it('showNumeral=always일 때만 접시 개수·짝 수를 쓴다', () => {
    const config: CountersConfig = {
      mode: 'part-whole',
      groups: [3, 2],
      parts: 2,
      showNumeral: 'always',
    };
    const state = createInitialState(config);
    const { container, getByLabelText } = renderView(config, state);
    const text = container.textContent ?? '';
    expect(text).toContain(`${S.plateLabel(0)} · ${S.plateCount(3)}`);
    expect(text).toContain(`${S.pairs(0)} · ${S.unpaired(5)}`);
    expect(getByLabelText(`${S.plateLabel(0)} ${S.plateCount(3)}`)).toBeTruthy();
  });

  it('showBond=numbers일 때만 가르기 나무에 전체 수·접시 수를 쓴다', () => {
    const config: CountersConfig = {
      mode: 'part-whole',
      groups: [3, 2],
      parts: 2,
      showBond: 'numbers',
    };
    const state = createInitialState(config);
    const { container, queryByTestId } = renderView(config, state);
    const tree = queryByTestId('bond-tree');
    expect(tree?.getAttribute('data-display')).toBe('numbers');
    const text = tree?.textContent ?? '';
    expect(text).toContain('5');
    expect(text).toContain('3');
    expect(text).toContain('2');
    expect(container.textContent).toContain(S.plateLabel(0));

    const noneConfig: CountersConfig = { ...config, showBond: 'none' };
    const none = renderView(noneConfig, createInitialState(noneConfig));
    expect(none.container.querySelector('[data-testid="bond-tree"]')).toBeNull();
  });
});

describe('E02 ten-frame 격자', () => {
  it('프레임 가운데 굵은 선 없이 칸 구분선만 그린다', () => {
    const config: CountersConfig = { mode: 'ten-frame', frames: 1, prefill: 3 };
    const state = createInitialState(config);
    const { container } = renderView(config, state);
    const frame = container.querySelector('[data-frame="0"]');
    expect(frame).not.toBeNull();
    expect(frame?.querySelector('line')).toBeNull();
    expect(frame?.querySelectorAll('rect').length).toBe(11);
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
