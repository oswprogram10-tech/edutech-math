/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { XrayPeekOverlay } from '../overlays/xray-peek';
import { createInitialState, reduce } from '../reduce';
import type { SolidAction, XrayConfig, XrayState } from '../types';
import { SolidView } from '../View';

afterEach(() => {
  cleanup();
});

function XrayHarness({
  config,
  initialActions = [],
}: {
  readonly config: XrayConfig;
  readonly initialActions?: readonly SolidAction[];
}) {
  const [state, setState] = useState<XrayState>(() => {
    let s: XrayState = createInitialState(config);
    for (const act of initialActions) {
      s = reduce(s, act);
    }
    return s;
  });

  return (
    <div style={{ position: 'relative', width: 960, height: 640 }}>
      <SolidView
        config={config}
        state={state}
        dispatch={(action) => setState((prev) => reduce(prev, action))}
        cpa="C"
        mode="xray"
        targetSize={48}
      />
      <XrayPeekOverlay config={config} state={state} />
    </div>
  );
}

describe('E12 xray View & Overlays', () => {
  it('도구별로 누를 수 있는 요소가 나뉘고 엑스레이 토글에 따라 숨은 모서리 표시가 바뀐다', () => {
    render(<XrayHarness config={{ mode: 'xray' }} />);

    // 1. 기본 도구 'face': 보이는 면(front/right/top)만 보이고 누를 수 있다.
    expect(screen.getByTestId('xray-face-top')).toBeTruthy();
    expect(screen.queryByTestId('xray-face-back')).toBeNull();
    fireEvent.click(screen.getByTestId('xray-face-top'));
    expect(screen.getByTestId('xray-face-top').getAttribute('data-marked')).toBe('true');

    // 2. 엑스레이 꺼짐 상태에서는 숨은 모서리(x10)가 그려지지 않는다.
    expect(screen.queryByTestId('xray-edge-x10')).toBeNull();

    // 3. 엑스레이 켜기 + 모서리 도구 -> 숨은 모서리 3개 등장 및 표시 가능
    fireEvent.click(screen.getByTestId('xray-toggle'));
    fireEvent.click(screen.getByTestId('xray-tool-edge'));
    const hiddenEdge = screen.getByTestId('xray-edge-x10');
    expect(hiddenEdge.getAttribute('data-hidden')).toBe('true');
    expect(hiddenEdge.getAttribute('aria-label')).toBe('모서리 3');
    fireEvent.click(hiddenEdge);
    expect(hiddenEdge.getAttribute('data-marked')).toBe('true');

    // 4. 엑스레이 다시 끄면 숨어 있는 동안 표시를 그리지 않고, 다시 켜면 보인다.
    fireEvent.click(screen.getByTestId('xray-toggle'));
    expect(screen.queryByTestId('xray-edge-x10')).toBeNull();
    fireEvent.click(screen.getByTestId('xray-toggle'));
    expect(screen.getByTestId('xray-edge-x10').getAttribute('data-marked')).toBe('true');
  });

  it('학생 화면에 표시 개수나 맞았다·틀렸다 문구를 쓰지 않는다', () => {
    const { container } = render(
      <XrayHarness
        config={{
          mode: 'xray',
          faceQuery: true,
          sketch: { prefill: 'visible' },
        }}
        initialActions={[
          { type: 'toggle-mark', kind: 'face', id: 'top' },
          { type: 'toggle-mark', kind: 'edge', id: 'x00' },
          { type: 'toggle-mark', kind: 'vertex', id: 'v000' },
        ]}
      />,
    );

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\d+\s*개/);
    expect(text).not.toMatch(/다\s*찾/);
    expect(text).not.toMatch(/맞았|틀렸|정답/);
  });

  it('겨냥도 탭-탭으로 선분 더하기, 첫 점 취소, 선분 빼기, 키보드 조작을 처리한다', () => {
    const { container } = render(
      <XrayHarness
        config={{
          mode: 'xray',
          solid: { type: 'cuboid', w: 4, d: 3, h: 2 },
          sketch: { prefill: 'none' },
        }}
      />,
    );

    const sketch = screen.getByTestId('xray-sketch');
    const view = screen.getByTestId('xray-view');
    const d0 = screen.getByTestId('xray-dot-0-0');
    const d1 = screen.getByTestId('xray-dot-8-0');

    // 첫 점 클릭 후 다시 클릭 -> 취소
    fireEvent.pointerDown(d0, { pointerId: 1, button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(d0, { pointerId: 1, button: 0, pointerType: 'mouse' });
    fireEvent.pointerDown(d0, { pointerId: 2, button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(d0, { pointerId: 2, button: 0, pointerType: 'mouse' });
    expect(screen.queryByTestId('xray-seg-0-0-8-0')).toBeNull();

    // 탭-탭으로 선분 더하기
    fireEvent.pointerDown(d0, { pointerId: 3, button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(d0, { pointerId: 3, button: 0, pointerType: 'mouse' });
    fireEvent.pointerDown(d1, { pointerId: 4, button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(d1, { pointerId: 4, button: 0, pointerType: 'mouse' });
    expect(screen.getByTestId('xray-seg-0-0-8-0')).toBeTruthy();

    // 선 가운데(>35% 점 거리, <=12px 선 거리)를 누르면 학생 선분이 빠진다
    const seg0080 = screen.getByTestId('xray-seg-0-0-8-0');
    const svgW = Number(sketch.getAttribute('width'));
    const svgH = Number(sketch.getAttribute('height'));
    sketch.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: svgW,
      height: svgH,
      right: svgW,
      bottom: svgH,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const x1 = Number(seg0080.getAttribute('x1'));
    const y1 = Number(seg0080.getAttribute('y1'));
    const x2 = Number(seg0080.getAttribute('x2'));
    const y2 = Number(seg0080.getAttribute('y2'));
    const midX = (x1 + x2) / 2 + 16; // 점 사이 중간(점과 16px 이상 떨어짐)
    const midY = (y1 + y2) / 2;
    fireEvent.pointerDown(sketch, {
      pointerId: 5,
      button: 0,
      pointerType: 'mouse',
      clientX: midX,
      clientY: midY,
    });
    fireEvent.pointerUp(sketch, {
      pointerId: 5,
      button: 0,
      pointerType: 'mouse',
      clientX: midX,
      clientY: midY,
    });
    expect(screen.queryByTestId('xray-seg-0-0-8-0')).toBeNull();

    // 키보드: L(점선), cursor (8,0)에서 위쪽 화살표+Enter 선 긋기, Backspace로 마지막 선 빼기
    fireEvent.keyDown(sketch, { key: 'l' });
    expect(screen.getByTestId('xray-style-dashed').getAttribute('aria-pressed')).toBe('true');

    fireEvent.keyDown(sketch, { key: 'Enter' }); // (8,0) 선택
    fireEvent.keyDown(sketch, { key: 'ArrowUp' }); // (8,1)
    fireEvent.keyDown(sketch, { key: 'Enter' });
    expect(screen.getByTestId('xray-seg-8-0-8-1').getAttribute('data-style')).toBe('dashed');

    fireEvent.keyDown(sketch, { key: 'Backspace' });
    expect(screen.queryByTestId('xray-seg-8-0-8-1')).toBeNull();

    // 무대 키보드 Q/E/W/S/X
    fireEvent.keyDown(view, { key: 'x' });
    expect(screen.getByTestId('xray-toggle').getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(view, { key: 'w' });
    fireEvent.keyDown(view, { key: 'e' });
    expect(container.querySelector('[data-testid="xray-stage"]')).toBeTruthy();
  });

  it('xray-peek 오버레이는 solid 표시에서 숨은 모서리·꼭짓점을 그리고 display:sketch에서는 그리지 않는다', () => {
    const r1 = render(<XrayHarness config={{ mode: 'xray', display: 'solid' }} />);
    expect(screen.getByTestId('xray-peek')).toBeTruthy();
    expect(screen.getByTestId('xray-peek-title').textContent).toContain(
      '뒤쪽에 숨은 모서리와 꼭짓점도 있을까요?',
    );
    expect(screen.getByTestId('xray-peek-edge-x10')).toBeTruthy();
    expect(screen.getByTestId('xray-peek-vertex-v010')).toBeTruthy();
    r1.unmount();

    render(<XrayHarness config={{ mode: 'xray', display: 'sketch' }} />);
    expect(screen.queryByTestId('xray-peek')).toBeNull();
  });
});
