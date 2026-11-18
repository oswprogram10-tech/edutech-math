/** @vitest-environment jsdom */
/** T163: line-graph 화면(레인·점·선분·물결선·예측 범례·말풍선) 테스트. */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import type { GraphAction, GraphConfig, GraphState } from '../types';
import { GraphView } from '../View';

afterEach(cleanup);

const POINTS = [
  { x: '1일', y: '36.5' },
  { x: '2일', y: '36.8' },
  { x: '3일', y: '37.2' },
];

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

const base = {
  mode: 'line-graph',
  points: POINTS,
  yStep: '0.5',
  plotStep: '0.1',
  valueLabel: '℃',
  categoryAxisTitle: '날짜',
  valueAxisTitle: '체온',
} as const;

function key(element: Element, name: string) {
  fireEvent.keyDown(element, { key: name });
}

describe('line-graph 화면', () => {
  it('학생 그래프: 레인마다 버튼이 있고 ↑로 점이 찍히며 선분이 이어진다', () => {
    const { container } = render(<Live config={{ ...base, graph: 'student' }} />);
    const lanes = container.querySelectorAll('[data-testid="line-lane"]');
    expect([...lanes].map((lane) => lane.getAttribute('data-x'))).toEqual(['1일', '2일', '3일']);
    expect(lanes[0]?.getAttribute('role')).toBe('button');
    expect(lanes[0]?.getAttribute('tabindex')).toBe('0');
    expect(container.querySelectorAll('[data-testid="line-point"]')).toHaveLength(0);
    key(lanes[0] as Element, 'ArrowUp');
    key(lanes[1] as Element, 'ArrowUp');
    key(lanes[1] as Element, 'ArrowUp');
    const points = container.querySelectorAll('[data-testid="line-point"]');
    expect(points).toHaveLength(2);
    expect(points[0]?.getAttribute('data-x')).toBe('1일');
    expect(points[0]?.getAttribute('data-y')).toBe('0');
    expect(points[1]?.getAttribute('data-y')).toBe('0.1');
    const segment = container.querySelector('[data-testid="line-segment"]');
    expect(segment?.getAttribute('data-a')).toBe('0');
    expect(segment?.getAttribute('data-b')).toBe('1');
    key(lanes[0] as Element, 'Delete');
    expect(container.querySelectorAll('[data-testid="line-point"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="line-segment"]')).toHaveLength(0);
  });

  it('정오 표시가 없다: 학생 점에 말풍선도 맞음 표시도 없다', () => {
    const { container } = render(<Live config={{ ...base, graph: 'student', tooltips: 'show' }} />);
    const lane = container.querySelector('[data-testid="line-lane"]') as Element;
    key(lane, 'ArrowUp');
    const point = container.querySelector('[data-testid="line-point"]') as Element;
    expect(point.getAttribute('role')).toBe('img');
    fireEvent.click(point);
    expect(container.querySelector('[data-testid="graph-tooltip"]')).toBeNull();
  });

  it('주어진 그래프: 점·선분을 다 그리고 tooltips:show면 점을 눌러 말풍선을 본다', () => {
    const { container } = render(<Live config={{ ...base, graph: 'given', tooltips: 'show' }} />);
    expect(container.querySelectorAll('[data-testid="line-point"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid="line-segment"]')).toHaveLength(2);
    expect(container.querySelector('[data-testid="line-lane"]')?.getAttribute('role')).toBeNull();
    const point = container.querySelector('[data-testid="line-point"]') as Element;
    expect(point.getAttribute('data-y')).toBe('36.5');
    fireEvent.click(point);
    expect(container.querySelector('[data-testid="graph-tooltip"]')?.textContent).toContain(
      '1일: 36.5℃',
    );
  });

  it('표는 가로축 이름과 값의 두 줄이고 hidden이면 없다', () => {
    const shown = render(<Live config={{ ...base, graph: 'given' }} />);
    const rows = shown.container.querySelectorAll('[data-testid="graph-table"] tr');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('1일');
    expect(rows[1]?.textContent).toContain('37.2');
    cleanup();
    const hidden = render(<Live config={{ ...base, graph: 'given', table: 'hidden' }} />);
    expect(hidden.container.querySelector('[data-testid="graph-table"]')).toBeNull();
  });

  it('물결선: 단추 줄이 있고 누르면 data-y-from·data-wavy가 바뀐다', () => {
    const { container, getByRole } = render(
      <Live config={{ ...base, graph: 'given', yFromOptions: ['0', '36'] }} />,
    );
    const group = getByRole('radiogroup');
    expect([...group.querySelectorAll('[role="radio"]')].map((b) => b.textContent)).toEqual([
      '0부터',
      '36부터',
    ]);
    const svg = container.querySelector('[data-testid="graph-canvas"]') as Element;
    expect(svg.getAttribute('data-y-from')).toBe('0');
    expect(svg.getAttribute('data-wavy')).toBe('false');
    expect(container.querySelector('[data-testid="line-wavy"]')).toBeNull();
    fireEvent.click(group.querySelector('[data-y-from="36"]') as Element);
    expect(svg.getAttribute('data-y-from')).toBe('36');
    expect(svg.getAttribute('data-wavy')).toBe('true');
    expect(container.querySelector('[data-testid="line-wavy"]')).not.toBeNull();
    expect(group.querySelector('[data-y-from="36"]')?.getAttribute('aria-checked')).toBe('true');
  });

  it('yFromOptions가 없으면 물결선 단추 줄이 없다', () => {
    const { container } = render(<Live config={{ ...base, graph: 'given' }} />);
    expect(container.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it('예측 단계: 표·실제 선을 숨기고 범례를 보이며 실제 자료 보기 뒤에 실제 선이 나온다', () => {
    const { container, getByTestId } = render(
      <Live config={{ ...base, graph: 'given', predict: true }} />,
    );
    expect(container.querySelector('[data-testid="graph-table"]')).toBeNull();
    expect(getByTestId('line-legend').textContent).toContain('예측');
    expect(getByTestId('line-legend').textContent).toContain('실제');
    expect(container.querySelectorAll('[data-testid="line-point"]')).toHaveLength(0);
    const finish = getByTestId('line-finish-predict') as HTMLButtonElement;
    expect(finish.disabled).toBe(true);
    const lanes = container.querySelectorAll('[data-testid="line-lane"]');
    key(lanes[0] as Element, 'ArrowUp');
    key(lanes[1] as Element, 'ArrowUp');
    const predicted = container.querySelectorAll('[data-testid="line-point"]');
    expect([...predicted].map((p) => p.getAttribute('data-kind'))).toEqual([
      'prediction',
      'prediction',
    ]);
    expect(container.querySelector('[data-kind="prediction"][data-a]')).not.toBeNull();
    expect(finish.disabled).toBe(false);
    fireEvent.click(finish);
    expect(container.querySelector('[data-testid="line-finish-predict"]')).toBeNull();
    const kinds = [...container.querySelectorAll('[data-testid="line-point"]')].map((p) =>
      p.getAttribute('data-kind'),
    );
    expect(kinds.filter((kind) => kind === 'actual')).toHaveLength(3);
    expect(kinds.filter((kind) => kind === 'prediction')).toHaveLength(2);
    expect(container.querySelector('[data-testid="graph-table"]')).not.toBeNull();
  });

  it('connect:student: 점 둘을 차례로 Enter하면 이어지고, 선분을 누르면 끊어진다', () => {
    const { container } = render(
      <Live config={{ ...base, graph: 'student', connect: 'student' }} />,
    );
    const lanes = container.querySelectorAll('[data-testid="line-lane"]');
    key(lanes[0] as Element, 'ArrowUp');
    key(lanes[2] as Element, 'ArrowUp');
    expect(container.querySelectorAll('[data-testid="line-segment"]')).toHaveLength(0);
    key(lanes[0] as Element, 'Enter');
    key(lanes[2] as Element, 'Enter');
    const segment = container.querySelector('[data-testid="line-segment"]') as Element;
    expect(segment.getAttribute('data-a')).toBe('0');
    expect(segment.getAttribute('data-b')).toBe('2');
    fireEvent.click(segment);
    expect(container.querySelectorAll('[data-testid="line-segment"]')).toHaveLength(0);
  });

  it('readOnly면 레인이 버튼이 아니다', () => {
    const config: GraphConfig = { ...base, graph: 'student' };
    const state = createInitialState(config);
    const { container } = render(
      <GraphView
        config={config}
        state={state}
        dispatch={() => undefined}
        cpa="C"
        mode="line-graph"
        targetSize={48}
        readOnly
      />,
    );
    expect(container.querySelector('[data-testid="line-lane"]')?.getAttribute('role')).toBeNull();
  });
});
