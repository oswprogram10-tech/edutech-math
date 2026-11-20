/** @vitest-environment jsdom */
/** E14 time-calc 화면 테스트: 정답 비노출, 단추·키보드 조작, 올가미 연출(400ms·움직임 줄이기), sixty-overflow 오버레이. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SixtyOverflowOverlay } from '../timecalc/overlays/sixty-overflow';
import { createTimeCalcState, reduceTimeCalc } from '../timecalc/reduce';
import { TimeCalcView } from '../timecalc/TimeCalcView';
import type { TimeCalcAction, TimeCalcConfig, TimeCalcState } from '../timecalc/types';
import { LASSO_MS } from '../timecalc/useTimeCalcUi';

const add: TimeCalcConfig = {
  mode: 'time-calc',
  op: 'add',
  a: { h: 1, m: 45, s: 0 },
  b: { h: 0, m: 30, s: 0 },
  units: ['h', 'm'],
};
const sub: TimeCalcConfig = {
  mode: 'time-calc',
  op: 'sub',
  a: { h: 3, m: 10, s: 0 },
  b: { h: 1, m: 40, s: 0 },
  units: ['h', 'm'],
};

function timeCalc(config: TimeCalcConfig, ...actions: TimeCalcAction[]): TimeCalcState {
  return actions.reduce(reduceTimeCalc, createTimeCalcState(config));
}
function renderView(state: TimeCalcState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <TimeCalcView state={state} dispatch={dispatch} targetSize={48} readOnly={readOnly} />,
  );
}

function everything(container: Element): string {
  const parts: string[] = [container.textContent ?? ''];
  for (const element of container.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      if (attribute.name.startsWith('data-') || attribute.name.startsWith('aria-')) {
        parts.push(attribute.value);
      }
    }
  }
  return parts.join('\n');
}

function mockReducedMotion(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => mockReducedMotion(false));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('time-calc 판', () => {
  it('add: 큰 블록 1개와 작은 칸(막대 7개 + 낱개 5개)이 처음부터 합쳐져 있다', () => {
    const { container } = renderView(timeCalc(add));
    expect(container.querySelectorAll('[data-part="big-block"]')).toHaveLength(1);
    // 75칸 = 10개 막대 7개 + 낱개 5개. 막대 6개씩 한 묶음이라 묶음이 둘이다.
    expect(container.querySelectorAll('[data-part="rod"]')).toHaveLength(7);
    expect(container.querySelectorAll('[data-part="rod-group"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-part="single"]')).toHaveLength(5);
    expect(container.querySelector('[data-part="subtrahend"]')).toBeNull();
  });

  it('sub: a만 놓고 위에 "뺄 시간" 표가 있다', () => {
    const { container } = renderView(timeCalc(sub));
    expect(container.querySelectorAll('[data-part="big-block"]')).toHaveLength(3);
    expect(container.querySelector('[data-part="subtrahend"]')?.textContent).toBe(
      '뺄 시간 1시간 40분',
    );
  });

  it('DOM·aria·data-에 지금 값이나 결과(2시간 15분, 1시간 30분)가 글로 없다', () => {
    for (const [config, actions] of [
      [add, []],
      [add, [{ type: 'bundle' } as const]],
      [sub, [{ type: 'unbundle' } as const, { type: 'take-away' } as const]],
    ] as const) {
      const { container, unmount } = renderView(timeCalc(config, ...actions));
      const text = everything(container);
      expect(text).not.toMatch(/2시간 15분|1시간 30분|1시간 75분|135분|90분/);
      expect(text).not.toMatch(/정답/);
      unmount();
    }
  });

  it('분·초 단위는 칸 이름과 단추 이름이 분·초로 바뀐다', () => {
    const state = timeCalc({
      mode: 'time-calc',
      op: 'add',
      a: { m: 1, s: 40 },
      b: { m: 0, s: 50 },
      units: ['m', 's'],
    });
    renderView(state);
    expect(screen.getByRole('button', { name: '1분으로 묶기' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '60초로 풀기' })).not.toBeNull();
    expect(screen.getByText('초 칸')).not.toBeNull();
  });

  it('설정 오류이면 오류 문구만 보인다', () => {
    renderView(timeCalc({ ...add, units: ['x'] }));
    expect(screen.getByTestId('clock-error')).not.toBeNull();
    expect(screen.queryByTestId('timecalc-canvas')).toBeNull();
  });
});

describe('조작 칸', () => {
  it('sub에서만 [빼기]가 있다', () => {
    renderView(timeCalc(add));
    expect(screen.queryByRole('button', { name: '빼기' })).toBeNull();
    cleanup();
    renderView(timeCalc(sub));
    expect(screen.getByRole('button', { name: '빼기' })).not.toBeNull();
  });

  it('[60분으로 풀기]와 [빼기]가 Action을 보낸다(움직임 연출 없음)', () => {
    const dispatch = vi.fn();
    renderView(timeCalc(sub), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '60분으로 풀기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'unbundle' });
    fireEvent.click(screen.getByRole('button', { name: '빼기' }));
    // 이 렌더의 상태는 아직 풀기 전이라 빼기는 거절된다(칸이 모자라요).
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('clock-message').textContent).toBe('칸이 모자라요.');
  });

  it('조건이 안 맞는 단추는 이유를 알리고 Action을 보내지 않는다', () => {
    const dispatch = vi.fn();
    renderView(timeCalc({ ...add, a: { h: 1, m: 10 }, b: { h: 0, m: 20 } }), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '1시간으로 묶기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('clock-message').textContent).toContain('60개');
    // 작은 칸이 60 이상이면 풀 수 없다.
    cleanup();
    renderView(timeCalc(add), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '60분으로 풀기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('clock-message').textContent).toContain('60개가 안 될 때만');
  });

  it('단추는 키보드 포커스가 되고 Enter(클릭)로 눌린다(button 요소)', () => {
    renderView(timeCalc(sub));
    for (const name of ['1시간으로 묶기', '60분으로 풀기', '빼기', '처음으로']) {
      const button = screen.getByRole('button', { name });
      expect(button.tagName).toBe('BUTTON');
      expect((button as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it('읽기 전용이면 단추가 모두 꺼진다', () => {
    renderView(timeCalc(sub), vi.fn(), true);
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });
});

describe('묶기 올가미 연출', () => {
  it('묶기를 누르면 400ms 동안 올가미가 그려지고, 그 뒤에 Action을 보낸다', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const { container } = renderView(timeCalc(add), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '1시간으로 묶기' }));
    expect(container.querySelector('[data-part="lasso"]')).not.toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
    // 연출 중에는 다른 조작을 무시한다(단추를 끄면 키보드 초점이 사라지므로 끄지는 않는다).
    const bundleButton = screen.getByRole('button', {
      name: '1시간으로 묶기',
    }) as HTMLButtonElement;
    expect(bundleButton.disabled).toBe(false);
    fireEvent.click(bundleButton);
    fireEvent.click(screen.getByRole('button', { name: '60분으로 풀기' }));
    expect(dispatch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(LASSO_MS - 1);
    });
    expect(dispatch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(dispatch).toHaveBeenCalledWith({ type: 'bundle' });
    expect(container.querySelector('[data-part="lasso"]')).toBeNull();
    expect(LASSO_MS).toBe(400);
  });

  it('움직임 줄이기를 켜면 올가미 없이 바로 보낸다', () => {
    mockReducedMotion(true);
    const dispatch = vi.fn();
    const { container } = renderView(timeCalc(add), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '1시간으로 묶기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'bundle' });
    expect(container.querySelector('[data-part="lasso"]')).toBeNull();
  });

  it('연출 중에 화면을 닫아도(unmount) 늦게 Action을 보내지 않는다', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const { unmount } = renderView(timeCalc(add), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '1시간으로 묶기' }));
    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('sixty-overflow 오버레이', () => {
  const props = (state: TimeCalcState) => ({ config: add, state });

  it('작은 칸이 60 이상이면 처음 60칸 둘레에 점선 상자, "60분 = 1시간", 시계 아이콘', () => {
    const { container } = render(<SixtyOverflowOverlay {...props(timeCalc(add))} />);
    expect(container.querySelector('[data-part="box"]')).not.toBeNull();
    expect(container.querySelector('[data-part="label"]')?.textContent).toBe('60분 = 1시간');
    expect(container.querySelector('[data-part="clock"]')).not.toBeNull();
  });

  it('초 단위는 "60초 = 1분"이다', () => {
    const state = timeCalc({
      mode: 'time-calc',
      op: 'add',
      a: { m: 1, s: 40 },
      b: { m: 0, s: 50 },
      units: ['m', 's'],
    });
    const { container } = render(<SixtyOverflowOverlay {...props(state)} />);
    expect(container.querySelector('[data-part="label"]')?.textContent).toBe('60초 = 1분');
  });

  it('작은 칸이 60 미만(경계 59, 묶은 뒤)이거나 설정 오류이면 그리지 않는다', () => {
    const at59 = timeCalc({ ...add, a: { h: 1, m: 29 }, b: { h: 0, m: 30 } });
    expect(at59.small).toBe(59);
    expect(render(<SixtyOverflowOverlay {...props(at59)} />).container.firstChild).toBeNull();
    cleanup();
    const bundled = timeCalc(add, { type: 'bundle' });
    expect(render(<SixtyOverflowOverlay {...props(bundled)} />).container.firstChild).toBeNull();
    cleanup();
    const broken = timeCalc({ ...add, units: ['x'] });
    expect(render(<SixtyOverflowOverlay {...props(broken)} />).container.firstChild).toBeNull();
  });

  it('sub에서도 풀기로 작은 칸이 60 이상이 되면(70) 그린다', () => {
    const state = timeCalc(sub, { type: 'unbundle' });
    const { container } = render(<SixtyOverflowOverlay {...props(state)} />);
    expect(container.querySelector('[data-part="box"]')).not.toBeNull();
  });
});
