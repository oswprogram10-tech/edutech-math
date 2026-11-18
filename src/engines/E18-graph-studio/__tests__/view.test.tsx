/** @vitest-environment jsdom */
/**
 * E18 화면 테스트: 학생이 그리는 그래프에는 말풍선도 정오 표시도 없고,
 * 설정에 따라 표·눈금 줄이 나오며, 키보드로 막대를 한 칸씩 늘일 수 있다.
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import type { GraphAction, GraphConfig, GraphState } from '../types';
import { GraphView } from '../View';

afterEach(cleanup);

const SPORTS = { 축구: 12, 피구: 8, 줄넘기: 5, 수영: 10 };

function renderConfig(
  config: GraphConfig,
  options: { readonly cpa?: 'C' | 'P' | 'A'; readonly state?: GraphState } = {},
) {
  const state = options.state ?? createInitialState(config);
  return render(
    <GraphView
      config={config}
      state={state}
      dispatch={() => {}}
      cpa={options.cpa ?? 'C'}
      mode={state.mode}
      targetSize={48}
    />,
  );
}

function Live({ config }: { readonly config: GraphConfig }) {
  const [state, dispatch] = useReducer(
    (current: GraphState, action: GraphAction) => reduce(current, action),
    config,
    createInitialState,
  );
  return (
    <GraphView
      config={config}
      state={state}
      dispatch={dispatch}
      cpa="C"
      mode={state.mode}
      targetSize={48}
    />
  );
}

/** 맞음·틀림을 나타낼 수 있는 속성 이름. */
const JUDGMENT_ATTRIBUTES = ['data-correct', 'data-match', 'data-fit', 'data-ok', 'aria-invalid'];

describe('E18 정답 노출 금지', () => {
  it('graph: student면 말풍선 요소가 0개이고 정오를 나타내는 속성도 없다', () => {
    const config: GraphConfig = {
      data: SPORTS,
      graph: 'student',
      tooltips: 'show',
      valueLabel: '명',
    };
    const { container } = renderConfig(config);
    expect(container.querySelectorAll('[data-testid="graph-tooltip"]')).toHaveLength(0);
    for (const name of JUDGMENT_ATTRIBUTES) {
      expect(container.querySelectorAll(`[${name}]`)).toHaveLength(0);
    }
    // 막대를 눌러도 말풍선이 생기지 않는다.
    const bar = container.querySelector('g[data-cat="축구"]');
    expect(bar).not.toBeNull();
    if (bar) fireEvent.click(bar);
    expect(container.querySelectorAll('[data-testid="graph-tooltip"]')).toHaveLength(0);
  });

  it('학생 그래프를 자료와 맞게 그려도 화면이 달라지지 않는다', () => {
    const config: GraphConfig = { data: { 가: 2, 나: 1 }, graph: 'student' };
    const wrong = renderConfig(config, {
      state: reduce(createInitialState(config), { type: 'set-bar', cat: '가', cells: 5 }),
    });
    const wrongNames = [...wrong.container.querySelectorAll('*')].flatMap((element) =>
      element
        .getAttributeNames()
        .filter((name) => name.startsWith('data-') || name === 'aria-invalid'),
    );
    cleanup();
    let state = createInitialState(config);
    state = reduce(state, { type: 'set-bar', cat: '가', cells: 2 });
    state = reduce(state, { type: 'set-bar', cat: '나', cells: 1 });
    const right = renderConfig(config, { state });
    const rightNames = [...right.container.querySelectorAll('*')].flatMap((element) =>
      element
        .getAttributeNames()
        .filter((name) => name.startsWith('data-') || name === 'aria-invalid'),
    );
    expect(new Set(rightNames)).toEqual(new Set(wrongNames));
  });

  it("graph: given + tooltips: 'auto' + C 단계면 막대를 눌렀을 때 말풍선이 나온다", () => {
    const config: GraphConfig = { data: SPORTS, valueLabel: '명' };
    const { container } = renderConfig(config, { cpa: 'C' });
    const bar = container.querySelector('g[data-cat="축구"]');
    if (bar) fireEvent.click(bar);
    // 상태가 View 안에 있어 즉시 다시 그려진다.
    expect(container.querySelector('[data-testid="graph-tooltip"]')?.textContent).toBe(
      '축구: 12명',
    );
  });

  it("tooltips: 'auto' + A 단계면 말풍선이 없고 막대에 값 글자도 없다", () => {
    const config: GraphConfig = { data: SPORTS, valueLabel: '명' };
    const { container } = renderConfig(config, { cpa: 'A' });
    const bar = container.querySelector('g[data-cat="축구"]');
    expect(bar?.getAttribute('aria-label')).toBe('축구 막대');
    if (bar) fireEvent.click(bar);
    expect(container.querySelectorAll('[data-testid="graph-tooltip"]')).toHaveLength(0);
  });

  it("tooltips: 'show'는 A 단계에서도 보이고 'hide'는 C 단계에서도 숨긴다", () => {
    const shown = renderConfig({ data: SPORTS, tooltips: 'show' }, { cpa: 'A' });
    const bar = shown.container.querySelector('g[data-cat="축구"]');
    expect(bar?.getAttribute('role')).toBe('button');
    cleanup();
    const hidden = renderConfig({ data: SPORTS, tooltips: 'hide' }, { cpa: 'C' });
    expect(hidden.container.querySelector('g[data-cat="축구"]')?.getAttribute('role')).toBe('img');
  });
});

