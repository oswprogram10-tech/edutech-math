/** E14 calendar 순수 로직 테스트: 요일·날 수·채우기·화살표·판정·JSON 왕복. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { calendarPredicates, emitCalendar } from '../calendar/events';
import { daysInMonth, isLeapYear, parseMonth, weekdayOf } from '../calendar/date';
import { arrowShape, cellAt, cellRect } from '../calendar/layout';
import { hiddenCorrect, observeCalendar } from '../calendar/observe';
import { createCalendarState, reduceCalendar } from '../calendar/reduce';
import { colOf, dayAt, rowCount, rowOf } from '../calendar/settings';
import type { CalendarAction, CalendarConfig, CalendarState } from '../calendar/types';
import definition from '../index';

const ALL = { select: true, fill: true, arrows: true } as const;

function make(config: Omit<CalendarConfig, 'mode'> = { month: '2026-11', ...ALL }): CalendarState {
  return createCalendarState({ mode: 'calendar', ...config });
}

function play(state: CalendarState, ...actions: CalendarAction[]): CalendarState {
  return actions.reduce(reduceCalendar, state);
}

describe('요일과 날 수(Date를 쓰지 않는다)', () => {
  it('2026-11-01은 일요일이다', () => {
    expect(weekdayOf(2026, 11, 1)).toBe(0);
    expect(weekdayOf(2026, 11, 5)).toBe(4);
  });

  it('알려진 날짜들: 2000-01-01 토, 2024-02-29 목, 1999-12-31 금, 2026-01-01 목', () => {
    expect(weekdayOf(2000, 1, 1)).toBe(6);
    expect(weekdayOf(2024, 2, 29)).toBe(4);
    expect(weekdayOf(1999, 12, 31)).toBe(5);
    expect(weekdayOf(2026, 1, 1)).toBe(4);
  });

  it('윤년: 2024-02는 29일, 2026-02는 28일, 1900·2100은 평년, 2000은 윤년', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it('달마다 날 수(30일·31일인 달)', () => {
    const lengths = Array.from({ length: 12 }, (_, i) => daysInMonth(2026, i + 1));
    expect(lengths).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });

  it('달 첫날부터 마지막 날까지 요일이 하루씩 이어진다', () => {
    for (const [year, month] of [
      [2024, 2],
      [2026, 11],
      [2026, 3],
    ] as const) {
      for (let d = 1; d < daysInMonth(year, month); d += 1) {
        expect(weekdayOf(year, month, d + 1)).toBe((weekdayOf(year, month, d) + 1) % 7);
      }
    }
  });

  it('"YYYY-MM" 읽기', () => {
    expect(parseMonth('2026-11')).toEqual({ year: 2026, month: 11 });
    for (const text of ['2026-13', '2026-00', '2026-1', '26-11', '1500-01', 5, undefined]) {
      expect(parseMonth(text)).toBeNull();
    }
  });
});

describe('격자', () => {
  it('2026-11: 5줄, 5일은 목요일 칸(열 4, 줄 0), 8일은 (열 0, 줄 1)', () => {
    const state = make();
    expect(rowCount(state)).toBe(5);
    expect([colOf(state, 5), rowOf(state, 5)]).toEqual([4, 0]);
    expect([colOf(state, 8), rowOf(state, 8)]).toEqual([0, 1]);
    expect(dayAt(state, 0, 0)).toBe(1);
    expect(dayAt(state, 6, 4)).toBeNull(); // 30일 다음 칸은 달 밖
    expect(dayAt(state, 0, 4)).toBe(29);
  });

  it('6줄이 되는 달(2026-08: 토요일 시작, 31일)', () => {
    const state = make({ month: '2026-08' });
    expect(state.first).toBe(6);
    expect(rowCount(state)).toBe(6);
    expect(dayAt(state, 1, 5)).toBe(31);
  });

  it('칸 칸 높이는 최소 배율 0.6에서도 48px 이상이다', () => {
    expect(cellRect(0, 0).h * 0.6).toBeGreaterThanOrEqual(48);
    expect(cellRect(0, 0).w * 0.6).toBeGreaterThanOrEqual(48);
    expect(cellAt(cellRect(3, 2).x + 5, cellRect(3, 2).y + 5)).toEqual({ col: 3, row: 2 });
    expect(cellAt(10, 10)).toBeNull();
    const a = arrowShape(2, 1);
    expect(a.y2).toBeGreaterThan(a.y1);
  });
});

describe('설정', () => {
  it('hidden이 그 달에 없으면 설정 오류다(2026-11에 31일)', () => {
    expect(make({ month: '2026-11', hidden: [31] }).error).not.toBeNull();
    expect(make({ month: '2026-11', hidden: [30] }).error).toBeNull();
    expect(make({ month: '2026-02', hidden: [29] }).error).not.toBeNull();
    expect(make({ month: '2024-02', hidden: [29] }).error).toBeNull();
    expect(make({ month: '2026-11', hidden: [0] }).error).not.toBeNull();
    expect(make({ month: '2026-11', hidden: [1.5] }).error).not.toBeNull();
  });

  it('잘못된 month·flag는 오류, hidden은 정렬·중복 제거', () => {
    expect(make({ month: '2026-13' }).error).not.toBeNull();
    expect(make({ month: '2026-11', select: 1 as unknown as boolean }).error).not.toBeNull();
    expect(make({ month: '2026-11', hidden: [19, 8, 8] }).hidden).toEqual([8, 19]);
  });

  it('기본은 요일 줄 켬, 조작 모두 꺼짐(보기 전용)이고 샌드박스 기본은 모두 켬', () => {
    const state = make({ month: '2026-11' });
    expect([state.weekdayHeader, state.canSelect, state.canFill, state.canArrow]).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(play(state, { type: 'toggle', day: 5 })).toBe(state);
    const sample = createCalendarState({ mode: 'calendar' });
    expect(sample.error).toBeNull();
    expect([sample.canSelect, sample.canFill, sample.canArrow]).toEqual([true, true, true]);
    expect(sample.hidden).toEqual([8, 12, 19, 26]);
  });
});

describe('고르기', () => {
  it('고르면 오름차순으로 쌓이고 다시 누르면 풀린다', () => {
    let state = make();
    state = play(state, { type: 'toggle', day: 19 }, { type: 'toggle', day: 5 });
    expect(state.selected).toEqual([5, 19]);
    state = play(state, { type: 'toggle', day: 19 });
    expect(state.selected).toEqual([5]);
  });

  it('달 밖 날짜는 거절한다', () => {
    const state = make();
    for (const day of [0, 31, -1, 2.5]) {
      expect(play(state, { type: 'toggle', day })).toBe(state);
    }
  });

  it('selectedEquals는 집합 비교다(순서·중복 무시)', () => {
    const state = play(
      make(),
      { type: 'toggle', day: 26 },
      { type: 'toggle', day: 5 },
      { type: 'toggle', day: 19 },
      { type: 'toggle', day: 12 },
    );
    const o = observeCalendar(state);
    expect(o['selected']).toEqual([5, 12, 19, 26]);
    const eq = calendarPredicates['selectedEquals'];
    expect(eq?.(o, { days: [5, 12, 19, 26] })).toBe(true);
    expect(eq?.(o, { days: [26, 19, 12, 5, 5] })).toBe(true);
    expect(eq?.(o, { days: [5, 12, 19] })).toBe(false);
    expect(eq?.(o, { days: [5, 12, 19, 27] })).toBe(false);
    expect(eq?.(o, { days: 'x' })).toBe(false);
    expect(eq?.(observeCalendar(make()), { days: [] })).toBe(true);
  });
});

describe('가려진 칸 채우기', () => {
  const hidden = { month: '2026-11', hidden: [8, 12, 19, 26], ...ALL };

  it('모두 맞게 채우면 hiddenCorrect, 하나라도 틀리면 아니다', () => {
    let state = make(hidden);
    expect(hiddenCorrect(state)).toBe(false);
    for (const day of [8, 12, 19]) state = play(state, { type: 'fill', day, value: day });
    expect(hiddenCorrect(state)).toBe(false);
    state = play(state, { type: 'fill', day: 26, value: 25 });
    expect(observeCalendar(state)['hiddenCorrect']).toBe(false);
    state = play(state, { type: 'fill', day: 26, value: 26 });
    expect(observeCalendar(state)['hiddenCorrect']).toBe(true);
    expect(calendarPredicates['hiddenAllCorrect']?.(observeCalendar(state), undefined)).toBe(true);
    expect(calendarPredicates['filledIs']?.(observeCalendar(state), { day: 12, value: 12 })).toBe(
      true,
    );
    expect(calendarPredicates['filledIs']?.(observeCalendar(state), { day: 12, value: 13 })).toBe(
      false,
    );
    expect(calendarPredicates['filledIs']?.(observeCalendar(state), { day: 5, value: 5 })).toBe(
      false,
    );
  });

  it('가려진 칸이 없으면 hiddenCorrect는 false다', () => {
    expect(hiddenCorrect(make({ month: '2026-11', ...ALL }))).toBe(false);
  });

  it('가려지지 않은 칸 fill은 거절한다', () => {
    const state = make(hidden);
    expect(play(state, { type: 'fill', day: 5, value: 5 })).toBe(state);
  });

  it('값은 1~31 정수만, 같은 값은 거절, 덮어쓰기는 받는다', () => {
    const state = make(hidden);
    for (const value of [0, 32, -3, 1.5]) {
      expect(play(state, { type: 'fill', day: 8, value })).toBe(state);
    }
    const one = play(state, { type: 'fill', day: 8, value: 31 });
    expect(one.filled).toEqual({ '8': 31 });
    expect(play(one, { type: 'fill', day: 8, value: 31 })).toBe(one);
    expect(play(one, { type: 'fill', day: 8, value: 8 }).filled).toEqual({ '8': 8 });
  });

  it('fill이 꺼져 있으면 거절한다', () => {
    const state = make({ month: '2026-11', hidden: [8], select: true });
    expect(play(state, { type: 'fill', day: 8, value: 8 })).toBe(state);
  });
});

describe('세로줄 화살표', () => {
  it('같은 열에서 위→아래: 마디마다 화살표 하나', () => {
    let state = make();
    state = play(state, { type: 'draw-arrows', col: 4, fromRow: 0, toRow: 3 });
    expect(state.segments).toEqual(['4:0', '4:1', '4:2']);
    expect(observeCalendar(state)['arrows']).toBe(3);
    expect(calendarPredicates['arrowsAtLeast']?.(observeCalendar(state), { n: 3 })).toBe(true);
    expect(calendarPredicates['arrowsAtLeast']?.(observeCalendar(state), { n: 4 })).toBe(false);
  });

  it('겹치는 마디는 한 번만 센다, 이미 있는 것뿐이면 거절한다', () => {
    let state = play(make(), { type: 'draw-arrows', col: 4, fromRow: 0, toRow: 2 });
    state = play(state, { type: 'draw-arrows', col: 4, fromRow: 1, toRow: 3 });
    expect(state.segments).toEqual(['4:0', '4:1', '4:2']);
    expect(play(state, { type: 'draw-arrows', col: 4, fromRow: 0, toRow: 1 })).toBe(state);
  });

  it('위로 쓸기·같은 줄·범위 밖·달 밖 칸을 지나는 화살표는 거절한다', () => {
    const state = make();
    const bad = [
      { col: 4, fromRow: 2, toRow: 0 },
      { col: 4, fromRow: 1, toRow: 1 },
      { col: 4, fromRow: 0, toRow: 9 },
      { col: 7, fromRow: 0, toRow: 1 },
      { col: 0, fromRow: 3, toRow: 5 },
      { col: 6, fromRow: 3, toRow: 4 }, // 5줄째 토요일 칸은 달 밖(30일 다음)
      { col: 0.5, fromRow: 0, toRow: 1 },
    ];
    for (const a of bad) expect(play(state, { type: 'draw-arrows', ...a })).toBe(state);
    // 1일(일요일)은 열 0 줄 0 — 열 0은 줄 0~4가 모두 달 안이다.
    expect(
      play(state, { type: 'draw-arrows', col: 0, fromRow: 0, toRow: 4 }).segments,
    ).toHaveLength(4);
  });

  it('다른 열로 가는 화살표는 Action 모양 자체가 없다(열 하나)', () => {
    const state = play(make(), { type: 'draw-arrows', col: 1, fromRow: 0, toRow: 1 });
    expect(state.segments).toEqual(['1:0']);
  });

  it('arrows가 꺼져 있으면 거절한다', () => {
    const state = make({ month: '2026-11', select: true });
    expect(play(state, { type: 'draw-arrows', col: 1, fromRow: 0, toRow: 1 })).toBe(state);
  });
});

describe('처음으로·JSON·등록', () => {
  it('reset은 고른 날·넣은 수·화살표를 모두 지운다(처음이면 같은 객체)', () => {
    const fresh = make();
    expect(play(fresh, { type: 'reset' })).toBe(fresh);
    const used = play(
      make({ month: '2026-11', hidden: [8], ...ALL }),
      { type: 'toggle', day: 3 },
      { type: 'fill', day: 8, value: 8 },
      { type: 'draw-arrows', col: 0, fromRow: 0, toRow: 1 },
    );
    const back = play(used, { type: 'reset' });
    expect([back.selected, back.filled, back.segments, back.moves]).toEqual([[], {}, [], 0]);
  });

  it('상태·Observation이 JSON으로 왕복해도 같다', () => {
    const state = play(
      make({ month: '2026-11', hidden: [8, 12], ...ALL }),
      { type: 'toggle', day: 3 },
      { type: 'fill', day: 8, value: 8 },
      { type: 'draw-arrows', col: 0, fromRow: 0, toRow: 2 },
    );
    assertSerializable(state);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    assertSerializable(observeCalendar(state));
  });

  it('엔진 정의가 calendar를 나눠 준다', () => {
    const state = definition.createInitialState({ mode: 'calendar', month: '2026-11', ...ALL });
    expect(state.mode).toBe('calendar');
    const next = definition.reduce(state, { type: 'toggle', day: 5 });
    expect(definition.observe(next, { mode: 'calendar' })).toMatchObject({ selected: [5] });
    expect(definition.emit?.(state, next, { type: 'toggle', day: 5 })).toEqual([
      { name: 'calendar-changed', payload: { arrows: 0 } },
    ]);
    const same = make();
    expect(emitCalendar(same, same)).toEqual([]);
    expect(definition.events).toContain('calendar-changed');
    expect(definition.overlays).toHaveProperty('plus-seven');
  });
});
