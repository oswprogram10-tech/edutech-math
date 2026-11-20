/** @vitest-environment jsdom */
/** E14 화면 테스트: 시각 글 비노출, 키보드·단추 조작, 펼친 띠 표시, 오버레이 그림. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HourHandFocusOverlay } from '../overlays/hour-hand-focus';
import { NumeralMinutesOverlay } from '../overlays/numeral-minutes';
import { RewindToHourOverlay } from '../overlays/rewind-to-hour';
import { createInitialState, reduce } from '../reduce';
import type { ClockAction, ClockConfig, ClockState } from '../types';
import { ClockView } from '../View';

afterEach(cleanup);

function play(config: ClockConfig, actions: readonly ClockAction[] = []): ClockState {
  return actions.reduce<ClockState>(reduce, createInitialState({ mode: 'clock', ...config }));
}

function renderState(state: ClockState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <ClockView
      config={{}}
      state={state}
      dispatch={dispatch}
      cpa="C"
      mode="clock"
      targetSize={48}
      readOnly={readOnly}
    />,
  );
}

/** 화면 좌표를 담은 data- 속성은 수학 값이 아니라 제외한다. */
const POSITION_ATTRIBUTES = new Set(['data-x', 'data-angle', 'data-numeral']);

/** 글과 data-·aria- 속성값을 모두 모은다(시각이 어디에도 새지 않는지 볼 때 쓴다). */
function everything(container: Element): string {
  const parts: string[] = [container.textContent ?? ''];
  for (const element of container.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      if (POSITION_ATTRIBUTES.has(attribute.name)) continue;
      if (attribute.name.startsWith('data-') || attribute.name.startsWith('aria-')) {
        parts.push(attribute.value);
      }
    }
  }
  return parts.join('\n');
}

const TIME_TEXT = /8:30|8시|30분|8 ?: ?30/;

describe('정답(시각) 비노출', () => {
  it("digitalReadout 'never'(기본): 시작 화면 DOM·aria에 시각 글이 없다", () => {
    const { container } = renderState(play({ start: '8:30', unroll: true, showGears: true }));
    expect(everything(container)).not.toMatch(TIME_TEXT);
    expect(screen.queryByTestId('clock-digital')).toBeNull();
    // 펼쳐도 시각 글은 없다(띠 눈금 숫자뿐).
    cleanup();
    const open = renderState(play({ start: '8:30', unroll: true }, [{ type: 'toggle-unroll' }]));
    expect(everything(open.container)).not.toMatch(TIME_TEXT);
  });

  it('바늘 aria는 방향만 말한다', () => {
    const { container } = renderState(play({ start: '8:30' }));
    expect(container.querySelector('[data-part="long-hand"]')?.getAttribute('aria-label')).toBe(
      '긴바늘이 6을 가리켜요',
    );
    expect(container.querySelector('[data-part="short-hand"]')?.getAttribute('aria-label')).toBe(
      '짧은바늘이 8과 9 사이에 있어요',
    );
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuetext')).toBe(
      '긴바늘이 6을 가리켜요. 짧은바늘이 8과 9 사이에 있어요',
    );
    expect(slider.hasAttribute('aria-valuenow')).toBe(false);
  });

  it("digitalReadout 'always'면 시각 글이 있다", () => {
    const { container } = renderState(play({ start: '8:30', digitalReadout: 'always' }));
    expect(screen.getByTestId('clock-digital').textContent).toBe('8:30');
    expect(everything(container)).toMatch(/8:30/);
  });

  it('hideMinuteHand면 긴바늘도 그 문장도 없다', () => {
    const { container } = renderState(play({ start: '8:30', hideMinuteHand: true }));
    expect(container.querySelector('[data-part="long-hand"]')).toBeNull();
    expect(everything(container)).not.toContain('긴바늘');
  });

  it('설정 오류면 오류 문구만 보인다', () => {
    renderState(play({ start: 'abc' }));
    expect(screen.getByTestId('clock-error')).toBeTruthy();
    expect(screen.queryByTestId('clock-canvas')).toBeNull();
  });
});

