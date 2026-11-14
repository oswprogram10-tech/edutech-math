/** @vitest-environment jsdom */
/** E12 3D 입체 View·오버레이 단위 테스트. */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HiddenRevealOverlay } from '../overlays/hidden-reveal';
import { RowLineupOverlay } from '../overlays/row-lineup';
import { SideEyeOverlay } from '../overlays/side-eye';
import { createInitialState, reduce } from '../reduce';
import type { SolidConfig } from '../types';
import { SolidView } from '../View';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderHarness(config: SolidConfig = {}) {
  function Harness() {
    const [state, setState] = useState(() => createInitialState(config));
    return (
      <SolidView
        config={config}
        state={state}
        dispatch={(action) => setState((current) => reduce(current, action))}
        cpa="C"
        mode="cubes"
        targetSize={48}
      />
    );
  }
  return render(<Harness />);
}

describe('E12 View 기본 동작과 정답 노출 금지', () => {
  it('기본 설정 무대 화면에 높이·개수 숫자 글자가 없다', () => {
    const { container } = renderHarness({
      initial: [{ at: [0, 0, 0] }, { at: [0, 0, 1] }, { at: [1, 0, 0] }],
    });
    const text = container.textContent ?? '';
    expect(/\d/.test(text)).toBe(false);
    expect(container.querySelector('[data-testid="cubes-view-top"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cubes-view-front"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cubes-view-side"]')).not.toBeNull();
  });

  it('views가 빈 배열이면 투영 뷰를 그리지 않는다', () => {
    const { container } = renderHarness({ views: [] });
    expect(container.querySelectorAll('[data-testid^="cubes-view-"]')).toHaveLength(0);
  });

  it('rotationLocked가 true면 회전 단추를 숨기고 Q/E 키를 무시한다', () => {
    const { container, getByTestId, queryByRole } = renderHarness({ rotationLocked: true });
    expect(queryByRole('button', { name: '왼쪽으로 돌리기' })).toBeNull();
    expect(queryByRole('button', { name: '오른쪽으로 돌리기' })).toBeNull();

    const canvas = getByTestId('cubes-canvas');
    fireEvent.keyDown(canvas, { key: 'e' });
    expect(container.querySelector('[data-testid="cubes-front-marker"]')).not.toBeNull();
  });

  it('키보드로 커서를 옮기고 쌓고 빼고 돌리고 반투명을 켠다', () => {
    const { container, getByTestId } = renderHarness({ grid: [4, 4] });
    const canvas = getByTestId('cubes-canvas');

    fireEvent.keyDown(canvas, { key: 'Enter' });
    expect(container.querySelectorAll('[data-cube]')).toHaveLength(1);

    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    fireEvent.keyDown(canvas, { key: 'Enter' });
    expect(container.querySelector('[data-cube="1,0,0"]')).not.toBeNull();

    fireEvent.keyDown(canvas, { key: 'Backspace' });
    expect(container.querySelector('[data-cube="1,0,0"]')).toBeNull();

    fireEvent.keyDown(canvas, { key: 't' });
    const topPoly = container.querySelector('[data-cube="0,0,0"] polygon');
    expect(topPoly?.getAttribute('fill-opacity')).toBe('0.35');
  });

  it('길게 누르기(600ms)는 빼기를 보내고, 8px 넘게 움직이면 누르기를 취소한다', () => {
    vi.useFakeTimers();
    const { container } = renderHarness({
      initial: [{ at: [0, 0, 0] }, { at: [0, 0, 1] }],
    });
    const col = container.querySelector('[data-col="0,0"]');
    expect(col).not.toBeNull();
    if (!col) return;

    // 600ms 넘게 누르면 remove 1회 발생, pointerup에서는 추가 동작 없음
    fireEvent.pointerDown(col, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
    act(() => {
      vi.advanceTimersByTime(650);
    });
    fireEvent.pointerUp(col, { pointerId: 1, clientX: 10, clientY: 10 });
    expect(container.querySelectorAll('[data-cube]')).toHaveLength(1);

    // 8px 넘게 움직이면 add도 remove도 일어나지 않는다
    fireEvent.pointerDown(col, { pointerId: 2, clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(col, { pointerId: 2, clientX: 30, clientY: 10 });
    fireEvent.pointerUp(col, { pointerId: 2, clientX: 30, clientY: 10 });
    expect(container.querySelectorAll('[data-cube]')).toHaveLength(1);
  });

  it('투영 뷰 칸을 누르면 해당 쌓기나무가 강조되고, 다시 누르면 풀린다', () => {
    const { container, getByTestId } = renderHarness({
      grid: [3, 3],
      maxHeight: 3,
      initial: [{ at: [0, 0, 0] }, { at: [0, 1, 0] }, { at: [1, 0, 0] }],
    });

    const frontViewSvg = getByTestId('cubes-view-front');
    const bottomLeft = frontViewSvg.querySelector('[data-cell="2,0"]');
    expect(bottomLeft).not.toBeNull();
    if (!bottomLeft) return;

    fireEvent.click(bottomLeft);
    // x = 0, z = 0 인 (0,0,0)과 (0,1,0) 두 개가 강조된다.
    expect(container.querySelectorAll('[data-focused-cube="true"]')).toHaveLength(2);

    // 같은 칸을 다시 누르면 강조가 풀린다.
    fireEvent.click(bottomLeft);
    expect(container.querySelectorAll('[data-focused-cube="true"]')).toHaveLength(0);
  });

  it('reference와 referenceViews를 보기 그림으로 그리고 도구 막대 앞에 둔다', () => {
    const { container } = renderHarness({
      reference: {
        cubes: [
          [0, 0, 0],
          [1, 0, 0],
        ],
      },
      referenceViews: {
        top: [
          [1, 0],
          [1, 1],
        ],
      },
    });
    const refShape = container.querySelector('[data-testid="cubes-reference"]');
    const refTop = container.querySelector('[data-testid="cubes-reference-top"]');
    const toolbar = container.querySelector('[role="toolbar"]');
    expect(refShape).not.toBeNull();
    expect(refTop).not.toBeNull();
    expect(toolbar).not.toBeNull();
    if (refTop && toolbar) {
      expect(
        Boolean(refTop.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING),
      ).toBe(true);
      expect(Number(refTop.getAttribute('width'))).toBeGreaterThanOrEqual(70);
      expect(Number(refTop.getAttribute('height'))).toBeGreaterThanOrEqual(70);
    }
  });

  it('editable이 false면 쌓기·빼기·모두 빼기 단추·커서·상태 문구를 숨기고 Q/E·T만 남긴다', () => {
    const { container, getByTestId, queryByRole, getByText } = renderHarness({
      editable: false,
      maxCubes: 1,
      initial: [{ at: [0, 0, 0], locked: true }],
    });

    expect(queryByRole('button', { name: '쌓기' })).toBeNull();
    expect(queryByRole('button', { name: '빼기' })).toBeNull();
    expect(queryByRole('button', { name: '모두 빼기' })).toBeNull();
    expect(queryByRole('button', { name: '왼쪽으로 돌리기' })).not.toBeNull();
    expect(queryByRole('button', { name: '오른쪽으로 돌리기' })).not.toBeNull();
    expect(queryByRole('button', { name: '반투명' })).not.toBeNull();

    expect(getByTestId('cubes-status').textContent).toBe('');
    expect(container.querySelector('[data-testid="cubes-cursor"]')).toBeNull();
    expect(getByText('쌓기나무를 돌려 보며 살펴보아요.')).not.toBeNull();
    expect(getByText('Q/E: 돌리기 · T: 반투명')).not.toBeNull();

    const stage = getByTestId('cubes-stage');
    fireEvent.keyDown(stage, { key: 'Enter' });
    fireEvent.keyDown(stage, { key: 'Backspace' });
    expect(container.querySelectorAll('[data-cube]')).toHaveLength(1);

    fireEvent.keyDown(stage, { key: 't' });
    const topPoly = container.querySelector('[data-cube="0,0,0"] polygon');
    expect(topPoly?.getAttribute('fill-opacity')).toBe('0.35');
  });

  it('rotationLocked가 true면 안내 문구에서 돌리기를 빼고, editable:false와 함께일 때 잠금 안내를 쓴다', () => {
    const editLocked = renderHarness({ rotationLocked: true });
    expect(
      editLocked.getByText('방향키: 칸 옮기기 · Enter: 쌓기 · Backspace: 빼기 · T: 반투명'),
    ).not.toBeNull();
    cleanup();

    const viewLocked = renderHarness({ editable: false, rotationLocked: true });
    expect(viewLocked.getByText('쌓기나무를 살펴보아요.')).not.toBeNull();
    expect(viewLocked.getByText('T: 반투명')).not.toBeNull();
  });

  it('오버레이 3개가 안전하게 동작한다(row-lineup 잘못된 인자는 빈 렌더)', () => {
    const config: SolidConfig = {
      grid: [2, 2],
      maxHeight: 2,
      initial: [
        { at: [0, 0, 0] },
        { at: [0, 0, 1] },
        { at: [1, 0, 0] },
        { at: [1, 0, 1] },
        { at: [0, 1, 0] },
        { at: [0, 1, 1] },
        { at: [1, 1, 0] },
        { at: [1, 1, 1] },
      ],
    };
    const state = createInitialState(config);

    const hidden = render(<HiddenRevealOverlay config={config} state={state} />);
    expect(hidden.container.querySelectorAll('[data-hidden-cube]')).toHaveLength(1);
    cleanup();

    const eye = render(<SideEyeOverlay config={config} state={state} />);
    expect(eye.container.querySelector('[data-testid="side-eye"]')).not.toBeNull();
    cleanup();

    const lineupEmpty = render(<RowLineupOverlay config={config} state={state} />);
    expect(lineupEmpty.container.querySelector('[data-testid="row-lineup"]')).toBeNull();
    cleanup();

    const lineupBad = render(<RowLineupOverlay config={config} state={state} args={{ x: 9 }} />);
    expect(lineupBad.container.querySelector('[data-testid="row-lineup"]')).toBeNull();
    cleanup();

    const lineupOk = render(<RowLineupOverlay config={config} state={state} args={{ x: 0 }} />);
    expect(lineupOk.container.querySelector('[data-testid="row-lineup"]')).not.toBeNull();
  });
});

describe('E12 T134 2D 입력판·슬라이더·paintViews·stageHidden', () => {
  it('numberGrid input은 선택 빈칸만 0을 보이고 클릭·키보드로 수를 넣는다', () => {
    const { container } = renderHarness({
      grid: [2, 2],
      maxHeight: 3,
      numberGrid: { mode: 'input' },
    });
    const grid = container.querySelector('[data-testid="cubes-numbers"]') as HTMLElement;
    expect(grid).not.toBeNull();
    // 초기 선택 칸 [0,0]은 "0", 비선택 칸 [0,1]은 빈칸
    expect(container.querySelector('[data-num-cell="0,0"]')?.textContent).toBe('0');
    expect(container.querySelector('[data-num-cell="0,1"]')?.textContent).toBe('');

    fireEvent.click(container.querySelector('[data-num-cell="1,0"]') as HTMLElement);
    fireEvent.keyDown(grid, { key: '2' });
    expect(container.querySelector('[data-num-cell="1,0"]')?.textContent).toBe('2');
  });

  it('layers slider와 panel paint가 반투명과 PageUp/PageDown 키보드로 동작한다', () => {
    const { container } = renderHarness({
      grid: [2, 2],
      maxHeight: 3,
      layers: { slider: true, panel: 'paint' },
      initial: [{ at: [0, 0, 0] }, { at: [0, 0, 1] }],
    });
    const btn2 = container.querySelector('[data-testid="cubes-layer-btn-2"]') as HTMLElement;
    fireEvent.click(btn2);
    expect(btn2.getAttribute('aria-pressed')).toBe('true');
    const cubeBottom = container.querySelector('[data-cube="0,0,0"] polygon');
    const cubeTwo = container.querySelector('[data-cube="0,0,1"] polygon');
    expect(cubeBottom?.getAttribute('fill-opacity')).toBe('0.2');
    expect(cubeTwo?.getAttribute('fill-opacity')).toBe('1');
    expect(
      container.querySelector('[data-testid="cubes-layer-2"]')?.getAttribute('data-layer-active'),
    ).toBe('true');

    const card1 = container.querySelector('[data-testid="cubes-layer-1"]') as HTMLElement;
    fireEvent.keyDown(card1, { key: 'Enter' });
    expect(container.querySelector('[data-layer-cell="1,0,0"]')?.getAttribute('data-filled')).toBe(
      'true',
    );
    fireEvent.keyDown(card1, { key: 'PageUp' });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('cubes-layer-2');
  });

  it('paintViews와 views가 겹치면 경고를 내고 실시간 투영을 숨기며 stageHidden은 무대를 숨긴다', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = renderHarness({
      grid: [2, 2],
      maxHeight: 2,
      views: ['top', 'front', 'side'],
      paintViews: ['side'],
      stageHidden: true,
    });
    expect(warnSpy).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="cubes-stage"]')).toBeNull();
    expect(container.querySelector('[data-testid="cubes-view-side"]')).toBeNull();
    expect(container.querySelector('[data-testid="cubes-view-top"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cubes-paint-side"]')).not.toBeNull();
    warnSpy.mockRestore();
  });
});
