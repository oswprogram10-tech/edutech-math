/** E14 duration 순수 로직 테스트: 걸린 시간·거절·범위 오류·판정·JSON 왕복·띠 좌표. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { durationPredicates, emitDuration } from '../duration/events';
import {
  BAND,
  blocksOf,
  crossedBoundaries,
  gapCenterX,
  nearestMinutes,
  pieces,
  xOfMinutes,
} from '../duration/layout';
import { observeDuration } from '../duration/observe';
import { createDurationState, reduceDuration } from '../duration/reduce';
import { formatDayTime, parseDayTime } from '../duration/settings';
import type { DurationAction, DurationConfig, DurationState } from '../duration/types';
import definition from '../index';

function make(config: Omit<DurationConfig, 'mode'> = { from: '2:00', to: '4:00' }): DurationState {
  return createDurationState({ mode: 'duration', ...config });
}

function play(state: DurationState, ...actions: DurationAction[]): DurationState {
  return actions.reduce(reduceDuration, state);
}

const at = (time: string): number => {
  const m = parseDayTime(time);
  if (m === null) throw new Error(time);
  return m;
};

const start = (time: string): DurationAction => ({
  type: 'set-mark',
  which: 'start',
  minutes: at(time),
});
const end = (time: string): DurationAction => ({
  type: 'set-mark',
  which: 'end',
  minutes: at(time),
});

describe('걸린 시간', () => {
  it('2:40 → 3:20이면 elapsed 40이다(시를 넘는 구간)', () => {
    const state = play(make(), start('2:40'), end('3:20'));
    expect(observeDuration(state)).toMatchObject({
      mode: 'duration',
      start: '2:40',
      end: '3:20',
      elapsed: 40,
    });
  });

  it('표시가 하나뿐이면 elapsed는 null이다', () => {
    expect(observeDuration(play(make(), start('2:40')))['elapsed']).toBeNull();
    expect(observeDuration(play(make(), end('3:20')))['elapsed']).toBeNull();
    expect(observeDuration(make())).toMatchObject({ start: null, end: null, elapsed: null });
  });

  it('경계값: 같은 자리(0분), 띠 전체(4시간=240분), 정시에서 정시', () => {
    expect(observeDuration(play(make(), start('3:00'), end('3:00')))['elapsed']).toBe(0);
    const four = make({ from: '1:00', to: '5:00' });
    expect(observeDuration(play(four, start('1:00'), end('5:00')))['elapsed']).toBe(240);
    expect(observeDuration(play(make(), start('2:00'), end('3:00')))['elapsed']).toBe(60);
  });

  it('start 설정과 startFixed: 끝만 놓는다', () => {
    const state = make({ from: '2:00', to: '4:00', start: '2:40', startFixed: true });
    expect(observeDuration(state)).toMatchObject({ start: '2:40', end: null });
    expect(play(state, start('3:00'))).toBe(state);
    const done = play(state, end('3:20'));
    expect(observeDuration(done)['elapsed']).toBe(40);
    // 처음으로: 고정된 시작은 남고 끝만 비운다.
    const again = reduceDuration(done, { type: 'reset' });
    expect(observeDuration(again)).toMatchObject({ start: '2:40', end: null });
  });
});

describe('거절', () => {
  it('끝이 시작보다 앞이면 거절한다(같은 객체)', () => {
    const state = play(make(), start('3:00'));
    expect(play(state, end('2:55'))).toBe(state);
    expect(play(state, end('3:00'))['end']).toBe(at('3:00'));
  });

  it('시작이 끝보다 뒤여도 거절한다', () => {
    const state = play(make(), end('3:00'));
    expect(play(state, start('3:05'))).toBe(state);
  });

  it('step 밖(5분 단위에서 2:42), 범위 밖(1:55, 4:05)은 거절한다', () => {
    const state = make();
    expect(play(state, start('2:42'))).toBe(state);
    expect(play(state, start('1:55'))).toBe(state);
    expect(play(state, end('4:05'))).toBe(state);
    expect(play(state, { type: 'set-mark', which: 'end', minutes: 2.5 })).toBe(state);
  });

  it('step 1이면 1분 자리에 놓인다', () => {
    const state = make({ from: '2:00', to: '4:00', step: 1 });
    expect(observeDuration(play(state, start('2:42')))['start']).toBe('2:42');
  });

  it('같은 자리를 또 놓으면 거절하고, 설정 오류 상태는 아무것도 받지 않는다', () => {
    const placed = play(make(), start('2:40'));
    expect(play(placed, start('2:40'))).toBe(placed);
    const broken = createDurationState({ mode: 'duration', from: '2:30', to: '4:00' });
    expect(broken.error).not.toBeNull();
    expect(reduceDuration(broken, start('2:40'))).toBe(broken);
  });

  it('처음 상태에서 reset은 같은 객체다', () => {
    const state = make();
    expect(reduceDuration(state, { type: 'reset' })).toBe(state);
  });
});

describe('설정 오류', () => {
  const bad: Omit<DurationConfig, 'mode'>[] = [
    { from: '2:30', to: '4:00' },
    { from: '2:00', to: '4:10' },
    { from: '2:00', to: '2:00' },
    { from: '2:00', to: '7:00' },
    { from: '4:00', to: '2:00' },
    { from: '2:00' },
    { from: '2:00', to: '4:00', step: 3 as unknown as 5 },
    { from: '2:00', to: '4:00', start: '4:05' },
    { from: '2:00', to: '4:00', start: '2:42' },
    { from: '2:00', to: '4:00', startFixed: true },
    { from: 'x', to: '4:00' },
  ];
  it.each(bad.map((c, i) => [i, c] as const))('설정 %i은 오류다', (_i, config) => {
    expect(make(config).error).not.toBeNull();
  });

  it('4시간(경계)은 올바르고 5시간은 오류다', () => {
    expect(make({ from: '1:00', to: '5:00' }).error).toBeNull();
    expect(make({ from: '1:00', to: '6:00' }).error).not.toBeNull();
  });

  it('설정이 mode뿐이면 샌드박스 기본(2:00~4:00)이다', () => {
    const state = createDurationState({ mode: 'duration' });
    expect(state.error).toBeNull();
    expect([state.from, state.to]).toEqual([120, 240]);
  });
});

describe('Observation·predicates·JSON·등록', () => {
  it('predicates', () => {
    const o = observeDuration(play(make(), start('2:40'), end('3:20')));
    expect(durationPredicates['startIs']?.(o, { time: '2:40' })).toBe(true);
    expect(durationPredicates['startIs']?.(o, { time: '2:45' })).toBe(false);
    expect(durationPredicates['endIs']?.(o, { time: '3:20' })).toBe(true);
    expect(durationPredicates['elapsedIs']?.(o, { minutes: 40 })).toBe(true);
    expect(durationPredicates['elapsedIs']?.(o, { minutes: 80 })).toBe(false);
    expect(durationPredicates['bothPlaced']?.(o, undefined)).toBe(true);
    const half = observeDuration(play(make(), start('2:40')));
    expect(durationPredicates['bothPlaced']?.(half, undefined)).toBe(false);
    expect(durationPredicates['elapsedIs']?.(half, { minutes: 0 })).toBe(false);
    expect(durationPredicates['startIs']?.(half, undefined)).toBe(false);
  });

  it('JSON으로 직렬화되고 왕복해도 같다', () => {
    const state = play(make(), start('2:40'), end('3:20'));
    assertSerializable(state);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    assertSerializable(observeDuration(state));
  });

  it('엔진 정의가 reduce·observe·predicates를 모드로 나눠 준다', () => {
    expect(definition.modes).toEqual(['clock', 'duration', 'calendar']);
    const state = definition.createInitialState({ mode: 'duration', from: '2:00', to: '4:00' });
    expect(state.mode).toBe('duration');
    const next = definition.reduce(state, start('2:40'));
    expect(definition.observe(next, { mode: 'duration' })).toMatchObject({ start: '2:40' });
    expect(definition.emit?.(state, next, start('2:40'))).toEqual([
      { name: 'duration-changed', payload: { startPlaced: true, endPlaced: false } },
    ]);
    const same = make();
    expect(emitDuration(same, same)).toEqual([]);
    expect(definition.events).toContain('duration-changed');
    expect(definition.predicates).toHaveProperty('elapsedIs');
    expect(definition.overlays).toHaveProperty('hour-60-split');
  });

  it('시각 글 변환', () => {
    expect(formatDayTime(160)).toBe('2:40');
    expect(parseDayTime('24:00')).toBeNull();
    expect(parseDayTime('2:5')).toBeNull();
  });
});

describe('띠 좌표', () => {
  const range = { from: at('2:00'), to: at('4:00'), step: 5 };

  it('한 시간이 한 블록이고 사이에 틈이 있다', () => {
    const [a, b] = blocksOf(range);
    expect(a?.x0).toBe(BAND.left);
    expect(b?.x1).toBe(BAND.right);
    expect((b?.x0 ?? 0) - (a?.x1 ?? 0)).toBe(BAND.gap);
  });

  it('정시 경계는 다음 블록의 0분 자리, 맨 끝만 마지막 블록의 60분 자리다', () => {
    const [a, b] = blocksOf(range);
    expect(xOfMinutes(range, at('3:00'))).toBe(b?.x0);
    expect(xOfMinutes(range, at('4:00'))).toBe(b?.x1);
    expect(xOfMinutes(range, at('2:30'))).toBeCloseTo(((a?.x0 ?? 0) + (a?.x1 ?? 0)) / 2);
  });

  it('x에서 가장 가까운 눈금에 붙는다(step 5)', () => {
    for (const time of ['2:00', '2:40', '3:00', '3:20', '4:00']) {
      expect(nearestMinutes(range, xOfMinutes(range, at(time)))).toBe(at(time));
    }
    expect(nearestMinutes(range, xOfMinutes(range, at('2:40')) + 1)).toBe(at('2:40'));
    expect(nearestMinutes(range, -50)).toBe(at('2:00'));
    expect(nearestMinutes(range, 5000)).toBe(at('4:00'));
  });

  it('칠한 구간을 경계에서 나눈다', () => {
    expect(pieces(range, at('2:40'), at('3:20'))).toEqual([
      { lo: at('2:40'), hi: at('3:00'), block: 0 },
      { lo: at('3:00'), hi: at('3:20'), block: 1 },
    ]);
    expect(pieces(range, at('2:10'), at('2:50'))).toHaveLength(1);
    expect(crossedBoundaries(range, at('2:40'), at('3:20'))).toEqual([at('3:00')]);
    // 끝점이 경계와 같으면 지나는 것이 아니다.
    expect(crossedBoundaries(range, at('2:40'), at('3:00'))).toEqual([]);
    expect(crossedBoundaries(range, at('3:00'), at('3:20'))).toEqual([]);
    expect(
      crossedBoundaries({ from: at('1:00'), to: at('5:00') }, at('1:30'), at('4:30')),
    ).toHaveLength(3);
    expect(gapCenterX(range, at('3:00'))).toBeCloseTo(
      ((blocksOf(range)[0]?.x1 ?? 0) + (blocksOf(range)[1]?.x0 ?? 0)) / 2,
    );
  });
});