describe('조작', () => {
  it('단추: 거꾸로·앞으로는 step, 펼치기는 toggle-unroll, 처음으로는 reset', () => {
    const dispatch = vi.fn();
    const state = play({ start: '3:00', unroll: true }, [{ type: 'step', delta: 3 }]);
    renderState(state, dispatch);
    fireEvent.click(screen.getByRole('button', { name: '◀ 거꾸로' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'step', delta: -1 });
    fireEvent.click(screen.getByRole('button', { name: '앞으로 ▶' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'step', delta: 1 });
    fireEvent.click(screen.getByRole('button', { name: '펼치기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'toggle-unroll' });
    fireEvent.click(screen.getByRole('button', { name: '처음으로' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'reset' });
  });

  it('펼친 뒤 단추 이름은 다시 감기', () => {
    renderState(play({ start: '3:00', unroll: true }, [{ type: 'toggle-unroll' }]));
    expect(screen.getByRole('button', { name: '다시 감기' })).toBeTruthy();
  });

  it('unroll 옵션이 없으면 펼치기 단추가 없다', () => {
    renderState(play({ start: '3:00' }));
    expect(screen.queryByRole('button', { name: '펼치기' })).toBeNull();
  });

  it('키보드: ←→는 한 칸, Shift+←→는 한 시간', () => {
    const dispatch = vi.fn();
    renderState(play({ start: '3:00' }), dispatch);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'step', delta: 1 });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'step', delta: -1 });
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'set-time', minutes: 240 });
    fireEvent.keyDown(slider, { key: 'ArrowLeft', shiftKey: true });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'set-time', minutes: 120 });
  });

  it('12:00에서 Shift+←는 11:00으로 감아 돈다', () => {
    const dispatch = vi.fn();
    renderState(play({ start: '12:00' }), dispatch);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft', shiftKey: true });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'set-time', minutes: 660 });
  });

  it('읽기 전용(설정·화면 모두)이면 조작을 보내지 않는다', () => {
    const dispatch = vi.fn();
    renderState(play({ start: '3:00', readOnly: true }), dispatch);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(screen.queryByRole('button', { name: '앞으로 ▶' })).toBeNull();
    expect(screen.queryByRole('button', { name: '◀ 거꾸로' })).toBeNull();
    expect(screen.getByText('시계를 잘 보세요.')).toBeTruthy();
    expect(dispatch).not.toHaveBeenCalled();
    cleanup();
    renderState(play({ start: '3:00' }), dispatch, true);
    expect(screen.queryByRole('button', { name: '앞으로 ▶' })).toBeNull();
    expect(screen.getByText('시계를 잘 보세요.')).toBeTruthy();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('허용 분 한 칸이 시간 한 칸을 넘으면 단추는 그만큼 움직인다(정시만)', () => {
    const state = play({ start: '3:00', granularity: 'hour' });
    const next = reduce(state, { type: 'step', delta: 1 });
    expect(next.minutes).toBe(240);
  });
});

describe('펼친 띠', () => {
  it('접힌 상태에는 띠가 없고, 펼치면 숫자 1~12·0~60과 표시가 있다', () => {
    const closed = renderState(play({ start: '4:25', unroll: true }));
    expect(closed.container.querySelector('[data-part="strip"]')).toBeNull();
    cleanup();
    const { container } = renderState(
      play({ start: '4:25', unroll: true }, [{ type: 'toggle-unroll' }]),
    );
    expect(container.querySelectorAll('[data-part="strip-numeral"]')).toHaveLength(12);
    expect(container.querySelectorAll('[data-part="strip-minute"]')).toHaveLength(13);
    const marker = container.querySelector('[data-part="strip-marker"]');
    // 25분 → 60 + 25/60 × 880
    expect(Number(marker?.getAttribute('data-x'))).toBeCloseTo(60 + (25 / 60) * 880, 1);
  });

  it('readOnly나 hideMinuteHand이면 띠 위 표시를 그리지 않는다', () => {
    const toggle: ClockAction[] = [{ type: 'toggle-unroll' }];
    for (const extra of [{ readOnly: true }, { hideMinuteHand: true }]) {
      const { container } = renderState(play({ start: '4:25', unroll: true, ...extra }, toggle));
      expect(container.querySelector('[data-part="strip"]')).not.toBeNull();
      expect(container.querySelector('[data-part="strip-marker"]')).toBeNull();
      cleanup();
    }
  });
});

