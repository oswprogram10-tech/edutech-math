/** @vitest-environment jsdom */
/** T167: distortion 화면(탭·조작 줄·제목 카드·체크리스트·읽기 전용, flaws가 DOM에 없음) 테스트. */
import { cleanup, fireEvent, render, within } from '@testing-library/react';
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
      cpa="P"
      mode={state.mode}
      targetSize={48}
      readOnly={readOnly}
    />
  );
}

const config = {
  mode: 'distortion',
  title: '도서 대출 수',
  data: [
    ['1반', 52],
    ['2반', 48],
  ],
  controls: ['yStart', 'yStep', 'wavyLine', 'groupItems'],
  yStartOptions: [0, 45],
  yStepOptions: [1, 5, 10],
  groupOptions: [{ label: '1·2반', members: ['1반', '2반'] }],
  headlineCards: ['1반이 압도적!', '큰 차이 없어요'],
  examples: [
    {
      id: 'a',
      title: '예시 가',
      kind: 'bar',
      data: { 가: 52, 나: 48 },
      yStart: 45,
      flaws: ['y-zero'],
    },
    { id: 'b', title: '예시 나', kind: 'circle', data: { 가: 60, 나: 55 }, flaws: ['sum-100'] },
  ],
} as unknown as GraphConfig;

function observation() {
  if (latest === null) throw new Error('상태 없음');
  return observe(latest);
}

describe('distortion 화면', () => {
  it('세로축 시작 단추를 누르면 막대 높이 비가 바뀐다', () => {
    const { container, getByRole } = render(<Live config={config} />);
    const heights = () =>
      Array.from(container.querySelectorAll('[data-testid="distortion-bar"]')).map((node) =>
        Number(node.getAttribute('height')),
      );
    const [a0, b0] = heights();
    expect((a0 ?? 0) / (b0 ?? 1)).toBeCloseTo(52 / 48, 1);
    fireEvent.click(getByRole('radio', { name: '45부터' }));
    const [a1, b1] = heights();
    expect((a1 ?? 0) / (b1 ?? 1)).toBeCloseTo(7 / 3, 1);
    expect(observation()['yStart']).toBe(45);
  });

  it('물결선 토글: 시작값이 0보다 클 때만 물결선이 그려진다', () => {
    const { container, getByRole } = render(<Live config={config} />);
    fireEvent.click(getByRole('switch', { name: '세로축 물결선' }));
    expect(container.querySelectorAll('[data-testid="distortion-wavy"]')).toHaveLength(0);
    fireEvent.click(getByRole('radio', { name: '45부터' }));
    expect(container.querySelectorAll('[data-testid="distortion-wavy"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="distortion-zero"]')?.textContent).toBe('0');
  });

  it('묶음 토글은 막대 두 개를 하나로 합친다', () => {
    const { container, getByRole } = render(<Live config={config} />);
    fireEvent.click(getByRole('switch', { name: '1·2반 묶기' }));
    expect(container.querySelectorAll('[data-testid="distortion-bar"]')).toHaveLength(1);
    expect(observation()['barValues']).toEqual({ '1·2반': 100 });
  });

  it('제목 카드를 누른 순서대로 제목이 쌓이고 지우기로 비운다', () => {
    const { getByRole, getByTestId } = render(<Live config={config} />);
    fireEvent.click(getByRole('button', { name: '큰 차이 없어요' }));
    fireEvent.click(getByRole('button', { name: '1반이 압도적!' }));
    expect(getByTestId('headline-text').textContent).toBe('큰 차이 없어요 1반이 압도적!');
    fireEvent.click(getByRole('button', { name: '지우기' }));
    expect(observation()['headline']).toEqual([]);
  });

  it('막대 위에 값 글자가 없다(눈금 숫자만 있다)', () => {
    const { container } = render(<Live config={config} />);
    const texts = Array.from(container.querySelectorAll('svg text')).map(
      (node) => node.textContent,
    );
    expect(texts).not.toContain('52');
    expect(texts).not.toContain('48');
  });

  it('예시 탭: tablist 구조, 키보드 화살표 이동, 예시에서는 조작 줄이 체크리스트로 바뀐다', () => {
    const { getByRole, queryByTestId, getAllByRole } = render(<Live config={config} />);
    const tabs = getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['내 그래프', '예시 1', '예시 2']);
    expect(getByRole('tablist')).toBeTruthy();
    expect(queryByTestId('distortion-checklist')).toBeNull();
    fireEvent.keyDown(getByRole('tablist'), { key: 'ArrowRight' });
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    expect(queryByTestId('distortion-controls')).toBeNull();
    expect(queryByTestId('distortion-checklist')).not.toBeNull();
    fireEvent.keyDown(getByRole('tablist'), { key: 'End' });
    expect(observation()['exampleIndex']).toBe(2);
  });

  it('체크리스트: 체크하면 marks에 들어가고 marksMatch가 바뀌며 정오 표시는 없다', () => {
    const { container, getByRole, getByTestId } = render(<Live config={config} />);
    fireEvent.click(getByRole('tab', { name: '예시 1' }));
    const checklist = within(getByTestId('distortion-checklist'));
    const box = checklist.getByRole('checkbox', { name: '세로축이 0에서 시작하나? 문제 있음' });
    const before = container.innerHTML;
    fireEvent.click(box);
    expect(observation()['marksMatch']).toEqual({ a: true, b: false });
    expect((box as HTMLInputElement).checked).toBe(true);
    // 체크한 항목에만 학생 자신의 "문제 있음" 표가 붙고, 그 밖에는 DOM이 맞음·틀림으로 달라지지 않는다.
    expect(before).not.toContain('>문제 있음<');
    expect(container.innerHTML.match(/>문제 있음</g)).toHaveLength(1);
    const strip = (html: string) =>
      html.replace(/checked=""/g, '').replace(/<span class="[^"]*">문제 있음<\/span>/g, '');
    expect(strip(container.innerHTML)).toBe(strip(before));
    expect(checklist.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('flaws와 정답 표시가 DOM에 없다', () => {
    const { container, getByRole } = render(<Live config={config} />);
    for (const name of ['예시 1', '예시 2', '내 그래프']) {
      fireEvent.click(getByRole('tab', { name }));
      expect(container.innerHTML).not.toContain('flaws');
      expect(container.innerHTML).not.toContain('flaw');
    }
  });

  it('원그래프 예시는 합이 100이 아니어도 그대로 그린다', () => {
    const { container, getByRole } = render(<Live config={config} />);
    fireEvent.click(getByRole('tab', { name: '예시 2' }));
    const slices = container.querySelectorAll('[data-testid="distortion-slice"]');
    expect(slices).toHaveLength(2);
    expect(slices[0]?.getAttribute('aria-label')).toBe('가 60%');
  });

  it('읽기 전용이면 조작이 막힌다', () => {
    const { getByRole, getAllByRole } = render(<Live config={config} readOnly />);
    const start = getByRole('radio', { name: '45부터' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    for (const tab of getAllByRole('tab')) expect((tab as HTMLButtonElement).disabled).toBe(true);
  });
});
