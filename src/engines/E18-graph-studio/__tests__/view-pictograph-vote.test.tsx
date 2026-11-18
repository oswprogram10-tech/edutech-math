/** @vitest-environment jsdom */
/**
 * E18 T156 화면 테스트: 학생이 만드는 그림그래프에는 말풍선도 정오 표시도 없고, 묶기 단추는 작은 그림이
 * legendBig개일 때만 켜지며, 학급 투표 스탬프를 누르면 ○ 하나와 표 +1이 생긴다.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import type { GraphAction, GraphConfig, GraphState } from '../types';
import { GraphView } from '../View';

afterEach(cleanup);

const JUDGMENT_ATTRIBUTES = ['data-correct', 'data-match', 'data-fit', 'data-ok', 'aria-invalid'];

function Live({
  config,
  cpa = 'C',
  targetSize = 48,
}: {
  readonly config: GraphConfig;
  readonly cpa?: 'C' | 'P' | 'A';
  readonly targetSize?: 48 | 64;
}) {
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
      cpa={cpa}
      mode={state.mode}
      targetSize={targetSize}
    />
  );
}

/** jsdom의 선택자 엔진은 이모지(속성값)를 못 찾아서 속성을 직접 비교한다. */
function find(root: ParentNode, selector: string, attrs: Record<string, string>): Element | null {
  return (
    [...root.querySelectorAll(selector)].find((element) =>
      Object.entries(attrs).every(([name, value]) => element.getAttribute(name) === value),
    ) ?? null
  );
}

const PICTO: GraphConfig = {
  mode: 'pictograph',
  data: { 가: 32, 나: 25 },
  icon: 'apple',
  legendEditable: true,
  valueLabel: '상자',
};