describe('톱니', () => {
  it('showGears면 큰·작은 톱니가 바늘 각도와 같이 돈다', () => {
    const { container } = renderState(play({ start: '8:30', showGears: true }));
    expect(container.querySelector('[data-part="gear-big"]')?.getAttribute('data-angle')).toBe(
      '180.00',
    );
    expect(container.querySelector('[data-part="gear-small"]')?.getAttribute('data-angle')).toBe(
      '255.00',
    );
    expect(container.textContent).toContain('긴바늘이 한 바퀴 돌면 짧은바늘은 한 칸');
  });

  it('showGears가 없으면 톱니가 없다', () => {
    const { container } = renderState(play({ start: '8:30' }));
    expect(container.querySelector('[data-part="gears"]')).toBeNull();
  });
});

describe('힌트 ② 오버레이', () => {
  const props = (state: ClockState, args?: unknown) => ({
    config: {} as ClockConfig,
    state,
    args,
  });

  it('hour-hand-focus: 흐린 긴바늘과 굵은 짧은바늘 윤곽, 이름표', () => {
    const { container } = render(<HourHandFocusOverlay {...props(play({ start: '3:25' }))} />);
    expect(container.querySelector('[data-part="long-ghost"]')?.getAttribute('data-angle')).toBe(
      '150.00',
    );
    expect(container.querySelector('[data-part="short-focus"]')?.getAttribute('data-angle')).toBe(
      '102.50',
    );
    expect(container.textContent).toBe('몇 시는 짧은바늘이 알려 줘요');
  });

  it('rewind-to-hour: 정시 유령 바늘·호 화살표·시 숫자 둘러싸기, 글 없음', () => {
    const { container } = render(<RewindToHourOverlay {...props(play({ start: '8:30' }))} />);
    expect(container.querySelector('[data-part="ghost-short"]')?.getAttribute('data-angle')).toBe(
      '240.00',
    );
    expect(container.querySelector('[data-part="ghost-long"]')?.getAttribute('data-angle')).toBe(
      '0.00',
    );
    expect(container.querySelector('[data-part="rewind-arc"]')).not.toBeNull();
    expect(container.querySelector('[data-part="rewind-head"]')).not.toBeNull();
    expect(container.querySelector('[data-part="hour-ring"]')).not.toBeNull();
    expect(container.textContent).toBe('');
  });

  it('rewind-to-hour: 분이 0이면 그리지 않고, 12시대는 12를 둘러싼다', () => {
    const none = render(<RewindToHourOverlay {...props(play({ start: '8:00' }))} />);
    expect(none.container.querySelector('svg')).toBeNull();
    cleanup();
    const twelve = render(<RewindToHourOverlay {...props(play({ start: '12:40' }))} />);
    const ring = twelve.container.querySelector('[data-part="hour-ring"]');
    expect(Number(ring?.getAttribute('cx'))).toBeCloseTo(275, 5);
    expect(Number(ring?.getAttribute('cy'))).toBeCloseTo(255 - 170, 5);
  });

  it('numeral-minutes: 시계 바깥 이름표 "numeral×5분", 펼치면 띠에도', () => {
    const closed = render(
      <NumeralMinutesOverlay {...props(play({ start: '4:25', unroll: true }), { numeral: 5 })} />,
    );
    expect(closed.container.textContent).toBe('25분');
    expect(closed.container.querySelector('[data-part="strip-label"]')).toBeNull();
    cleanup();
    const open = render(
      <NumeralMinutesOverlay
        {...props(play({ start: '4:25', unroll: true }, [{ type: 'toggle-unroll' }]), {
          numeral: 5,
        })}
      />,
    );
    expect(open.container.textContent).toBe('25분25분');
    expect(open.container.querySelector('[data-part="strip-label"]')).not.toBeNull();
  });

  it('numeral-minutes: 없거나 범위 밖이면 그리지 않는다', () => {
    const state = play({ start: '4:25' });
    for (const args of [undefined, {}, { numeral: 0 }, { numeral: 12 }, { numeral: 2.5 }]) {
      const { container } = render(<NumeralMinutesOverlay {...props(state, args)} />);
      expect(container.querySelector('svg')).toBeNull();
      cleanup();
    }
    const edge = render(<NumeralMinutesOverlay {...props(state, { numeral: 11 })} />);
    expect(edge.container.textContent).toBe('55분');
  });
});
