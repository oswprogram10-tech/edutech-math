/** E14 clock 순수 로직 테스트: 각도·되감기·허용 분·설정 오류·predicates·JSON 왕복. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import definition from '../index';
import {
  angleDelta,
  dragMinutes,
  gearAngles,
  handAngles,
  handsSentence,
  longHandSentence,
  shortHandSentence,
} from '../layout';
import { observe } from '../observe';
import { emit, predicates } from '../events';
import { createInitialState, reduce } from '../reduce';
import { formatTime, hourOf, parseTime, snapMinutes } from '../settings';
import type { ClockAction, ClockConfig, ClockState } from '../types';

function make(config: ClockConfig): ClockState {
  return createInitialState({ mode: 'clock', ...config });
}

function play(state: ClockState, ...actions: ClockAction[]): ClockState {
  return actions.reduce(reduce, state);
}

const at = (time: string): number => {
  const m = parseTime(time);
  if (m === null) throw new Error(time);
  return m;
};

describe('시각 문자열과 바늘 각도', () => {
  it('"H:MM"을 12시간 분으로 바꾼다(12시는 0)', () => {
    expect(parseTime('12:00')).toBe(0);
    expect(parseTime('12:05')).toBe(5);
    expect(parseTime('8:30')).toBe(510);
    expect(parseTime('11:59')).toBe(719);
    expect(parseTime('0:30')).toBeNull();
    expect(parseTime('13:00')).toBeNull();
    expect(parseTime('3:60')).toBeNull();
    expect(parseTime('3')).toBeNull();
    expect(formatTime(5)).toBe('12:05');
    expect(formatTime(510)).toBe('8:30');
    expect(hourOf(0)).toBe(12);
  });

  it('8:30이면 짧은바늘 255°, 긴바늘 180°', () => {
    expect(handAngles(at('8:30'))).toEqual({ hour: 255, minute: 180 });
    expect(handAngles(0)).toEqual({ hour: 0, minute: 0 });
    expect(handAngles(719)).toEqual({ hour: 359.5, minute: 354 });
  });

  it('큰 톱니는 긴바늘 각(6°/분), 작은 톱니는 짧은바늘 각(0.5°/분)과 같이 돈다', () => {
    expect(gearAngles(at('8:30')).small).toBe(255);
    expect(gearAngles(60).big).toBe(0);
    expect(gearAngles(15).big).toBe(90);
  });

  it('누적 각도 → 분: 긴바늘 360°는 60분, 짧은바늘 360°는 720분(한 바퀴)', () => {
    expect(dragMinutes(0, 360, 'long')).toBe(60);
    expect(dragMinutes(715, 30, 'long')).toBe(0);
    expect(dragMinutes(0, -6, 'long')).toBe(719);
    expect(dragMinutes(0, 30, 'short')).toBe(60);
    expect(angleDelta(350, 10)).toBe(20);
    expect(angleDelta(10, 350)).toBe(-20);
  });
});

describe('되감기와 step', () => {
  it('11:55에서 +5분은 12:00, 12:00에서 -1분은 11:59', () => {
    const a = make({ start: '11:55', granularity: 'five-minute' });
    expect(observe(play(a, { type: 'step', delta: 1 }))['time']).toBe('12:00');
    const b = make({ start: '12:00' });
    expect(observe(play(b, { type: 'step', delta: -1 }))['time']).toBe('11:59');
    expect(observe(play(b, { type: 'set-time', minutes: 719 }))['minutes']).toBe(719);
  });

  it('step은 허용 간격의 배수만큼, 정시만 허용이면 한 칸이 한 시간', () => {
    const s = make({ start: '3:00', granularity: 'hour' });
    expect(observe(play(s, { type: 'step', delta: 1 }))['time']).toBe('4:00');
    expect(observe(play(s, { type: 'step', delta: -3 }))['time']).toBe('12:00');
    expect(play(s, { type: 'step', delta: 12 })).toBe(s);
    expect(play(s, { type: 'step', delta: 0 })).toBe(s);
    expect(play(s, { type: 'step', delta: 1.5 })).toBe(s);
  });
});

describe('허용 분', () => {
  it('half-hour에서 8:10은 거절한다', () => {
    const s = make({ start: '8:00', granularity: 'half-hour' });
    expect(play(s, { type: 'set-time', minutes: at('8:10') })).toBe(s);
    expect(observe(play(s, { type: 'set-time', minutes: at('8:30') }))['time']).toBe('8:30');
  });

  it('snapMinuteTo 배열은 granularity보다 우선한다', () => {
    const s = make({ start: '1:00', granularity: 'minute', snapMinuteTo: [0, 30] });
    expect(play(s, { type: 'set-time', minutes: at('1:10') })).toBe(s);
    expect(observe(play(s, { type: 'step', delta: 1 }))['time']).toBe('1:30');
    const t = make({ start: '1:15', granularity: 'hour', snapMinuteTo: [15, 45] });
    expect(observe(play(t, { type: 'step', delta: 1 }))['time']).toBe('1:45');
  });

  it('5-weak: 끌어 놓은 4:24는 4:25에 붙고 4:22는 그대로, 키보드는 1분씩', () => {
    const s = make({ start: '4:00', snapMinuteTo: '5-weak' });
    expect(snapMinutes(s, at('4:24'))).toBe(at('4:25'));
    expect(snapMinutes(s, at('4:26'))).toBe(at('4:25'));
    expect(snapMinutes(s, at('4:22'))).toBe(at('4:22'));
    expect(snapMinutes(s, at('4:59'))).toBe(at('5:00'));
    expect(snapMinutes(s, at('11:59'))).toBe(0);
    expect(observe(play(s, { type: 'step', delta: 1 }))['time']).toBe('4:01');
    expect(observe(play(s, { type: 'set-time', minutes: at('4:22') }))['time']).toBe('4:22');
  });

  it('snapMinutes는 granularity에서 가장 가까운 허용 분을 고른다', () => {
    const half = make({ granularity: 'half-hour' });
    expect(snapMinutes(half, at('8:14'))).toBe(at('8:00'));
    expect(snapMinutes(half, at('8:16'))).toBe(at('8:30'));
    expect(snapMinutes(half, at('8:46'))).toBe(at('9:00'));
    const hour = make({ granularity: 'hour' });
    expect(snapMinutes(hour, at('11:40'))).toBe(0);
    expect(snapMinutes(hour, 720 + 20)).toBe(0);
    const five = make({ granularity: 'five-minute' });
    expect(snapMinutes(five, 4 * 60 + 27)).toBe(at('4:25'));
    expect(snapMinutes(five, 4 * 60 + 28)).toBe(at('4:30'));
  });

  it('범위 밖·정수 아님·같은 값·읽기 전용은 거절한다', () => {
    const s = make({ start: '3:00' });
    expect(play(s, { type: 'set-time', minutes: -1 })).toBe(s);
    expect(play(s, { type: 'set-time', minutes: 720 })).toBe(s);
    expect(play(s, { type: 'set-time', minutes: 3.5 })).toBe(s);
    expect(play(s, { type: 'set-time', minutes: at('3:00') })).toBe(s);
    const ro = make({ start: '3:00', readOnly: true });
    expect(play(ro, { type: 'set-time', minutes: 10 })).toBe(ro);
    expect(play(ro, { type: 'step', delta: 1 })).toBe(ro);
    expect(play(ro, { type: 'toggle-unroll' })).toBe(ro);
  });
});

describe('설정 오류와 기본값', () => {
  it('잘못된 start·허용 분 밖의 start·잘못된 옵션은 오류 상태', () => {
    expect(make({ start: '25:00' }).error).not.toBeNull();
    expect(make({ start: 'abc' }).error).not.toBeNull();
    expect(make({ start: '8:10', granularity: 'half-hour' }).error).not.toBeNull();
    expect(make({ start: '8:10', snapMinuteTo: [0, 30] }).error).not.toBeNull();
    expect(make({ start: '8:00', snapMinuteTo: [] }).error).not.toBeNull();
    expect(make({ start: '8:00', snapMinuteTo: [60] }).error).not.toBeNull();
    expect(make({ start: '8:00', granularity: 'second' as never }).error).not.toBeNull();
    expect(make({ start: '8:00', showGears: 1 as never }).error).not.toBeNull();
    expect(make({ start: '8:00', digitalReadout: 'x' as never }).error).not.toBeNull();
    const bad = make({ start: '8:10', granularity: 'hour' });
    expect(play(bad, { type: 'step', delta: 1 })).toBe(bad);
  });

  it('기본은 12:00·분 단위·디지털 없음, mode만 있으면 샌드박스 기본', () => {
    const d = make({ start: '12:00' });
    expect(d).toMatchObject({ minutes: 0, digitalReadout: 'never', showGears: false });
    expect(d.unroll).toBe(false);
    const sample = createInitialState({ mode: 'clock' });
    expect(sample).toMatchObject({ minutes: 180, showGears: true, unroll: true, error: null });
  });

  it("digitalReadout 'after-submit'은 'never'로 읽는다", () => {
    expect(make({ start: '3:00', digitalReadout: 'after-submit' }).digitalReadout).toBe('never');
    expect(make({ start: '3:00', digitalReadout: 'always' }).digitalReadout).toBe('always');
  });
});

describe('펼치기·reset', () => {
  it('unroll 옵션이 있을 때만 toggle-unroll이 받아들여진다', () => {
    const off = make({ start: '3:00' });
    expect(play(off, { type: 'toggle-unroll' })).toBe(off);
    const on = make({ start: '3:00', unroll: true });
    const open = play(on, { type: 'toggle-unroll' });
    expect(open.unrolled).toBe(true);
    expect(open.moves).toBe(0);
    expect(play(open, { type: 'toggle-unroll' }).unrolled).toBe(false);
  });

  it('reset은 처음 시각·0회·감긴 상태로 돌아가고, 이미 처음이면 같은 상태', () => {
    const s = make({ start: '3:00', unroll: true });
    expect(play(s, { type: 'reset' })).toBe(s);
    const moved = play(s, { type: 'step', delta: 10 }, { type: 'toggle-unroll' });
    expect(play(moved, { type: 'reset' })).toEqual(s);
  });
});

describe('Observation·predicates·JSON', () => {
  it('Observation은 시각 문자열·시·분·분 수·횟수·펼침을 낸다', () => {
    const s = play(make({ start: '12:00' }), { type: 'set-time', minutes: at('12:05') });
    expect(observe(s)).toEqual({
      mode: 'clock',
      time: '12:05',
      hour: 12,
      minute: 5,
      minutes: 5,
      moves: 1,
      unrolled: false,
      misconceptions: [],
    });
  });

  it('predicates', () => {
    const o = observe(play(make({ start: '3:00', unroll: true }), { type: 'step', delta: 25 }));
    expect(predicates['timeIs']?.(o, { time: '3:25' })).toBe(true);
    expect(predicates['timeIs']?.(o, { time: '03:25' })).toBe(false);
    expect(predicates['timeIs']?.(o, { time: '3:26' })).toBe(false);
    expect(predicates['hourIs']?.(o, { hour: 3 })).toBe(true);
    expect(predicates['hourIs']?.(o, { hour: 4 })).toBe(false);
    expect(predicates['minuteIs']?.(o, { minute: 25 })).toBe(true);
    expect(predicates['minuteIs']?.(o, undefined)).toBe(false);
    expect(predicates['moved']?.(o, undefined)).toBe(true);
    expect(predicates['unrolled']?.(o, undefined)).toBe(false);
    const fresh = observe(make({ start: '3:00' }));
    expect(predicates['moved']?.(fresh, undefined)).toBe(false);
    const u = observe(play(make({ start: '3:00', unroll: true }), { type: 'toggle-unroll' }));
    expect(predicates['unrolled']?.(u, undefined)).toBe(true);
  });

  it('상태·Observation은 JSON 왕복하고 emit은 시각을 싣지 않는다', () => {
    const s = play(make({ start: '3:00', unroll: true }), { type: 'step', delta: 7 });
    assertSerializable(s);
    assertSerializable(observe(s));
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    const events = emit(make({ start: '3:00' }), s, { type: 'step', delta: 7 });
    expect(events).toEqual([{ name: 'clock-changed', payload: { moved: true, unrolled: false } }]);
    expect(emit(s, s, { type: 'reset' })).toEqual([]);
    expect(definition.events).toContain('clock-changed');
    expect(definition.modes).toEqual(['clock', 'duration', 'calendar', 'time-calc']);
  });
});

describe('바늘 방향 문장은 시각을 계산해 말하지 않는다', () => {
  it('정확히 숫자를 가리키면 "N을 가리켜요", 사이면 "N과 M 사이"', () => {
    expect(longHandSentence(at('8:30'))).toBe('긴바늘이 6을 가리켜요');
    expect(shortHandSentence(at('8:30'))).toBe('짧은바늘이 8과 9 사이에 있어요');
    expect(shortHandSentence(at('8:00'))).toBe('짧은바늘이 8을 가리켜요');
    expect(shortHandSentence(0)).toBe('짧은바늘이 12를 가리켜요');
    expect(shortHandSentence(at('12:30'))).toBe('짧은바늘이 12와 1 사이에 있어요');
    expect(shortHandSentence(at('11:30'))).toBe('짧은바늘이 11과 12 사이에 있어요');
    expect(longHandSentence(at('4:28'))).toBe('긴바늘이 5와 6 사이에 있어요');
    expect(longHandSentence(at('4:58'))).toBe('긴바늘이 11과 12 사이에 있어요');
    expect(handsSentence(at('8:30'), true)).toBe('짧은바늘이 8과 9 사이에 있어요');
    expect(handsSentence(at('8:30'), false)).toContain('긴바늘이 6을 가리켜요');
  });
});