describe('E18 pictograph 화면', () => {
  it('학생이 만드는 그림그래프에는 말풍선도 정오 표시도 없다', () => {
    const { container } = render(<Live config={{ ...PICTO, tooltips: 'show' }} />);
    const add = screen.getByRole('button', { name: '가 작은 그림 놓기' });
    for (let i = 0; i < 12; i += 1) fireEvent.click(add);
    for (const icon of container.querySelectorAll('g[data-kind]')) fireEvent.click(icon);
    expect(container.querySelectorAll('[data-testid="graph-tooltip"]')).toHaveLength(0);
    for (const name of JUDGMENT_ATTRIBUTES) {
      expect(container.querySelectorAll(`[${name}]`)).toHaveLength(0);
    }
  });

  it('묶기 단추는 작은 그림이 9개일 때 비활성, 10개일 때 활성이다', () => {
    render(<Live config={PICTO} />);
    const add = screen.getByRole('button', { name: '가 작은 그림 놓기' });
    const compress = screen.getByRole('button', {
      name: '가 작은 그림 10개를 큰 그림 1개로 묶기',
    }) as HTMLButtonElement;
    for (let i = 0; i < 9; i += 1) fireEvent.click(add);
    expect(compress.disabled).toBe(true);
    fireEvent.click(add);
    expect(compress.disabled).toBe(false);
    fireEvent.click(compress);
    expect(compress.disabled).toBe(true);
    expect(document.querySelectorAll('g[data-cat="가"][data-kind="big"]')).toHaveLength(1);
    expect(document.querySelectorAll('g[data-cat="가"][data-kind="small"]')).toHaveLength(0);
  });

  it('큰 그림에서 Enter를 누르면 펼쳐지고, 펼치기 단추도 같다', () => {
    render(<Live config={PICTO} />);
    const add = screen.getByRole('button', { name: '가 작은 그림 놓기' });
    for (let i = 0; i < 10; i += 1) fireEvent.click(add);
    fireEvent.click(screen.getByRole('button', { name: '가 작은 그림 10개를 큰 그림 1개로 묶기' }));
    const big = document.querySelector('g[data-cat="가"][data-kind="big"]');
    expect(big).not.toBeNull();
    if (big) fireEvent.keyDown(big, { key: 'Enter' });
    expect(document.querySelectorAll('g[data-cat="가"][data-kind="small"]')).toHaveLength(10);
    expect(document.querySelectorAll('g[data-cat="가"][data-kind="big"]')).toHaveLength(0);
    // 펼치기 단추는 큰 그림이 없으면 비활성이다.
    const expand = screen.getByRole('button', {
      name: '가 큰 그림 1개를 작은 그림으로 펼치기',
    }) as HTMLButtonElement;
    expect(expand.disabled).toBe(true);
  });

  it('작은 그림 위에서 Delete를 누르면 하나 빠진다', () => {
    render(<Live config={PICTO} />);
    const add = screen.getByRole('button', { name: '가 작은 그림 놓기' });
    for (let i = 0; i < 3; i += 1) fireEvent.click(add);
    const last = document.querySelector('g[data-cat="가"][data-kind="small"][tabindex="0"]');
    expect(last).not.toBeNull();
    if (last) fireEvent.keyDown(last, { key: 'Delete' });
    expect(document.querySelectorAll('g[data-cat="가"][data-kind="small"]')).toHaveLength(2);
  });

  it('범례 단추 줄(radiogroup)로 큰 그림 값을 바꾼다(놓인 그림은 그대로)', () => {
    render(<Live config={PICTO} />);
    const group = screen.getByRole('radiogroup', { name: '큰 그림 하나가 나타내는 수' });
    expect(group).not.toBeNull();
    const ten = screen.getByRole('radio', { name: '큰 그림 = 10상자' });
    const five = screen.getByRole('radio', { name: '큰 그림 = 5상자' });
    expect(ten.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(five);
    expect(five.getAttribute('aria-checked')).toBe('true');
    expect(
      screen.getByRole('button', { name: '가 작은 그림 5개를 큰 그림 1개로 묶기' }),
    ).not.toBeNull();
  });

  it('legendEditable이 아니면 범례는 글자이고 단추가 없다', () => {
    render(<Live config={{ ...PICTO, legendEditable: false }} />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByTestId('pictograph-legend').textContent).toContain('큰 그림 = 10상자');
  });

  it('그림 한 변은 targetSize이고 누르는 자리(slot)는 그보다 크다', () => {
    render(<Live config={PICTO} targetSize={64} />);
    fireEvent.click(screen.getByRole('button', { name: '가 작은 그림 놓기' }));
    const art = document.querySelector('g[data-kind="small"] [data-art-box]');
    const hit = document.querySelector('g[data-kind="small"] rect[data-hit]');
    // transform scale(side/100) 안의 100×100 상자이므로 한 변은 부모 변환의 배율로 정해진다.
    expect(art?.parentElement?.getAttribute('transform')).toContain('scale(0.64)');
    expect(Number(hit?.getAttribute('width'))).toBeGreaterThanOrEqual(64);
  });
});

describe('E18 table-to-graph 그림그래프 보기', () => {
  const config: GraphConfig = {
    mode: 'table-to-graph',
    data: { 가: 32, 나: 25, 다: 41, 라: 18 },
    views: ['table', 'pictograph'],
    legend: { big: 10, small: 1 },
    valueLabel: '상자',
  };

  it('자료를 큰 그림과 작은 그림으로 그린다(32 → 큰 3 + 작은 2)', () => {
    render(<Live config={config} />);
    expect(document.querySelectorAll('g[data-cat="가"][data-kind="big"]')).toHaveLength(3);
    expect(document.querySelectorAll('g[data-cat="가"][data-kind="small"]')).toHaveLength(2);
    expect(document.querySelectorAll('g[data-cat="다"][data-kind="big"]')).toHaveLength(4);
    expect(document.querySelector('[data-testid="graph-table"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /작은 그림 놓기/ })).toBeNull();
  });

  it('C·P 단계에서 그림을 누르면 그 행 값 말풍선이 나오고, A 단계에서는 없다', () => {
    const shown = render(<Live config={config} cpa="P" />);
    const icon = shown.container.querySelector('g[data-cat="다"][data-kind="big"]');
    if (icon) fireEvent.click(icon);
    expect(screen.getByTestId('graph-tooltip').textContent).toContain('다: 41상자');
    cleanup();
    const hidden = render(<Live config={config} cpa="A" />);
    const again = hidden.container.querySelector('g[data-cat="다"][data-kind="big"]');
    if (again) fireEvent.click(again);
    expect(hidden.container.querySelectorAll('[data-testid="graph-tooltip"]')).toHaveLength(0);
  });
});

describe('E18 class-vote 화면', () => {
  const config: GraphConfig = {
    mode: 'class-vote',
    question: '좋아하는 과일',
    options: ['🍎', '🍌', '🍇', '🍓'],
    transport: 'local-device',
    graphType: 'o-mark',
    showTable: 'sync',
  };

  it('질문 글과 스탬프 단추가 선택지마다 있다', () => {
    render(<Live config={config} />);
    expect(screen.getByTestId('vote-question').textContent).toBe('좋아하는 과일');
    for (const option of config.options as string[]) {
      expect(find(document, 'button', { 'data-option': option })).not.toBeNull();
    }
  });

  it('스탬프를 누르면 ○ 하나가 아래부터 쌓이고 표가 +1 된다', () => {
    const { container } = render(<Live config={config} />);
    const cell = (index: number) =>
      find(container, 'g', { 'data-cat': '🍎', 'data-cell': String(index) });
    expect(cell(0)?.getAttribute('data-filled')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: '🍎 스탬프 찍기' }));
    expect(cell(0)?.getAttribute('data-filled')).toBe('true');
    expect(cell(1)?.getAttribute('data-filled')).toBe('false');
    expect(find(container, 'td', { 'data-cat': '🍎' })?.textContent).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: '🍎 스탬프 찍기' }));
    expect(cell(1)?.getAttribute('data-filled')).toBe('true');
    expect(find(container, 'td', { 'data-cat': '🍎' })?.textContent).toBe('2');
    expect(find(container, 'td', { 'data-cat': '🍌' })?.textContent).toBe('0');
  });

  it('하나 지우기로 마지막 투표를 취소하고, 열이 다 차면 그 스탬프가 비활성이다', () => {
    const { container } = render(<Live config={{ ...config, axisMax: 2 }} />);
    const stamp = screen.getByRole('button', { name: '🍎 스탬프 찍기' }) as HTMLButtonElement;
    fireEvent.click(stamp);
    fireEvent.click(stamp);
    expect(stamp.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('vote-undo'));
    expect(stamp.disabled).toBe(false);
    expect(find(container, 'td', { 'data-cat': '🍎' })?.textContent).toBe('1');
  });

  it('학생 이름·사진·생년월일 입력란이 없다', () => {
    const { container } = render(<Live config={config} />);
    expect(container.querySelectorAll('input, textarea, select')).toHaveLength(0);
  });

  it('투표 그래프에는 말풍선과 정오 표시가 없고 ○ 칸을 눌러도 바뀌지 않는다', () => {
    const { container } = render(<Live config={config} />);
    const cell = find(container, 'g', { 'data-cat': '🍎', 'data-cell': '0' });
    if (cell) fireEvent.click(cell);
    expect(cell?.getAttribute('data-filled')).toBe('false');
    expect(container.querySelectorAll('[data-testid="graph-tooltip"]')).toHaveLength(0);
    for (const name of JUDGMENT_ATTRIBUTES) {
      expect(container.querySelectorAll(`[${name}]`)).toHaveLength(0);
    }
  });
});
