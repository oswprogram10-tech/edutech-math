/** @vitest-environment jsdom */
/** E15 gears 화면·오버레이 테스트: 정답 노출 없음, 예측 잠금, 키보드, 표시 톱니. */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeetTrailOverlay } from '../overlays/meet-trail';
import { createInitialState, reduce } from '../reduce';
import type { GearsConfig, PatternAction, PatternState } from '../types';
import { PatternView } from '../View';

afterEach(cleanup);

function renderState(config: GearsConfig, state: PatternState, dispatch = vi.fn()) {
  return render(
    <PatternView
      config={config}
      state={state}
      dispatch={dispatch}
      cpa="C"
      mode="gears"
      targetSize={48}
    />,
  );
}

function renderConfig(config: GearsConfig, dispatch = vi.fn()) {
  return renderState(config, createInitialState(config), dispatch);
}

function applyAll(config: GearsConfig, actions: readonly PatternAction[]): PatternState {
  return actions.reduce<PatternState>((s, a) => reduce(s, a), createInitialState(config));
}

const turnsOf = (n: number): PatternAction[] =>
  Array.from({ length: n }, () => ({ type: 'turn', by: 1 }));

const typeAndLock = (text: string): PatternAction[] => [
  ...[...text].map((key): PatternAction => ({ type: 'predict-type', key })),
  { type: 'predict-lock' },
];

const BASE: GearsConfig = { mode: 'gears' };

