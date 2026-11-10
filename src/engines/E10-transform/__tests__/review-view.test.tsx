/** @vitest-environment jsdom */
/**
 * E10 검수 수정 회귀 테스트(화면).
 *
 * - 기본 돌리기 각도는 설정의 첫 각도다.
 * - 기록 영역·뒤집기 손잡이·타일 편집판의 이름표가 올바르다.
 * - 완성하기 과제에서도 점 커서가 보인다.
 * - 접기 미리보기는 설정이 켜졌을 때만 돈다.
 * - predict는 첫 움직임이 돌리기일 때만 확인 전 중심을 보여 준다.
 * - 합동 대응 변은 대응표의 다음 꼭짓점을 쓴다.
 * - 겹친 칸·정오각형 상태·정육각형 돌리기 중심.
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import type {
  CongruenceConfig,
  PredictConfig,
  SlideFlipTurnConfig,
  TessellationConfig,
  TransformAction,
  TransformConfig,
  TransformState,
} from '../types';
import { boardRect } from '../layout';
import { SQUARE_FRAME } from '../tiles';
import { TransformView } from '../View';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function build(config: TransformConfig, actions: readonly TransformAction[] = []): TransformState {
  return actions.reduce<TransformState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

function renderState(config: TransformConfig, state: TransformState, actions?: TransformAction[]) {
  return render(
    <TransformView
      config={config}
      state={state}
      dispatch={(action) => actions?.push(action)}
      cpa="C"
      mode={state.mode}
      targetSize={48}
    />,
  );
}

function renderConfig(config: TransformConfig, actions?: TransformAction[]) {
  return renderState(config, build(config), actions);
}

describe('E10 기본 돌리기 각도', () => {
  it('설정의 첫 각도가 선택되어 있고 그 각도로 돌린다', () => {
    const config: SlideFlipTurnConfig = { mode: 'slide-flip-turn', turnAngles: [180] };
    const actions: TransformAction[] = [];
    const { getByRole } = renderConfig(config, actions);
    const angle = getByRole('button', { name: '180°' });
    expect(angle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(getByRole('button', { name: /^돌리기$/ }));
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'turn', angle: 180 });
  });
});

describe('E10 접근성 이름표', () => {
  it('이동 기록 영역은 "이동 기록" 이름을 쓴다', () => {
    const { container } = renderConfig({ mode: 'slide-flip-turn' });
    expect(container.querySelectorAll('[aria-label="이동 기록"]').length).toBeGreaterThan(0);
    expect(container.querySelector('[aria-label="기록"]')).toBeNull();
  });

  it('뒤집기 손잡이는 "오른쪽으로 뒤집기"처럼 읽힌다', () => {
    const { container } = renderConfig({ mode: 'slide-flip-turn' });
    const handle = container.querySelector('[data-flip-handle="right"]');
    expect(handle?.getAttribute('aria-label')).toBe('오른쪽으로 뒤집기');
  });

  it('타일 편집판 칸 이름표는 줄과 칸을 바꾸지 않는다', () => {
    const config: TessellationConfig = { mode: 'tessellation', customize: 'edge-translate' };
    const { container } = renderConfig(config);
    const cell = container.querySelector('[data-cell="2,1"]');
    expect(cell?.getAttribute('aria-label')).toBe('2번째 줄 3번째 칸');
  });
});

describe('E10 완성하기 점 커서', () => {
  it('완성하기 과제에서도 캔버스에 초점을 주면 점 커서가 보인다', () => {
    const { container } = renderConfig({ mode: 'line-symmetry', task: 'complete' });
    const canvas = container.querySelector('svg[data-testid="transform-canvas"]');
    if (!canvas) throw new Error('line-symmetry canvas missing');
    fireEvent.focus(canvas);
    expect(container.querySelectorAll('[data-cursor]')).toHaveLength(1);
  });
});

describe('E10 접기 미리보기', () => {
  const pickAxis: readonly TransformAction[] = [
    { type: 'pick-point', at: [0, 4] },
    { type: 'pick-point', at: [8, 4] },
    { type: 'fold' },
  ];

  function foldState(foldPreview: boolean): TransformConfig {
    return { mode: 'line-symmetry', shapes: ['rectangle'], foldPreview };
  }

  it('foldPreview가 켜지면 접는 동안 [data-fold-preview]가 나타난다', () => {
    const config = foldState(true);
    const state = build(config, pickAxis);
    const original = window.requestAnimationFrame;
    let calls = 0;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      calls += 1;
      if (calls === 1) callback(0);
      return calls;
    }) as typeof window.requestAnimationFrame;
    try {
      const { container } = renderState(config, state);
      expect(container.querySelectorAll('[data-fold-preview]')).toHaveLength(1);
    } finally {
      window.requestAnimationFrame = original;
    }
  });

  it('foldPreview가 꺼져 있으면 [data-fold-preview]가 없다', () => {
    const config = foldState(false);
    const state = build(config, pickAxis);
    const { container } = renderState(config, state);
    expect(container.querySelectorAll('[data-fold-preview]')).toHaveLength(0);
  });
});

describe('E10 predict 첫 움직임', () => {
  const turn = {
    type: 'turn' as const,
    direction: 'cw' as const,
    angle: 90 as const,
    center: 'vertex-A' as const,
  };
  const slide = { type: 'slide' as const, direction: 'right' as const, cells: 1 };

  it('첫 움직임이 밀기면 확인 전 돌리기 중심을 그리지 않는다', () => {
    const config: PredictConfig = { mode: 'predict', at: [1, 1], operation: [slide, turn] };
    const { container } = renderConfig(config);
    expect(container.querySelectorAll('[data-pin]')).toHaveLength(0);
  });

  it('첫 움직임이 돌리기면 확인 전 돌리기 중심을 그린다', () => {
    const config: PredictConfig = { mode: 'predict', at: [1, 1], operation: [turn, slide] };
    const { container } = renderConfig(config);
    expect(container.querySelectorAll('[data-pin]')).toHaveLength(1);
  });
});

describe('E10 합동 대응 변 짝', () => {
  it('뒤집어 포갠 사각형은 대응표의 다음 꼭짓점끼리 변을 잇는다', () => {
    const config: CongruenceConfig = {
      mode: 'congruence',
      fixed: 'rectangle',
      fixedAt: [1, 2],
      fixedOrientation: 'id',
      moving: 'rectangle',
      movingAt: [1, 2],
    };
    const state = build(config, [
      { type: 'flip', side: 'right' },
      { type: 'slide', dx: -4, dy: 0 },
    ]);
    expect(state.mode).toBe('congruence');
    if (state.mode !== 'congruence') return;
    expect(state.correspondence).toEqual([1, 0, 3, 2]);

    const { container } = renderState(config, state);
    const first = container.querySelector('[data-corr="side"]');
    if (!first) throw new Error('대응 변 표시가 없습니다.');
    const lines = first.querySelectorAll('line');
    expect(lines).toHaveLength(2);
    const fixedTick = lines[1];
    // 고정 도형의 변 (5,2)-(1,2)는 가로변이므로 눈금선은 세로선이다.
    expect(fixedTick?.getAttribute('x1')).toBe(fixedTick?.getAttribute('x2'));
  });
});

describe('E10 쪽매맞춤 표시', () => {
  it('같은 자리에 두 번 놓으면 겹친 칸에 [data-overlap-cell]이 붙는다', () => {
    const config: TessellationConfig = { mode: 'tessellation' };
    const state = build(config, [{ type: 'place' }, { type: 'place' }]);
    const { container } = renderState(config, state);
    expect(container.querySelectorAll('[data-overlap-cell]').length).toBeGreaterThan(0);
  });

  it('정오각형 세 개는 빈틈, 네 개는 겹침 상태를 보여 주고 "빈틈도 겹침도 없어요"는 쓰지 않는다', () => {
    const config: TessellationConfig = { mode: 'tessellation' };
    const three = build(config, [
      { type: 'select-tile', tile: 'pentagon-regular' },
      { type: 'hub-add' },
      { type: 'hub-add' },
    ]);
    const threeView = renderState(config, three);
    expect(threeView.getByTestId('tessellation-status').textContent).toBe('빈 칸이 남아 있어요');
    expect(threeView.container.querySelectorAll('[data-pentagon]')).toHaveLength(3);
    expect(threeView.container.textContent ?? '').not.toContain('빈틈도 겹침도 없어요');
    threeView.unmount();

    const four = build(config, [
      { type: 'select-tile', tile: 'pentagon-regular' },
      { type: 'hub-add' },
      { type: 'hub-add' },
      { type: 'hub-add' },
    ]);
    const fourView = renderState(config, four);
    expect(fourView.getByTestId('tessellation-status').textContent).toBe('겹친 칸이 있어요');
    expect(fourView.container.querySelectorAll('[data-overlap-cell]')).toHaveLength(1);
  });

  it('도장을 판 밖으로 끌었다 돌아와도 거절된 밀기를 옮긴 것으로 세지 않는다', () => {
    // 화면 좌표 = 논리 좌표(1000×1000)가 되게 한다.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 1000,
      width: 1000,
      height: 1000,
      toJSON: () => ({}),
    } as DOMRect);
    const config: TessellationConfig = { mode: 'tessellation' };
    const initial = build(config);
    const actions: TransformAction[] = [];
    const { getByTestId } = renderState(config, initial, actions);
    const canvas = getByTestId('transform-canvas');
    const cell = boardRect(SQUARE_FRAME).cell;
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 990, clientY: 500 });
    // 화면 폭 전체를 왼쪽으로 끌면 판 범위(-6칸)를 넘으므로 보내지 않는다.
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 0, clientY: 500 });
    expect(actions).toHaveLength(0);
    // 시작점에서 한 칸 왼쪽으로 돌아오면 그 한 칸만 민다(거절된 밀기를 센 만큼 어긋나지 않는다).
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 990 - cell, clientY: 500 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(actions).toEqual([{ type: 'move', move: { kind: 'slide', dx: -1, dy: 0 } }]);
    const moved = build(config, actions);
    if (moved.mode !== 'tessellation' || initial.mode !== 'tessellation') throw new Error('mode');
    expect(moved.stamp.cells[0]).toEqual([
      (initial.stamp.cells[0]?.[0] ?? 0) - 1,
      initial.stamp.cells[0]?.[1] ?? 0,
    ]);
  });

  it('정오각형 1·2개는 아직 놓는 중이라 빈틈 쐐기를 그리지 않고, 3개일 때만 그린다', () => {
    const config: TessellationConfig = { mode: 'tessellation' };
    const steps = [
      { type: 'select-tile', tile: 'pentagon-regular' },
      { type: 'hub-add' },
      { type: 'hub-add' },
    ] as const;
    for (const count of [1, 2]) {
      const view = renderState(config, build(config, [...steps.slice(0, count)]));
      expect(view.container.querySelectorAll('[data-pentagon]')).toHaveLength(count);
      expect(view.container.querySelectorAll('[data-gap-cell]')).toHaveLength(0);
      view.unmount();
    }
    const three = renderState(config, build(config, [...steps]));
    expect(three.container.querySelectorAll('[data-gap-cell]')).toHaveLength(1);
  });

  it('정오각형은 허브 꼭짓점을 공유한다(중심 거리 = 외접원 반지름)', () => {
    const config: TessellationConfig = { mode: 'tessellation' };
    const state = build(config, [{ type: 'select-tile', tile: 'pentagon-regular' }]);
    const { container } = renderState(config, state);
    const pentagon = container.querySelector('[data-pentagon="0"]');
    const first = (pentagon?.getAttribute('points') ?? '').trim().split(' ')[0];
    expect(first).toBe('500.00,520.00');
  });

  it('gapCheck가 꺼지면 빈틈 살펴보기 버튼이 없다', () => {
    const off = renderConfig({ mode: 'tessellation', gapCheck: false });
    expect(off.queryByRole('button', { name: '빈틈 살펴보기' })).toBeNull();
    off.unmount();
    const on = renderConfig({ mode: 'tessellation', gapCheck: true });
    expect(on.queryByRole('button', { name: '빈틈 살펴보기' })).not.toBeNull();
  });

  it('삼각 격자에는 ↙·↗ 밀기 버튼이 있다', () => {
    const config: TessellationConfig = { mode: 'tessellation' };
    const state = build(config, [{ type: 'select-tile', tile: 'triangle' }]);
    const actions: TransformAction[] = [];
    const { getByRole } = renderState(config, state, actions);
    fireEvent.click(getByRole('button', { name: '↙ 왼쪽 아래' }));
    fireEvent.click(getByRole('button', { name: '↗ 오른쪽 위' }));
    expect(actions).toEqual([
      { type: 'move', move: { kind: 'slide', dx: -1, dy: 1 } },
      { type: 'move', move: { kind: 'slide', dx: 1, dy: -1 } },
    ]);
  });
});
