/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PrismNetClashOverlay } from '../overlays/prism-net-clash';
import { createInitialState, reduce } from '../reduce';
import type { PrismNetConfig, PrismNetState, SolidAction } from '../types';
import { SolidView } from '../View';

afterEach(() => {
  cleanup();
});

let latest: PrismNetState | null = null;

function Harness({
  config,
  initialActions = [],
  overlay = false,
}: {
  readonly config?: Partial<PrismNetConfig>;
  readonly initialActions?: readonly SolidAction[];
  readonly overlay?: boolean;
}) {
  const full: PrismNetConfig = { mode: 'net-fold', target: 'prism', ...config };
  const [state, setState] = useState<PrismNetState>(() => {
    let s: PrismNetState = createInitialState(full);
    for (const act of initialActions) s = reduce(s, act);
    return s;
  });
  useEffect(() => {
    latest = state;
  }, [state]);
  return (
    <div style={{ position: 'relative', width: 960, height: 640 }}>
      <SolidView
        config={full}
        state={state}
        dispatch={(action) => setState((prev) => reduce(prev, action))}
        cpa="C"
        mode="net-fold"
        targetSize={48}
      />
      {overlay ? <PrismNetClashOverlay config={full} state={state} /> : null}
    </div>
  );
}

const pick = (pieceType: 'base' | 'rect' | null): SolidAction => ({
  type: 'select-piece-type',
  pieceType,
});
const attach = (parent: number | null, parentEdge: number): SolidAction => ({
  type: 'attach',
  parent,
  parentEdge,
});

const TRI_PRISM: readonly SolidAction[] = [
  pick('rect'),
  attach(null, 0),
  attach(0, 1),
  attach(1, 1),
  pick('base'),
  attach(0, 0),
  attach(2, 2),
];
const TRI_TOPS_ONLY: readonly SolidAction[] = [
  pick('rect'),
  attach(null, 0),
  attach(0, 1),
  attach(1, 1),
  pick('base'),
  attach(0, 2),
  attach(2, 2),
];

