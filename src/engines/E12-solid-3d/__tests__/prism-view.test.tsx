/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ApexGatherOverlay } from '../overlays/apex-gather';
import { PrismPeekOverlay } from '../overlays/prism-peek';
import { StandUpOverlay } from '../overlays/stand-up';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { PrismConfig, PrismState, SolidAction } from '../types';
import { SolidView } from '../View';

afterEach(() => {
  cleanup();
});

let latest: PrismState | null = null;

function Harness({
  config,
  initialActions = [],
  overlays = false,
}: {
  readonly config: Partial<PrismConfig>;
  readonly initialActions?: readonly SolidAction[];
  readonly overlays?: boolean;
}) {
  const full: PrismConfig = { mode: 'prism-pyramid', ...config };
  const [state, setState] = useState<PrismState>(() => {
    let s: PrismState = createInitialState(full);
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
        mode="prism-pyramid"
        targetSize={48}
      />
      {overlays ? (
        <>
          <ApexGatherOverlay config={full} state={state} />
          <PrismPeekOverlay config={full} state={state} />
          <StandUpOverlay config={full} state={state} />
        </>
      ) : null}
    </div>
  );
}

describe('E12 prism-pyramid View', () => {
  it('화면 어디에도 면·모서리·꼭짓점 개수 문구가 없다', () => {
    const { container } = render(
      <Harness
        config={{ counterTable: true }}
        initialActions={[
          { type: 'set-sides', n: 5 },
          { type: 'set-height', h: 3 },
          { type: 'toggle-mark', kind: 'face', id: 'top' },
          { type: 'add-table-row' },
        ]}
      />,
    );
    const text = container.textContent ?? '';
    // 참 개수(오각기둥 7·15·10)나 표시 개수 문구가 없다
    expect(text).not.toMatch(/다 찾|모두 찾|찾았|맞았|틀렸|정답/);
    expect(text).not.toMatch(/[0-9]+\s*개\s*(표시|찾)/);
    expect(text).not.toContain('면 7');
    expect(text).not.toContain('15');
    // 빈 칸이 그대로 비어 있다
    expect((screen.getByTestId('prism-cell-0-faces') as HTMLInputElement).value).toBe('');
    // 맞음·틀림 표시 속성도 없다
    expect(container.querySelector('[aria-invalid]')).toBeNull();
    expect(container.querySelector('[data-correct]')).toBeNull();
  });

  it('입체 이름을 보여 주고 showName:false면 숨긴다', () => {
    const r = render(<Harness config={{ initial: { sides: 5, height: 2 } }} />);
    expect(screen.getByTestId('prism-name').textContent).toBe('오각기둥');
    fireEvent.click(screen.getByTestId('prism-apex'));
    expect(screen.getByTestId('prism-name').textContent).toBe('오각뿔');
    fireEvent.click(screen.getByTestId('prism-extrude'));
    r.unmount();

    render(<Harness config={{ initial: { sides: 5, height: 0 } }} />);
    expect(screen.getByTestId('prism-name').textContent).toBe('오각형');
    cleanup();

    render(<Harness config={{ initial: { sides: 6, height: 1, top: 'apex' }, showName: false }} />);
    expect(screen.queryByTestId('prism-name')).toBeNull();
  });

  it('도구별로 누를 수 있는 요소가 나뉘고 엑스레이에 따라 숨은 모서리 그림이 바뀐다', () => {
    render(<Harness config={{ initial: { sides: 4, height: 2 } }} />);
    // 면 도구: 보이는 면만 있다
    expect(screen.getByTestId('prism-face-top').getAttribute('role')).toBe('button');
    expect(screen.queryByTestId('prism-face-bottom')).toBeNull();
    fireEvent.click(screen.getByTestId('prism-face-top'));
    expect(screen.getByTestId('prism-face-top').getAttribute('data-marked')).toBe('true');
    // 모서리는 면 도구에서 누를 수 없고 숨은 모서리는 그려지지 않는다
    expect(screen.getByTestId('prism-edge-eb0').getAttribute('role')).toBeNull();
    expect(
      document.querySelectorAll('[data-testid^="prism-edge-"][data-hidden="true"]'),
    ).toHaveLength(0);
    // 엑스레이: 숨은 모서리 등장
    fireEvent.click(screen.getByTestId('prism-toggle-xray'));
    expect(
      document.querySelectorAll('[data-testid^="prism-edge-"][data-hidden="true"]').length,
    ).toBeGreaterThanOrEqual(1);
    // 모서리 도구
    fireEvent.click(screen.getByTestId('prism-tool-edge'));
    const hidden = document.querySelector('[data-testid^="prism-edge-"][data-hidden="true"]');
    expect(hidden?.getAttribute('role')).toBe('button');
    fireEvent.click(hidden as Element);
    expect(hidden?.getAttribute('data-marked')).toBe('true');
    // 꼭짓점 도구
    fireEvent.click(screen.getByTestId('prism-tool-vertex'));
    fireEvent.click(screen.getByTestId('prism-vertex-b0'));
    expect(latest?.marked.vertices).toEqual(['b0']);
    // 표시 지우기
    fireEvent.click(screen.getByTestId('prism-clear-marks'));
    expect(latest?.marked).toEqual({ faces: [], edges: [], vertices: [] });
  });

  it('높이 0(평면도형)에서는 표시 도구와 표 적기를 막는다', () => {
    render(<Harness config={{ counterTable: true, initial: { sides: 4, height: 0 } }} />);
    expect((screen.getByTestId('prism-tool-face') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('prism-table-add') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('prism-face-bottom').getAttribute('role')).toBeNull();
  });

  it('손잡이·n 단추·키보드로 입체를 만든다', () => {
    render(<Harness config={{ counterTable: true }} />);
    const view = screen.getByTestId('prism-view');
    expect(latest?.sides).toBe(3);

    fireEvent.click(screen.getByTestId('prism-sides-inc'));
    fireEvent.click(screen.getByTestId('prism-sides-inc'));
    expect(latest?.sides).toBe(5);
    expect(screen.getByTestId('prism-sides-value').textContent).toBe('변 5개');
    fireEvent.click(screen.getByTestId('prism-sides-dec'));
    expect(latest?.sides).toBe(4);

    // 키보드: [ ] / PageUp PageDown / A
    fireEvent.keyDown(view, { key: ']' });
    fireEvent.keyDown(view, { key: ']' });
    expect(latest?.sides).toBe(6);
    fireEvent.keyDown(view, { key: '[' });
    expect(latest?.sides).toBe(5);
    fireEvent.keyDown(view, { key: 'PageUp' });
    fireEvent.keyDown(view, { key: 'PageUp' });
    expect(latest?.height).toBe(2);
    expect(screen.getByTestId('prism-extrude').getAttribute('aria-valuenow')).toBe('2');
    fireEvent.keyDown(view, { key: 'PageDown' });
    expect(latest?.height).toBe(1);
    fireEvent.keyDown(view, { key: 'a' });
    expect(latest?.top).toBe('apex');
    expect(screen.getByTestId('prism-apex').getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(view, { key: 'A' });
    expect(latest?.top).toBe('flat');

    // 손잡이 자체의 방향키
    const handle = screen.getByTestId('prism-extrude');
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(latest?.height).toBe(2);
    fireEvent.keyDown(handle, { key: 'End' });
    expect(latest?.height).toBe(4);
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(latest?.height).toBe(4);
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(latest?.height).toBe(0);

    // Q/E/W/S/X
    fireEvent.keyDown(view, { key: 'e' });
    expect(latest?.view.yaw).toBe(45);
    fireEvent.keyDown(view, { key: 'q' });
    fireEvent.keyDown(view, { key: 'w' });
    expect(latest?.view.pitch).toBe(45);
    fireEvent.keyDown(view, { key: 's' });
    expect(latest?.view).toEqual({ yaw: 30, pitch: 30 });
    fireEvent.keyDown(view, { key: 'x' });
    expect(latest?.xray).toBe(true);
    expect(screen.getByTestId('prism-toggle-xray').getAttribute('aria-pressed')).toBe('true');
  });

  it('밀어 올리기 트랙을 끌면 가장 가까운 칸에 맞춘다', () => {
    render(<Harness config={{}} />);
    const track = screen.getByTestId('prism-extrude-track');
    track.getBoundingClientRect = () =>
      ({
        top: 100,
        left: 0,
        bottom: 268,
        right: 56,
        width: 56,
        height: 168,
        x: 0,
        y: 100,
      }) as DOMRect;
    // 손잡이 중심 이동 범위: 100+24 ~ 268-24 = 124..244. 맨 위=높이 4, 맨 아래=높이 0.
    fireEvent.pointerDown(track, { pointerId: 1, pointerType: 'mouse', button: 0, clientY: 244 });
    expect(latest?.height).toBe(0);
    fireEvent.pointerMove(track, { pointerId: 1, pointerType: 'mouse', clientY: 184 });
    expect(latest?.height).toBe(2);
    fireEvent.pointerMove(track, { pointerId: 1, pointerType: 'mouse', clientY: 124 });
    expect(latest?.height).toBe(4);
    fireEvent.pointerMove(track, { pointerId: 1, pointerType: 'mouse', clientY: 0 });
    expect(latest?.height).toBe(4);
    fireEvent.pointerUp(track, { pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(track, { pointerId: 1, pointerType: 'mouse', clientY: 244 });
    expect(latest?.height).toBe(4);
  });

  it('고정 n이거나 손잡이가 없으면 해당 조작부를 숨긴다', () => {
    render(<Harness config={{ baseSides: 5, handles: ['extrude'] }} />);
    expect(screen.queryByTestId('prism-sides-inc')).toBeNull();
    expect(screen.queryByTestId('prism-apex')).toBeNull();
    expect(screen.getByTestId('prism-extrude')).toBeTruthy();
  });

  it('표에 적기·칸 입력·줄 빼기', () => {
    render(<Harness config={{ counterTable: true, initial: { sides: 5, height: 2 } }} />);
    expect(screen.queryByTestId('prism-row-0')).toBeNull();
    const add = screen.getByTestId('prism-table-add') as HTMLButtonElement;
    fireEvent.click(add);
    expect(screen.getByTestId('prism-row-0').textContent).toContain('오각기둥');
    expect(add.disabled).toBe(true);

    const faces = screen.getByTestId('prism-cell-0-faces') as HTMLInputElement;
    expect(faces.getAttribute('inputmode')).toBe('numeric');
    fireEvent.change(faces, { target: { value: '7' } });
    fireEvent.change(screen.getByTestId('prism-cell-0-edges'), { target: { value: '1a5' } });
    fireEvent.change(screen.getByTestId('prism-cell-0-vertices'), { target: { value: '100' } });
    expect(latest?.table[0]).toEqual({
      kind: 'prism',
      n: 5,
      faces: 7,
      edges: 15,
      vertices: 10, // 두 자리까지만 받는다
    });
    fireEvent.change(faces, { target: { value: '' } });
    expect(latest?.table[0]?.faces).toBeNull();
    expect(observe(latest as PrismState)['tableCorrect']).toEqual([false]);

    // 맞게 적어도 화면에는 색·문구가 없다
    fireEvent.change(faces, { target: { value: '7' } });
    fireEvent.change(screen.getByTestId('prism-cell-0-vertices'), { target: { value: '10' } });
    expect(observe(latest as PrismState)['tableCorrect']).toEqual([true]);
    expect(screen.getByTestId('prism-table').textContent).not.toMatch(/맞|정답|틀/);

    fireEvent.click(screen.getByTestId('prism-row-remove-0'));
    expect(latest?.table).toEqual([]);
    expect(screen.queryByTestId('prism-row-0')).toBeNull();
    expect(add.disabled).toBe(false);
  });

  it('표 칸에 글자를 입력해도 무대 키(q, e, a …)가 먹지 않는다', () => {
    render(<Harness config={{ counterTable: true, initial: { sides: 5, height: 2 } }} />);
    fireEvent.click(screen.getByTestId('prism-table-add'));
    const cell = screen.getByTestId('prism-cell-0-faces');
    fireEvent.keyDown(cell, { key: 'a' });
    fireEvent.keyDown(cell, { key: 'e' });
    fireEvent.keyDown(cell, { key: ']' });
    expect(latest?.top).toBe('flat');
    expect(latest?.view.yaw).toBe(30);
    expect(latest?.sides).toBe(5);
  });

  it('Tab 대상 요소는 Enter·Space로 표시한다', () => {
    render(<Harness config={{ initial: { sides: 3, height: 2 } }} />);
    const top = screen.getByTestId('prism-face-top');
    expect(top.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(top, { key: 'Enter' });
    expect(latest?.marked.faces).toEqual(['top']);
    fireEvent.keyDown(top, { key: ' ' });
    expect(latest?.marked.faces).toEqual([]);
  });

  it('눕힌 입체가 그려지고 데이터 속성에 방향이 남는다', () => {
    render(<Harness config={{ orientation: 'lying', initial: { sides: 3, height: 3 } }} />);
    expect(screen.getByTestId('prism-stage').getAttribute('data-orientation')).toBe('lying');
    expect(screen.getByTestId('prism-name').textContent).toBe('삼각기둥');
  });

  it('힌트 ② 오버레이: 그릴 때와 안 그릴 때', () => {
    // 각뿔: apex-gather와 prism-peek은 그리고 stand-up은 안 그린다(upright)
    const r1 = render(
      <Harness config={{ initial: { sides: 5, height: 2, top: 'apex' } }} overlays />,
    );
    expect(screen.getByTestId('apex-gather')).toBeTruthy();
    expect(screen.getByTestId('apex-gather-title').textContent).toContain(
      '윗면의 꼭짓점들이 어디로 모였을까요?',
    );
    expect(screen.getByTestId('apex-gather-apex')).toBeTruthy();
    expect(document.querySelectorAll('[data-testid^="apex-gather-arrow-"]').length).toBe(5);
    expect(screen.getByTestId('prism-peek')).toBeTruthy();
    expect(screen.getByTestId('prism-peek-title').textContent).toContain(
      '뒤쪽에 숨은 모서리와 꼭짓점도 있을까요?',
    );
    expect(document.querySelectorAll('[data-testid^="prism-peek-edge-"]').length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByTestId('stand-up')).toBeNull();
    // 오버레이 문구에도 개수가 없다
    expect(screen.getByTestId('apex-gather').textContent).not.toMatch(/[0-9]/);
    r1.unmount();

    // 각기둥: apex-gather는 안 그린다
    const r2 = render(<Harness config={{ initial: { sides: 5, height: 2 } }} overlays />);
    expect(screen.queryByTestId('apex-gather')).toBeNull();
    expect(screen.getByTestId('prism-peek')).toBeTruthy();
    r2.unmount();

    // 높이 0: 둘 다 안 그린다
    const r3 = render(<Harness config={{ initial: { sides: 5, height: 0 } }} overlays />);
    expect(screen.queryByTestId('apex-gather')).toBeNull();
    expect(screen.queryByTestId('prism-peek')).toBeNull();
    r3.unmount();

    // 눕힘: stand-up을 그린다(눕힌 모습·화살표·세운 모습)
    render(
      <Harness config={{ orientation: 'lying', initial: { sides: 3, height: 3 } }} overlays />,
    );
    expect(screen.getByTestId('stand-up')).toBeTruthy();
    expect(screen.getByTestId('stand-up-title').textContent).toContain(
      '세워 놓고 보면 서로 마주 보는 두 면은 어디일까요?',
    );
    expect(screen.getByTestId('stand-up-lying')).toBeTruthy();
    expect(screen.getByTestId('stand-up-arrow')).toBeTruthy();
    expect(screen.getByTestId('stand-up-upright')).toBeTruthy();
    // 밑면에 색이나 이름을 붙이지 않는다
    expect(screen.getByTestId('stand-up').textContent).not.toMatch(/밑면|bottom/);
  });
});