describe('E18 표·눈금 줄', () => {
  it("table: 'hidden'이면 표가 없다", () => {
    const { container } = renderConfig({ data: SPORTS, table: 'hidden' });
    expect(container.querySelector('[data-testid="graph-table"]')).toBeNull();
    expect(container.querySelector('[data-testid="graph-canvas"]')).not.toBeNull();
  });

  it('표에는 범주마다 한 줄이 있고 합계 줄이 없다', () => {
    const { container } = renderConfig({ data: SPORTS });
    const rows = container.querySelectorAll('[data-testid="graph-table"] tbody tr');
    expect(rows).toHaveLength(4);
    expect(container.querySelector('[data-testid="graph-table"] tfoot')).toBeNull();
    expect(container.querySelector('td[data-cat="축구"]')?.textContent).toBe('12');
  });

  it("table: 'student'면 −/+ 단추로 수를 넣는다", () => {
    const { container, getByLabelText } = render(
      <Live config={{ data: SPORTS, table: 'student' }} />,
    );
    expect(container.querySelector('td[data-cat="축구"]')?.textContent).toContain('–');
    fireEvent.click(getByLabelText('축구 늘리기'));
    fireEvent.click(getByLabelText('축구 늘리기'));
    expect(container.querySelector('output[data-cat-value="축구"]')?.textContent).toBe('2');
    fireEvent.click(getByLabelText('축구 줄이기'));
    expect(container.querySelector('output[data-cat-value="축구"]')?.textContent).toBe('1');
  });

  it('눈금 고르기 줄은 scale 모드에만 있고 단추 글자는 값 + 단위다', () => {
    const scale = renderConfig({ mode: 'scale', data: SPORTS, valueLabel: '명' });
    const group = scale.container.querySelector('[role="radiogroup"]');
    expect(group).not.toBeNull();
    const labels = [...scale.container.querySelectorAll('[role="radio"]')].map(
      (button) => button.textContent,
    );
    expect(labels).toEqual(['1명', '2명', '5명', '10명']);
    expect(
      scale.container.querySelector('[role="radio"][data-scale="1"]')?.getAttribute('aria-checked'),
    ).toBe('true');
    cleanup();
    const plain = renderConfig({ mode: 'table-to-graph', data: SPORTS });
    expect(plain.container.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it('눈금 단추를 누르면 막대 칸 수 속성이 바뀐다', () => {
    const { container } = render(
      <Live config={{ mode: 'scale', data: SPORTS, valueLabel: '명' }} />,
    );
    expect(container.querySelector('g[data-cat="축구"]')?.getAttribute('data-cells')).toBe('12');
    fireEvent.click(container.querySelector('[role="radio"][data-scale="2"]') as Element);
    expect(container.querySelector('g[data-cat="축구"]')?.getAttribute('data-cells')).toBe('6');
  });

  it('가로·세로 바꾸기 단추는 orientationFlip일 때만 있고 data-orientation이 바뀐다', () => {
    const none = renderConfig({ data: SPORTS });
    expect(none.container.querySelector('[data-testid="graph-flip"]')).toBeNull();
    cleanup();
    const { container } = render(<Live config={{ data: SPORTS, orientationFlip: true }} />);
    const svg = container.querySelector('[data-testid="graph-canvas"]');
    expect(svg?.getAttribute('data-orientation')).toBe('vertical');
    fireEvent.click(container.querySelector('[data-testid="graph-flip"]') as Element);
    expect(svg?.getAttribute('data-orientation')).toBe('horizontal');
    expect(container.querySelector('g[data-cat="축구"]')?.getAttribute('data-cells')).toBe('12');
  });

  it('자료 카드를 누르면 ✓가 붙는다', () => {
    const { container } = render(
      <Live config={{ categories: ['🍎', '🍌'], rawItems: ['🍎', '🍌', '🍎'], graph: 'none' }} />,
    );
    const cards = container.querySelectorAll('[data-tally-index]');
    expect(cards).toHaveLength(3);
    fireEvent.click(cards[1] as Element);
    expect(container.querySelector('[data-tally-index="1"]')?.textContent).toContain('✓');
    expect(container.querySelector('[data-tally-index="0"]')?.textContent).not.toContain('✓');
  });
});

describe('E18 키보드 조작', () => {
  it('막대에서 ↑로 data-cells가 1 늘고 ↓로 1 준다', () => {
    const { container } = render(<Live config={{ data: SPORTS, graph: 'student' }} />);
    const bar = () => container.querySelector('g[data-cat="축구"]') as Element;
    expect(bar().getAttribute('data-cells')).toBe('0');
    fireEvent.keyDown(bar(), { key: 'ArrowUp' });
    expect(bar().getAttribute('data-cells')).toBe('1');
    fireEvent.keyDown(bar(), { key: 'ArrowUp' });
    expect(bar().getAttribute('data-cells')).toBe('2');
    fireEvent.keyDown(bar(), { key: 'ArrowDown' });
    expect(bar().getAttribute('data-cells')).toBe('1');
    fireEvent.keyDown(bar(), { key: 'ArrowDown' });
    fireEvent.keyDown(bar(), { key: 'ArrowDown' });
    expect(bar().getAttribute('data-cells')).toBe('0');
  });

  it('가로 그래프에서는 →/←로 한 칸씩 늘이고 줄인다', () => {
    const { container } = render(
      <Live config={{ data: SPORTS, graph: 'student', orientation: 'horizontal' }} />,
    );
    const bar = () => container.querySelector('g[data-cat="축구"]') as Element;
    fireEvent.keyDown(bar(), { key: 'ArrowUp' });
    expect(bar().getAttribute('data-cells')).toBe('0');
    fireEvent.keyDown(bar(), { key: 'ArrowRight' });
    expect(bar().getAttribute('data-cells')).toBe('1');
    fireEvent.keyDown(bar(), { key: 'ArrowLeft' });
    expect(bar().getAttribute('data-cells')).toBe('0');
  });

  it('○ 칸은 Enter/Space로 채우고 비운다', () => {
    const { container } = render(
      <Live config={{ data: SPORTS, graph: 'student', graphType: 'o-mark' }} />,
    );
    const cell = () => container.querySelector('g[data-cat="축구"][data-cell="0"]') as Element;
    expect(cell().getAttribute('data-filled')).toBe('false');
    fireEvent.keyDown(cell(), { key: 'Enter' });
    expect(cell().getAttribute('data-filled')).toBe('true');
    fireEvent.keyDown(cell(), { key: ' ' });
    expect(cell().getAttribute('data-filled')).toBe('false');
    expect(cell().getAttribute('role')).toBe('button');
    expect(cell().getAttribute('tabindex')).toBe('0');
  });

  it('readOnly면 조작해도 바뀌지 않는다', () => {
    const config: GraphConfig = { data: SPORTS, graph: 'student', graphType: 'o-mark' };
    const state = createInitialState(config);
    let calls = 0;
    const { container } = render(
      <GraphView
        config={config}
        state={state}
        dispatch={() => {
          calls += 1;
        }}
        cpa="C"
        mode={state.mode}
        readOnly
        targetSize={48}
      />,
    );
    const cell = container.querySelector('g[data-cat="축구"][data-cell="0"]') as Element;
    fireEvent.click(cell);
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(calls).toBe(0);
  });
});

describe('E18 그림 속성', () => {
  it('SVG에 data-orientation이 있고 칸 속성이 있다', () => {
    const { container } = renderConfig({
      data: { 가: 2 },
      graph: 'student',
      graphType: 'o-mark',
      orientation: 'horizontal',
    });
    const svg = container.querySelector('[data-testid="graph-canvas"]');
    expect(svg?.getAttribute('data-orientation')).toBe('horizontal');
    const cells = container.querySelectorAll('g[data-cat="가"][data-cell]');
    expect(cells.length).toBeGreaterThan(0);
    expect(cells[0]?.getAttribute('data-filled')).toBe('false');
  });

  it('graph: none이면 그래프 SVG가 없다', () => {
    const { container } = renderConfig({ data: SPORTS, graph: 'none' });
    expect(container.querySelector('[data-testid="graph-canvas"]')).toBeNull();
    expect(container.querySelector('[data-testid="graph-table"]')).not.toBeNull();
  });
});

describe('E18 ○ 그래프 터치 크기', () => {
  it('누르는 ○ 그래프 SVG는 targetSize에서 계산한 최소 크기를 갖는다', () => {
    const config: GraphConfig = {
      data: { 가: 3, 나: 2 },
      graph: 'student',
      graphType: 'o-mark',
      axisMax: 7,
    };
    const state = createInitialState(config);
    const view = (targetSize: 48 | 64) =>
      render(
        <GraphView
          config={config}
          state={state}
          dispatch={() => {}}
          cpa="C"
          mode={state.mode}
          targetSize={targetSize}
        />,
      ).container.querySelector<SVGSVGElement>('[data-testid="graph-canvas"]');
    const big = view(64);
    expect(big?.getAttribute('data-scroll')).toBe('true');
    const heightOf = (svg: SVGSVGElement | null) => Number.parseFloat(svg?.style.minHeight ?? '0');
    const height64 = heightOf(big);
    cleanup();
    const height48 = heightOf(view(48));
    expect(height64).toBeGreaterThan(height48);
    expect(height64).toBeGreaterThanOrEqual(660);
  });

  it('주어진 ○ 그래프와 막대그래프는 최소 크기를 두지 않는다', () => {
    for (const config of [
      { data: { 가: 3 }, graphType: 'o-mark' } as GraphConfig,
      { data: { 가: 3 }, graph: 'student' } as GraphConfig,
    ]) {
      const { container } = renderConfig(config);
      const svg = container.querySelector<SVGSVGElement>('[data-testid="graph-canvas"]');
      expect(svg?.getAttribute('data-scroll')).toBeNull();
      expect(svg?.style.minHeight).toBe('');
      cleanup();
    }
  });
});
