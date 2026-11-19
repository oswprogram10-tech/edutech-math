/** @vitest-environment jsdom */
/** T166: band-circle 화면(백분율 칸·손잡이·말기 단추·넘침 빗금·compare 원·읽기 전용) 테스트. */
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { useEffect, useReducer } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { GraphAction, GraphConfig, GraphState } from '../types';
import { GraphView } from '../View';

afterEach(cleanup);

let latest: GraphState | null = null;

function Live({
  config,
  readOnly = false,
}: {
  readonly config: GraphConfig;
  readonly readOnly?: boolean;
}) {
  const [state, dispatch] = useReducer(
    (current: GraphState, action: GraphAction) => reduce(current, action),
    config,
    createInitialState,
  );
  useEffect(() => {
    latest = state;
  });
  return (
    <GraphView
      config={config}
      state={state}
      dispatch={dispatch}
      cpa="C"
      mode={state.mode}
      targetSize={48}
      readOnly={readOnly}
    />
  );
}

const base = {
  mode: 'band-circle',
  title: '좋아하는 과일',
  data: [
    ['사과', 9],
    ['포도', 6],
    ['딸기', 3],
    ['기타', 2],
  ],
  percentEntry: 'student',
  band: 'auto',
} as const;

function observation() {
  if (latest === null) throw new Error('상태 없음');
  return observe(latest);
}