describe('E15 gears 화면', () => {
  it('시작 화면 DOM에 최소공배수(12, 24)가 없다', () => {
    const { container } = renderConfig(BASE);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/12|24/);
    expect(text).toContain('돌린 칸: 0');
    expect(container.querySelector('[data-testid="gears-meet-star"]')).toBeNull();
    expect(container.querySelector('[data-testid="gears-meet-text"]')).toBeNull();
  });

  it('바퀴 가운데에 톱니 수가 있고 표시 톱니는 굵은 윤곽과 점 무늬가 있다', () => {
    const { container } = renderConfig(BASE);
    const canvas = container.querySelector('[data-testid="gears-canvas"]') as Element;
    expect(canvas.querySelector('[data-gear="a"]')?.getAttribute('data-teeth')).toBe('4');
    expect(canvas.querySelector('[data-gear="b"]')?.getAttribute('data-teeth')).toBe('6');
    const mark = canvas.querySelector('[data-testid="gears-mark-a"]') as Element;
    const plain = canvas.querySelector('[data-gear="a"] polygon:not([stroke-width="4"])');
    expect(Number(mark.querySelector('polygon')?.getAttribute('stroke-width'))).toBeGreaterThan(
      Number(plain?.getAttribute('stroke-width')),
    );
    expect(mark.innerHTML).toContain('url(#');
    // 표시 톱니는 같은 모양이 둘(채움·무늬), 나머지 톱니 3개
    expect(canvas.querySelectorAll('[data-gear="a"] polygon')).toHaveLength(3 + 2);
  });

  it('맞닿으면 별 모양과 글자가 나오고 알림 영역에 읽힌다', () => {
    const state = applyAll(BASE, turnsOf(12));
    const { container, getByTestId } = renderState(BASE, state);
    expect(container.querySelector('[data-testid="gears-meet-star"]')).not.toBeNull();
    expect(getByTestId('gears-meet-text').textContent).toBe('다시 만났어요!');
    expect(getByTestId('gears-live').textContent).toContain('12칸');
    expect(getByTestId('gears-laps-a').textContent).toBe('왼쪽 바퀴: 3바퀴와 0칸');
    expect(getByTestId('gears-laps-b').textContent).toBe('오른쪽 바퀴: 2바퀴와 0칸');
  });

  it('showLaps false이면 바퀴 수 줄이 없다', () => {
    const { container } = renderConfig({ ...BASE, showLaps: false });
    expect(container.querySelector('[data-testid="gears-laps-a"]')).toBeNull();
  });

  it('단추와 키보드가 turn을 보낸다', () => {
    const dispatch = vi.fn();
    const { getByRole, getByTestId } = renderConfig(BASE, dispatch);
    fireEvent.click(getByRole('button', { name: '한 칸 돌리기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'turn', by: 1 });
    const canvas = getByTestId('gears-canvas');
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'turn', by: 1 });
    fireEvent.keyDown(canvas, { key: 'ArrowLeft' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'turn', by: -1 });
  });

  it('돌린 칸이 0이면 되돌리기 단추가, maxSteps이면 돌리기 단추가 비활성이다', () => {
    const { getByRole } = renderConfig(BASE);
    expect((getByRole('button', { name: '한 칸 되돌리기' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    cleanup();
    const config: GearsConfig = { ...BASE, maxSteps: 12 };
    const full = applyAll(config, [{ type: 'turn-to', steps: 12 }]);
    const view = renderState(config, full);
    const forward = view.getByRole('button', { name: '한 칸 돌리기' });
    expect((forward as HTMLButtonElement).disabled).toBe(true);
  });

  it('예측 모드에서는 정하기 전에 돌리기 단추가 비활성이고 이유가 보인다', () => {
    const config: GearsConfig = { ...BASE, predict: true };
    const { getByRole, getByTestId, container } = renderConfig(config);
    expect((getByRole('button', { name: '한 칸 돌리기' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((getByRole('button', { name: '한 칸 되돌리기' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(getByTestId('gears-lock-reason').textContent).toContain('예측');
    expect(getByTestId('gears-pad')).not.toBeNull();
    // 숫자 패드의 글자는 빼고 판과 기록에 최소공배수가 없는지 본다.
    expect(getByTestId('gears-board').textContent).not.toMatch(/12|24/);
    expect(getByTestId('gears-record').textContent).not.toMatch(/12|24/);
    expect(container.querySelector('[data-testid="gears-draft"]')?.textContent).not.toMatch(
      /12|24/,
    );
  });

  it('예측을 정하면 판 위에 내 예측이 남고 돌리기 단추가 켜진다', () => {
    const config: GearsConfig = { ...BASE, predict: true };
    const state = applyAll(config, typeAndLock('24'));
    const { getByTestId, getByRole, container } = renderState(config, state);
    expect(getByTestId('gears-prediction-text').textContent).toBe('내 예측: 24');
    expect((getByRole('button', { name: '한 칸 돌리기' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(container.querySelector('[data-testid="gears-pad"]')).toBeNull();
  });

  it('예측 패드가 predict Action을 보낸다', () => {
    const dispatch = vi.fn();
    const { getByTestId } = renderConfig({ ...BASE, predict: true }, dispatch);
    const pad = getByTestId('gears-pad');
    fireEvent.click(pad.querySelectorAll('button')[0] as HTMLButtonElement);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'predict-type', key: '1' });
    fireEvent.keyDown(pad, { key: '7' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'predict-type', key: '7' });
  });

  it('readOnly이면 모든 단추가 비활성이다', () => {
    const { getAllByRole } = render(
      <PatternView
        config={BASE}
        state={createInitialState(BASE)}
        dispatch={vi.fn()}
        cpa="C"
        mode="gears"
        targetSize={48}
        readOnly
      />,
    );
    for (const button of getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });
});

describe('E15 meet-trail 오버레이', () => {
  function overlay(config: GearsConfig, actions: readonly PatternAction[]) {
    const state = applyAll(config, actions);
    return render(<MeetTrailOverlay config={config} state={state} />);
  }

  it('예측 24이면 0~24까지 두 줄 눈금과 겹침 두 곳을 그린다', () => {
    const { container } = overlay({ ...BASE, predict: true }, typeAndLock('24'));
    expect(container.querySelectorAll('[data-testid="meet-trail-a"]')).toHaveLength(7);
    expect(container.querySelectorAll('[data-testid="meet-trail-b"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-testid="meet-trail-meet"]')).toHaveLength(2);
  });

  it('예측이 없으면 돌린 칸까지만 그린다', () => {
    const { container } = overlay(BASE, turnsOf(8));
    expect(container.querySelectorAll('[data-testid="meet-trail-a"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid="meet-trail-meet"]')).toHaveLength(0);
  });

  it('gears 상태가 아니면 아무것도 그리지 않는다', () => {
    const config = { mode: 'growth' } as const;
    const { container } = render(
      <MeetTrailOverlay config={config} state={createInitialState(config)} />,
    );
    expect(container.querySelector('svg')).toBeNull();
  });
});
