/** @vitest-environment jsdom */
/** E14 duration·calendar 화면 테스트: 정답 비노출, 키보드·단추 조작, 오버레이 그림. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlusSevenOverlay } from '../calendar/overlays/plus-seven';
import { createCalendarState, reduceCalendar } from '../calendar/reduce';
import type { CalendarAction, CalendarConfig, CalendarState } from '../calendar/types';
import { CalendarView } from '../calendar/CalendarView';
import { DurationView } from '../duration/DurationView';
import { Hour60SplitOverlay } from '../duration/overlays/hour-60-split';
import { createDurationState, reduceDuration } from '../duration/reduce';
import { parseDayTime } from '../duration/settings';
import type { DurationAction, DurationConfig, DurationState } from '../duration/types';

afterEach(cleanup);

const at = (time: string): number => parseDayTime(time) ?? -1;

function duration(
  config: Omit<DurationConfig, 'mode'>,
  actions: readonly DurationAction[] = [],
): DurationState {
  return actions.reduce<DurationState>(
    reduceDuration,
    createDurationState({ mode: 'duration', ...config }),
  );
}

function calendar(
  config: Omit<CalendarConfig, 'mode'>,
  actions: readonly CalendarAction[] = [],
): CalendarState {
  return actions.reduce<CalendarState>(
    reduceCalendar,
    createCalendarState({ mode: 'calendar', ...config }),
  );
}

function renderDuration(state: DurationState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <DurationView state={state} dispatch={dispatch} targetSize={48} readOnly={readOnly} />,
  );
}

function renderCalendar(state: CalendarState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <CalendarView state={state} dispatch={dispatch} targetSize={48} readOnly={readOnly} />,
  );
}

/** 화면 좌표를 담은 data- 속성은 수학 값이 아니라 제외한다. */
const POSITION_ATTRIBUTES = new Set(['data-x', 'data-col', 'data-row', 'data-block']);

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