describe('band-circle 화면', () => {
  it('표의 셋째 칸 백분율 칸에 쓰면 띠(auto)가 그 칸 수로 채워진다', () => {
    const { getAllByTestId, container } = render(<Live config={base} />);
    const inputs = getAllByTestId('band-percent-input');
    expect(inputs).toHaveLength(4);
    fireEvent.change(inputs[0] as Element, { target: { value: '45' } });
    fireEvent.change(inputs[1] as Element, { target: { value: '30' } });
    const slices = container.querySelectorAll('[data-testid="band-slice"]');
    expect(slices).toHaveLength(2);
    expect(slices[0]?.getAttribute('data-cells')).toBe('45');
    expect(slices[1]?.getAttribute('data-cells')).toBe('30');
    expect(observation()['percents']).toMatchObject({ 사과: 45, 포도: 30, 딸기: null });
  });

  it('글자가 아닌 입력은 걸러지고 100을 넘으면 100이며, 비우면 지워진다', () => {
    const { getAllByTestId } = render(<Live config={base} />);
    const input = getAllByTestId('band-percent-input')[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a7b' } });
    expect(observation()['percents']).toMatchObject({ 사과: 7 });
    fireEvent.change(input, { target: { value: '250' } });
    expect(observation()['percents']).toMatchObject({ 사과: 100 });
    fireEvent.change(input, { target: { value: '' } });
    expect(observation()['percents']).toMatchObject({ 사과: null });
  });

  it('늘리기·줄이기 단추는 1씩 바꾸고 0과 100에서 멈춘다', () => {
    const { getByRole } = render(<Live config={base} />);
    fireEvent.click(getByRole('button', { name: '사과 백분율 줄이기' }));
    expect(observation()['percents']).toMatchObject({ 사과: 0 });
    fireEvent.click(getByRole('button', { name: '사과 백분율 늘리기' }));
    fireEvent.click(getByRole('button', { name: '사과 백분율 늘리기' }));
    expect(observation()['percents']).toMatchObject({ 사과: 2 });
  });

  it('percentEntry given이면 표에 값만 있고 입력 칸이 없다', () => {
    const { queryAllByTestId, getByTestId } = render(
      <Live config={{ ...base, percentEntry: 'given' }} />,
    );
    expect(queryAllByTestId('band-percent-input')).toHaveLength(0);
    expect(getByTestId('graph-table').textContent).toContain('45');
  });

  it('손잡이는 slider이고 ←/→ 1칸, PageUp/PageDown 10칸, Delete로 0이 된다', () => {
    const { getByRole } = render(<Live config={{ ...base, band: 'student' }} />);
    const handle = getByRole('slider', { name: '사과 칸 수' });
    expect(handle.getAttribute('aria-valuenow')).toBe('0');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle.getAttribute('aria-valuenow')).toBe('2');
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(handle.getAttribute('aria-valuenow')).toBe('1');
    fireEvent.keyDown(handle, { key: 'PageUp' });
    expect(handle.getAttribute('aria-valuenow')).toBe('11');
    fireEvent.keyDown(handle, { key: 'PageDown' });
    fireEvent.keyDown(handle, { key: 'PageDown' });
    expect(handle.getAttribute('aria-valuenow')).toBe('0');
    fireEvent.keyDown(handle, { key: 'PageUp' });
    fireEvent.keyDown(handle, { key: 'Delete' });
    expect(handle.getAttribute('aria-valuenow')).toBe('0');
    expect(observation()['bandCells']).toMatchObject({ 사과: 0 });
  });

  it('칸 합이 100을 넘어도 그대로 그리고(빗금), 정오 표시는 없다', () => {
    const { getByRole, container, queryByText } = render(
      <Live config={{ ...base, band: 'student' }} />,
    );
    for (const name of ['사과 칸 수', '포도 칸 수']) {
      const handle = getByRole('slider', { name });
      for (let i = 0; i < 6; i += 1) fireEvent.keyDown(handle, { key: 'PageUp' });
    }
    const canvas = container.querySelector('[data-testid="graph-canvas"]');
    expect(canvas?.getAttribute('data-cell-sum')).toBe('120');
    expect(container.querySelector('[data-testid="band-overflow"]')).not.toBeNull();
    expect(observation()['misconceptions']).toEqual([]);
    expect(queryByText(/정답|오답|틀렸|맞았/)).toBeNull();
  });

  it('합이 100 이하면 넘침 빗금이 없다', () => {
    const { container } = render(<Live config={{ ...base, band: 'given' }} />);
    expect(container.querySelector('[data-testid="band-overflow"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid="band-slice"]')).toHaveLength(4);
  });

  it('말기 단추는 원그래프와 띠 사이를 오가고 curl이 100·0이 된다', () => {
    const { getByTestId } = render(<Live config={base} />);
    const toggle = getByTestId('band-morph-toggle');
    expect(toggle.textContent).toBe('원그래프로 말기');
    fireEvent.click(toggle);
    expect(observation()['curl']).toBe(100);
    expect(observation()['circleShown']).toBe(true);
    expect(getByTestId('band-morph-toggle').textContent).toBe('띠그래프로 펴기');
    fireEvent.click(getByTestId('band-morph-toggle'));
    expect(observation()['curl']).toBe(0);
  });

  it('morph none이면 단추도 끌기 손잡이도 없고, startAs circle이면 처음부터 원이다', () => {
    const { queryByTestId, container } = render(
      <Live config={{ ...base, morph: 'none', startAs: 'circle', band: 'given' }} />,
    );
    expect(queryByTestId('band-morph-toggle')).toBeNull();
    expect(queryByTestId('band-morph-handle')).toBeNull();
    expect(container.querySelector('[data-testid="graph-canvas"]')?.getAttribute('data-curl')).toBe(
      '100',
    );
  });

  it('morph button이면 끌기 손잡이는 없고 단추만 있다. drag이면 둘 다 있다', () => {
    const button = render(<Live config={{ ...base, morph: 'button' }} />);
    expect(button.queryByTestId('band-morph-handle')).toBeNull();
    expect(button.queryByTestId('band-morph-toggle')).not.toBeNull();
    button.unmount();
    const drag = render(<Live config={{ ...base, morph: 'drag' }} />);
    expect(drag.queryByTestId('band-morph-handle')).not.toBeNull();
  });

  it('띠 손잡이는 곧은 띠(curl 0)일 때만 있다', async () => {
    const { getByTestId, queryAllByTestId } = render(
      <Live config={{ ...base, band: 'student' }} />,
    );
    expect(queryAllByTestId('band-handle')).toHaveLength(4);
    fireEvent.click(getByTestId('band-morph-toggle'));
    // 말기는 280ms 애니메이션이라 곧은 띠가 아니게 된 뒤에 손잡이가 사라진다.
    await waitFor(() => expect(queryAllByTestId('band-handle')).toHaveLength(0));
  });

  it('compare는 원그래프일 때만 두 번째 원을 그린다(같은 반지름)', async () => {
    const config = {
      ...base,
      band: 'given',
      compare: { title: '2반', data: { 사과: 20, 포도: 10, 딸기: 10, 기타: 10 } },
    } as const;
    const { getByTestId, queryByTestId, container } = render(<Live config={config} />);
    expect(queryByTestId('compare-circle')).toBeNull();
    fireEvent.click(getByTestId('band-morph-toggle'));
    await waitFor(() => expect(queryByTestId('compare-circle')).not.toBeNull());
    const cells = [...container.querySelectorAll('[data-testid="compare-slice"]')].map((node) =>
      node.getAttribute('data-cells'),
    );
    expect(cells).toEqual(['40', '20', '20', '20']);
  });

  it('읽기 전용이면 입력·단추·손잡이가 막힌다', () => {
    const { getAllByTestId, getByTestId, queryAllByTestId } = render(
      <Live config={{ ...base, band: 'student' }} readOnly />,
    );
    expect((getAllByTestId('band-percent-input')[0] as HTMLInputElement).disabled).toBe(true);
    expect((getByTestId('band-morph-toggle') as HTMLButtonElement).disabled).toBe(true);
    expect(queryAllByTestId('band-handle')).toHaveLength(0);
    expect(queryAllByTestId('band-morph-handle')).toHaveLength(0);
  });

  it('table hidden이면 개수 칸이 없고, percentEntry hidden이면 백분율 칸이 없다', () => {
    const noCount = render(<Live config={{ ...base, table: 'hidden' }} />);
    expect(noCount.queryAllByTestId('band-count')).toHaveLength(0);
    expect(noCount.queryAllByTestId('band-percent-input')).toHaveLength(4);
    noCount.unmount();
    const noPercent = render(<Live config={{ ...base, percentEntry: 'hidden' }} />);
    expect(noPercent.queryAllByTestId('band-count')).toHaveLength(4);
    expect(noPercent.queryAllByTestId('band-percent-input')).toHaveLength(0);
    noPercent.unmount();
    const none = render(<Live config={{ ...base, table: 'hidden', percentEntry: 'hidden' }} />);
    expect(none.queryByTestId('graph-table')).toBeNull();
  });
});