describe('E12 prism-net View', () => {
  it('처음에는 조각이 없고 고른 종류가 없으면 손잡이도 없다', () => {
    render(<Harness />);
    expect(screen.getByTestId('prismnet-view').getAttribute('data-mode')).toBe('prism-net');
    expect(screen.getByTestId('prismnet-board')).toBeTruthy();
    expect(screen.queryByTestId('prismnet-root-handle')).toBeNull();
    expect(screen.getByTestId('prismnet-remaining-base').textContent).toBe('남은 조각 2');
    expect(screen.getByTestId('prismnet-remaining-rect').textContent).toBe('남은 조각 3');
    expect(screen.getByTestId('prismnet-fold').hasAttribute('disabled')).toBe(true);
  });

  it('조각 종류를 고르면 뿌리 손잡이가 나오고, 누르면 조각이 놓인다', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('prismnet-type-rect'));
    expect(screen.getByTestId('prismnet-type-rect').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('prismnet-root-handle'));
    expect(screen.getByTestId('prismnet-piece-0')).toBeTruthy();
    expect(latest?.pieces).toHaveLength(1);
    expect(screen.getByTestId('prismnet-remaining-rect').textContent).toBe('남은 조각 2');
  });

  it('손잡이는 고른 종류에 맞는 변에만 있다', () => {
    render(<Harness initialActions={[pick('rect'), attach(null, 0)]} />);
    // 옆면을 고른 상태: 네 변 모두
    for (const e of [0, 1, 2, 3]) expect(screen.getByTestId(`prismnet-handle-0-${e}`)).toBeTruthy();
    // 밑면으로 바꾸면 s 변(0, 2)에만
    fireEvent.click(screen.getByTestId('prismnet-type-base'));
    expect(screen.getByTestId('prismnet-handle-0-0')).toBeTruthy();
    expect(screen.getByTestId('prismnet-handle-0-2')).toBeTruthy();
    expect(screen.queryByTestId('prismnet-handle-0-1')).toBeNull();
    expect(screen.queryByTestId('prismnet-handle-0-3')).toBeNull();
    // 쓴 변에는 손잡이가 없다
    fireEvent.click(screen.getByTestId('prismnet-handle-0-0'));
    expect(screen.queryByTestId('prismnet-handle-0-0')).toBeNull();
  });

  it('고른 종류를 풀면 손잡이가 사라진다', () => {
    render(<Harness initialActions={[pick('rect'), attach(null, 0)]} />);
    expect(screen.getByTestId('prismnet-handle-0-1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('prismnet-type-rect'));
    expect(screen.queryByTestId('prismnet-handle-0-1')).toBeNull();
  });

  it('키보드: B/R로 종류 고르기, Enter로 붙이기, F로 접기, Delete로 빼기', () => {
    render(<Harness />);
    const view = screen.getByTestId('prismnet-view');
    fireEvent.keyDown(view, { key: 'r' });
    expect(latest?.selectedType).toBe('rect');
    fireEvent.keyDown(screen.getByTestId('prismnet-root-handle'), { key: 'Enter' });
    expect(latest?.pieces).toHaveLength(1);
    fireEvent.keyDown(screen.getByTestId('prismnet-handle-0-1'), { key: ' ' });
    expect(latest?.pieces).toHaveLength(2);
    fireEvent.keyDown(view, { key: 'b' });
    expect(latest?.selectedType).toBe('base');
    // 조각을 Enter로 고르고 Delete로 뺀다(잎 조각)
    fireEvent.keyDown(screen.getByTestId('prismnet-piece-1'), { key: 'Enter' });
    expect(screen.getByTestId('prismnet-piece-1').getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(view, { key: 'Delete' });
    expect(latest?.pieces).toHaveLength(1);
    fireEvent.keyDown(view, { key: 'F' });
    expect(latest?.folded).toBe(true);
    fireEvent.keyDown(view, { key: 'f' });
    expect(latest?.folded).toBe(false);
  });

  it('조각을 두 번 누르면 잎 조각만 빠진다', () => {
    render(<Harness initialActions={[pick('rect'), attach(null, 0), attach(0, 1)]} />);
    fireEvent.click(screen.getByTestId('prismnet-piece-0'));
    expect(screen.getByTestId('prismnet-remove').hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByTestId('prismnet-piece-0'));
    expect(latest?.pieces).toHaveLength(2);
    fireEvent.click(screen.getByTestId('prismnet-piece-1'));
    fireEvent.click(screen.getByTestId('prismnet-remove'));
    expect(latest?.pieces).toHaveLength(1);
  });

  it('접으면 valid는 접힌 무대, 아니면 상태 글과 문제 조각 무늬', () => {
    const { unmount } = render(<Harness initialActions={TRI_PRISM} />);
    fireEvent.click(screen.getByTestId('prismnet-fold'));
    expect(screen.getByTestId('prismnet-folded-stage')).toBeTruthy();
    expect(screen.getByTestId('prismnet-fold-status').textContent).toBe('각기둥으로 접혔어요!');
    expect(screen.queryByText('접히지 않아요')).toBeNull();
    fireEvent.click(screen.getByTestId('prismnet-fold'));
    expect(screen.queryByTestId('prismnet-folded-stage')).toBeNull();
    unmount();

    render(<Harness initialActions={TRI_TOPS_ONLY} />);
    fireEvent.click(screen.getByTestId('prismnet-fold'));
    expect(screen.queryByTestId('prismnet-folded-stage')).toBeNull();
    expect(screen.getByTestId('prismnet-fold-status').textContent).toBe('접히지 않아요');
    // 같은 자리로 가는 밑면 둘에 무늬가 있다
    expect(screen.getByTestId('prismnet-hatch-3')).toBeTruthy();
    expect(screen.getByTestId('prismnet-hatch-4')).toBeTruthy();
    expect(screen.queryByTestId('prismnet-hatch-0')).toBeNull();
  });

  it('collisionHighlight:false면 무늬를 칠하지 않는다', () => {
    render(<Harness config={{ collisionHighlight: false }} initialActions={TRI_TOPS_ONLY} />);
    fireEvent.click(screen.getByTestId('prismnet-fold'));
    expect(screen.getByTestId('prismnet-fold-status').textContent).toBe('접히지 않아요');
    expect(screen.queryByTestId('prismnet-hatch-3')).toBeNull();
  });

  it('조각이 가는 자리 이름(data-slot)과 판정 이유가 화면에 없다', () => {
    const { container } = render(<Harness initialActions={TRI_TOPS_ONLY} />);
    fireEvent.click(screen.getByTestId('prismnet-fold'));
    expect(container.querySelector('[data-slot]')).toBeNull();
    const html = container.innerHTML;
    expect(html).not.toMatch(/data-slot|slot/i);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/자리|같은 곳|겹쳐|빈 곳|겹침|중복|\bS[0-9]\b/);
    expect(text).not.toMatch(/정답|맞았|틀렸/);
  });

  it('showLengths: 변에 길이 글자가 있다', () => {
    const { container } = render(
      <Harness config={{ showLengths: true }} initialActions={[pick('rect'), attach(null, 0)]} />,
    );
    const texts = Array.from(
      container.querySelectorAll('svg[data-testid="prismnet-board"] text'),
    ).map((t) => t.textContent);
    expect(texts.sort()).toEqual(['2', '2', '3', '3']);
  });

  it('보기 카드(가·나·다)를 판에 함께 보여 준다', () => {
    render(
      <Harness
        config={{
          netCards: [
            {
              id: 'a',
              label: '가',
              root: 'rect',
              steps: [{ parent: 0, parentEdge: 1, type: 'rect' }],
            },
            { id: 'b', label: '나', root: 'base', steps: [] },
            { id: 'c', label: '다', root: 'rect', steps: [] },
          ],
        }}
      />,
    );
    expect(screen.getByTestId('prismnet-cards').getAttribute('data-card-count')).toBe('3');
    for (const id of ['a', 'b', 'c'])
      expect(screen.getByTestId(`prismnet-card-${id}`)).toBeTruthy();
    expect(screen.getByTestId('prismnet-board')).toBeTruthy();
  });

  it('카드만 보기: 판과 도구를 빼고 카드를 크게 보인다', () => {
    const { container } = render(
      <Harness
        config={{
          editable: false,
          foldable: false,
          netCards: [
            { id: 'a', label: '가', root: 'rect', steps: [] },
            { id: 'b', label: '나', root: 'base', steps: [] },
          ],
        }}
      />,
    );
    expect(screen.queryByTestId('prismnet-board')).toBeNull();
    expect(screen.queryByTestId('prismnet-fold')).toBeNull();
    expect(screen.queryByTestId('prismnet-type-base')).toBeNull();
    expect(screen.getByTestId('prismnet-cards').getAttribute('data-card-size')).toBe('large');
    expect(container.querySelector('[data-net-cards-only="true"]')).not.toBeNull();
  });

  it('given이 있으면 카드만 보기가 아니다', () => {
    render(
      <Harness
        config={{
          editable: false,
          foldable: false,
          given: [{ type: 'rect', parent: null }],
          netCards: [{ id: 'a', label: '가', root: 'rect', steps: [] }],
        }}
      />,
    );
    expect(screen.getByTestId('prismnet-board')).toBeTruthy();
  });

  it('readOnly면 손잡이·단추가 동작하지 않는다', () => {
    const full: PrismNetConfig = { mode: 'net-fold', target: 'prism' };
    const state = reduce(reduce(createInitialState(full), pick('rect')), attach(null, 0));
    const calls: SolidAction[] = [];
    render(
      <SolidView
        config={full}
        state={state}
        dispatch={(a) => calls.push(a)}
        readOnly
        cpa="C"
        mode="net-fold"
        targetSize={48}
      />,
    );
    expect(screen.queryByTestId('prismnet-handle-0-1')).toBeNull();
    fireEvent.click(screen.getByTestId('prismnet-piece-0'));
    expect(calls).toEqual([]);
  });
});

describe('prism-net-clash 오버레이', () => {
  it('같은 자리로 가는 조각이 있으면 빗금과 곡선 화살표를 그린다', () => {
    render(<Harness overlay initialActions={TRI_TOPS_ONLY} />);
    expect(screen.getByTestId('prism-net-clash')).toBeTruthy();
    expect(screen.getByTestId('prism-net-clash-title').textContent).toBe(
      '접으면 같은 자리로 가는 조각이 있을까요?',
    );
    expect(screen.getAllByTestId('prism-net-clash-arrow')).toHaveLength(1);
  });

  it('중복이 없거나 조각이 없으면 그리지 않는다', () => {
    const { unmount } = render(<Harness overlay initialActions={TRI_PRISM} />);
    expect(screen.queryByTestId('prism-net-clash')).toBeNull();
    unmount();
    render(<Harness overlay />);
    expect(screen.queryByTestId('prism-net-clash')).toBeNull();
  });
});