describe('duration 화면: 걸린 시간 비노출', () => {
  it('시작 화면과 두 표시를 놓은 뒤 모두 걸린 시간 글이 없다', () => {
    // 2:10 → 3:25 = 75분
    const fresh = renderDuration(duration({ from: '2:00', to: '4:00' }));
    expect(everything(fresh.container)).not.toMatch(/걸린|75|1시간 15분/);
    cleanup();
    const placed = renderDuration(
      duration({ from: '2:00', to: '4:00' }, [
        { type: 'set-mark', which: 'start', minutes: at('2:10') },
        { type: 'set-mark', which: 'end', minutes: at('3:25') },
      ]),
    );
    expect(everything(placed.container)).not.toMatch(/걸린|75|1시간 15분/);
    // 색칠 조각은 그려지지만 글은 없다.
    expect(placed.container.querySelectorAll('[data-part="span-piece"]')).toHaveLength(2);
  });

  it('띠: 한 시간 블록 둘, 눈금 숫자 10~50, 시 이름표 셋', () => {
    const { container } = renderDuration(duration({ from: '2:00', to: '4:00' }));
    expect(container.querySelectorAll('[data-part="block"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-part="block-minute"]')).toHaveLength(10);
    const names = [...container.querySelectorAll('[data-part="hour-name"]')].map(
      (e) => e.textContent,
    );
    expect(names).toEqual(['2시', '3시', '4시']);
  });

  it('표시는 슬라이더이고 ←→는 step씩, 처음 누르면 기준 자리에 놓는다', () => {
    const dispatch = vi.fn();
    renderDuration(duration({ from: '2:00', to: '4:00' }), dispatch);
    const startMark = screen.getByRole('slider', { name: '시작 표시' });
    expect(startMark.getAttribute('aria-valuetext')).toBe('아직 놓지 않았어요');
    fireEvent.keyDown(startMark, { key: 'ArrowRight' });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'set-mark',
      which: 'start',
      minutes: at('2:00'),
    });
    cleanup();
    renderDuration(
      duration({ from: '2:00', to: '4:00' }, [
        { type: 'set-mark', which: 'end', minutes: at('3:00') },
      ]),
      dispatch,
    );
    const endMark = screen.getByRole('slider', { name: '끝 표시' });
    expect(endMark.getAttribute('aria-valuetext')).toBe('3시');
    fireEvent.keyDown(endMark, { key: 'ArrowRight' });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'set-mark',
      which: 'end',
      minutes: at('3:05'),
    });
    fireEvent.keyDown(endMark, { key: 'ArrowLeft' });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'set-mark',
      which: 'end',
      minutes: at('2:55'),
    });
  });

  it('단추: 거절되면 이유를 글로 알리고 dispatch하지 않는다', () => {
    const dispatch = vi.fn();
    renderDuration(
      duration({ from: '2:00', to: '4:00' }, [
        { type: 'set-mark', which: 'start', minutes: at('3:00') },
      ]),
      dispatch,
    );
    fireEvent.click(screen.getByRole('button', { name: '끝 ◀' }));
    // 끝이 아직 없어서 기준(시작 3:00)에 놓인다.
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'set-mark',
      which: 'end',
      minutes: at('3:00'),
    });
    dispatch.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '시작 ▶' }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'set-mark',
      which: 'start',
      minutes: at('3:05'),
    });
  });

  it('끝이 시작보다 앞으로 가는 조작은 막고 이유를 알린다', () => {
    const dispatch = vi.fn();
    renderDuration(
      duration({ from: '2:00', to: '4:00' }, [
        { type: 'set-mark', which: 'start', minutes: at('3:00') },
        { type: 'set-mark', which: 'end', minutes: at('3:00') },
      ]),
      dispatch,
    );
    fireEvent.click(screen.getByRole('button', { name: '끝 ◀' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('clock-message').textContent).toBe(
      '끝은 시작보다 앞에 놓을 수 없어요.',
    );
  });

  it('startFixed: 시작 단추가 없고 시작 표시는 키보드로도 못 움직인다', () => {
    const dispatch = vi.fn();
    renderDuration(
      duration({ from: '2:00', to: '4:00', start: '2:40', startFixed: true }),
      dispatch,
    );
    expect(screen.queryByRole('button', { name: '시작 ▶' })).toBeNull();
    const startMark = screen.getByRole('slider', { name: '시작 표시' });
    expect(startMark.getAttribute('aria-readonly')).toBe('true');
    fireEvent.keyDown(startMark, { key: 'ArrowRight' });
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByText('시작은 정해져 있어요. 끝 표시를 띠 위에 놓아 보세요.')).toBeTruthy();
  });

  it('readOnly면 조작 단추가 눌리지 않는다', () => {
    const dispatch = vi.fn();
    renderDuration(duration({ from: '2:00', to: '4:00' }), dispatch, true);
    expect((screen.getByRole('button', { name: '끝 ▶' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole('slider', { name: '끝 표시' }), { key: 'ArrowRight' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('설정 오류면 오류 문구만 보인다', () => {
    renderDuration(duration({ from: '2:30', to: '4:00' }));
    expect(screen.getByTestId('clock-error')).toBeTruthy();
    expect(screen.queryByTestId('clock-canvas')).toBeNull();
  });
});

describe('calendar 화면: 가려진 날짜 비노출', () => {
  const config = {
    month: '2026-11',
    hidden: [8, 12, 19, 26],
    select: true,
    fill: true,
    arrows: true,
  };

  it('가려진 칸은 "?"이고 DOM·data-·aria 어디에도 그 날짜 값이 없다', () => {
    const { container } = renderCalendar(calendar(config));
    const hiddenCells = container.querySelectorAll('[data-part="cell"][data-hidden="true"]');
    expect(hiddenCells).toHaveLength(4);
    for (const cell of hiddenCells) {
      expect(cell.textContent).toBe('?');
      expect(cell.hasAttribute('data-day')).toBe(false);
      expect(cell.getAttribute('aria-label')).toMatch(/^가려진 칸, .요일$/);
      for (const attribute of cell.attributes) {
        if (['data-col', 'data-row', 'tabindex'].includes(attribute.name)) continue;
        expect(attribute.value).not.toMatch(/\b(8|12|19|26)\b/);
      }
    }
    for (const day of [8, 12, 19, 26]) {
      expect(container.querySelector(`[data-day="${day}"]`)).toBeNull();
    }
    // 보이는 칸의 날짜는 그대로 있다.
    expect(container.querySelector('[data-day="5"]')?.textContent).toBe('5');
    // 판 전체 글에서도 가려진 날짜가 "단독 숫자"로 나오지 않는다(18·28처럼 다른 날짜는 따로 센다).
    const texts = [...container.querySelectorAll('[data-part="cell"]')].map((e) => e.textContent);
    for (const day of ['8', '12', '19', '26']) expect(texts).not.toContain(day);
  });

  it('고르거나 화살표를 그려도 가려진 날짜 값이 새지 않는다', () => {
    const state = calendar(config, [
      { type: 'toggle', day: 8 },
      { type: 'draw-arrows', col: 0, fromRow: 0, toRow: 2 },
    ]);
    const { container } = renderCalendar(state);
    const cell = container.querySelector(
      '[data-part="cell"][data-hidden="true"][data-selected="true"]',
    );
    expect(cell?.textContent).toBe('?✓');
    expect(cell?.hasAttribute('data-day')).toBe(false);
    expect(everything(container)).not.toContain('가려진 칸, 일요일, 8');
  });

  it('요일 줄: 기본은 일~토, showWeekdayHeader false면 없다', () => {
    const shown = renderCalendar(calendar({ month: '2026-11' }));
    expect(
      [...shown.container.querySelectorAll('[data-part="weekday"]')].map((e) => e.textContent),
    ).toEqual(['일', '월', '화', '수', '목', '금', '토']);
    cleanup();
    const none = renderCalendar(calendar({ month: '2026-11', showWeekdayHeader: false }));
    expect(none.container.querySelectorAll('[data-part="weekday"]')).toHaveLength(0);
  });

  it('칸은 날 수만큼 그려진다(2024-02는 29칸)', () => {
    const { container } = renderCalendar(calendar({ month: '2024-02' }));
    expect(container.querySelectorAll('[data-part="cell"]')).toHaveLength(29);
    expect(container.querySelector('[data-day="29"]')).not.toBeNull();
  });
});

describe('calendar 화면: 조작', () => {
  const config = { month: '2026-11', hidden: [8, 12], select: true, fill: true, arrows: true };

  function cellAt(container: Element, col: number, row: number): Element {
    const cell = container.querySelector(
      `[data-part="cell"][data-col="${col}"][data-row="${row}"]`,
    );
    if (!cell) throw new Error(`칸 ${col},${row}이 없습니다.`);
    return cell;
  }

  it('Enter로 날짜를 고르고 풀고, 방향키로 칸을 옮긴다', () => {
    const dispatch = vi.fn();
    const { container } = renderCalendar(calendar(config), dispatch);
    const five = cellAt(container, 4, 0);
    fireEvent.keyDown(five, { key: 'Enter' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'toggle', day: 5 });
    const focusSpy = vi.spyOn(cellAt(container, 4, 1) as SVGElement, 'focus');
    fireEvent.keyDown(five, { key: 'ArrowDown' });
    expect(focusSpy).toHaveBeenCalled();
  });

  it('가려진 칸: Enter로 고르고 숫자·Enter로 넣는다', () => {
    const dispatch = vi.fn();
    const { container } = renderCalendar(calendar(config), dispatch);
    const hiddenCell = cellAt(container, 0, 1); // 8일 자리
    fireEvent.keyDown(hiddenCell, { key: 'Enter' });
    expect(dispatch).not.toHaveBeenCalled(); // 고르기만 한다(날짜 고르기와 다르다)
    fireEvent.keyDown(hiddenCell, { key: '8' });
    expect(screen.getByTestId('calendar-buffer').textContent).toContain('8');
    fireEvent.keyDown(hiddenCell, { key: 'Enter' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'fill', day: 8, value: 8 });
  });

  it('키패드: 숫자 두 자리까지, 지우기, 넣기', () => {
    const dispatch = vi.fn();
    const { container } = renderCalendar(calendar(config), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    expect(screen.getByTestId('clock-message').textContent).toBe('가려진 칸을 먼저 눌러 보세요.');
    fireEvent.keyDown(cellAt(container, 0, 1), { key: 'Enter' });
    for (const d of ['1', '2', '3']) fireEvent.click(screen.getByRole('button', { name: d }));
    expect(screen.getByTestId('calendar-buffer').textContent).toContain('12');
    fireEvent.click(screen.getByRole('button', { name: '지우기' }));
    expect(screen.getByTestId('calendar-buffer').textContent).toContain('(없음)');
    fireEvent.click(screen.getByRole('button', { name: '넣기' }));
    expect(screen.getByTestId('clock-message').textContent).toBe('수를 먼저 눌러 보세요.');
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '넣기' }));
    // 99는 1~31 밖이라 막힌다.
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('clock-message').textContent).toBe('1부터 31까지의 수를 넣어요.');
  });

  it('넣은 수는 가려진 칸에 보이고 aria에도 학생이 넣은 수로만 나온다', () => {
    const state = calendar(config, [{ type: 'fill', day: 8, value: 9 }]);
    const { container } = renderCalendar(state);
    const cell = cellAt(container, 0, 1);
    expect(cell.textContent).toBe('9');
    expect(cell.getAttribute('aria-label')).toBe('가려진 칸, 일요일, 넣은 수 9');
    expect(cell.hasAttribute('data-day')).toBe(false);
  });

  it('A 키로 아래 칸으로 화살표 하나, 마지막 줄에서는 안내', () => {
    const dispatch = vi.fn();
    const { container } = renderCalendar(calendar(config), dispatch);
    fireEvent.keyDown(cellAt(container, 4, 0), { key: 'a' });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'draw-arrows',
      col: 4,
      fromRow: 0,
      toRow: 1,
    });
    dispatch.mockClear();
    fireEvent.keyDown(cellAt(container, 0, 4), { key: 'A' }); // 29일, 아래 칸 없음
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('clock-message').textContent).toBe(
      '같은 세로줄에서 위에서 아래로 쓸어 보세요.',
    );
  });

  it('그린 화살표마다 "+7"이 있다', () => {
    const { container } = renderCalendar(
      calendar(config, [{ type: 'draw-arrows', col: 4, fromRow: 0, toRow: 3 }]),
    );
    expect(container.querySelectorAll('[data-part="arrow"]')).toHaveLength(3);
    expect(container.querySelector('[data-part="arrow"]')?.textContent).toBe('+7');
  });

  it('보기 전용(조작 모두 꺼짐): 키패드·처음으로가 없고 Enter는 dispatch하지 않는다', () => {
    const dispatch = vi.fn();
    const { container } = renderCalendar(calendar({ month: '2026-11' }), dispatch);
    expect(screen.queryByRole('button', { name: '넣기' })).toBeNull();
    expect(screen.queryByRole('button', { name: '처음으로' })).toBeNull();
    fireEvent.keyDown(cellAt(container, 4, 0), { key: 'Enter' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('readOnly(화면)면 조작을 보내지 않는다', () => {
    const dispatch = vi.fn();
    const { container } = renderCalendar(calendar(config), dispatch, true);
    fireEvent.keyDown(cellAt(container, 4, 0), { key: 'Enter' });
    fireEvent.keyDown(cellAt(container, 4, 0), { key: 'a' });
    fireEvent.click(screen.getByRole('button', { name: '처음으로' }));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('설정 오류(hidden이 그 달에 없음)면 오류 문구만 보인다', () => {
    renderCalendar(calendar({ month: '2026-11', hidden: [31] }));
    expect(screen.getByTestId('clock-error')).toBeTruthy();
  });
});

describe('힌트 ② 오버레이', () => {
  const durationProps = (state: DurationState) => ({
    config: { mode: 'duration' as const },
    state,
  });
  const calendarProps = (state: CalendarState, args?: unknown) => ({
    config: { mode: 'calendar' as const },
    state,
    args,
  });

  it('hour-60-split: 경계마다 말풍선·강조선, 조각마다 괄호(숫자 없음)', () => {
    const state = duration({ from: '2:00', to: '4:00' }, [
      { type: 'set-mark', which: 'start', minutes: at('2:40') },
      { type: 'set-mark', which: 'end', minutes: at('3:20') },
    ]);
    const { container } = render(<Hour60SplitOverlay {...durationProps(state)} />);
    expect(container.querySelectorAll('[data-part="split-boundary"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-part="piece-bracket"]')).toHaveLength(2);
    expect(container.textContent).toBe('60분이 되면 다음 시');
  });

  it('hour-60-split: 경계 둘을 지나면 말풍선 둘, 조각 셋', () => {
    const state = duration({ from: '1:00', to: '5:00' }, [
      { type: 'set-mark', which: 'start', minutes: at('1:30') },
      { type: 'set-mark', which: 'end', minutes: at('3:30') },
    ]);
    const { container } = render(<Hour60SplitOverlay {...durationProps(state)} />);
    expect(container.querySelectorAll('[data-part="split-boundary"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-part="piece-bracket"]')).toHaveLength(3);
  });

  it('hour-60-split: 경계를 지나지 않거나 표시가 하나뿐이면 그리지 않는다', () => {
    const within = duration({ from: '2:00', to: '4:00' }, [
      { type: 'set-mark', which: 'start', minutes: at('2:10') },
      { type: 'set-mark', which: 'end', minutes: at('2:50') },
    ]);
    expect(
      render(<Hour60SplitOverlay {...durationProps(within)} />).container.querySelector('svg'),
    ).toBeNull();
    cleanup();
    const touching = duration({ from: '2:00', to: '4:00' }, [
      { type: 'set-mark', which: 'start', minutes: at('2:40') },
      { type: 'set-mark', which: 'end', minutes: at('3:00') },
    ]);
    expect(
      render(<Hour60SplitOverlay {...durationProps(touching)} />).container.querySelector('svg'),
    ).toBeNull();
    cleanup();
    const one = duration({ from: '2:00', to: '4:00' }, [
      { type: 'set-mark', which: 'start', minutes: at('2:40') },
    ]);
    expect(
      render(<Hour60SplitOverlay {...durationProps(one)} />).container.querySelector('svg'),
    ).toBeNull();
  });

  it('plus-seven: 그 칸 아래로 끝까지 +7 점선 화살표(칸 숫자는 새로 쓰지 않는다)', () => {
    const state = calendar({ month: '2026-11', hidden: [12], select: true });
    // 5일(목) 열 4: 줄 0 → 4일 줄(5, 12, 19, 26)이라 마디 3개.
    const { container } = render(<PlusSevenOverlay {...calendarProps(state, { day: 5 })} />);
    expect(container.querySelectorAll('[data-part="plus-seven"]')).toHaveLength(3);
    expect(container.textContent).toBe('+7+7+7');
    expect(container.innerHTML).not.toMatch(/data-day/);
    cleanup();
    // 가려진 12일에서 시작해도 값을 쓰지 않는다.
    const hidden = render(<PlusSevenOverlay {...calendarProps(state, { day: 12 })} />);
    expect(hidden.container.querySelectorAll('[data-part="plus-seven"]')).toHaveLength(2);
    expect(hidden.container.textContent).not.toMatch(/\d{2}|12/);
  });

  it('plus-seven: day가 없거나 그 달에 없으면 그리지 않는다, 마지막 줄이면 마디가 없다', () => {
    const state = calendar({ month: '2026-11' });
    for (const args of [undefined, {}, { day: 31 }, { day: 0 }, { day: 'x' }, { day: 2.5 }]) {
      const { container } = render(<PlusSevenOverlay {...calendarProps(state, args)} />);
      expect(container.querySelectorAll('[data-part="plus-seven"]')).toHaveLength(0);
      cleanup();
    }
    const last = render(<PlusSevenOverlay {...calendarProps(state, { day: 29 })} />);
    expect(last.container.querySelectorAll('[data-part="plus-seven"]')).toHaveLength(0);
  });
});
