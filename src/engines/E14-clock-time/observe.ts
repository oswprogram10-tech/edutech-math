/** E14 Observation. 시각은 "H:MM"이다. 오개념은 엔진이 기록하지 않는다(콘텐츠 predicate로 건다). */
import type { Observation } from '../../core/engine-sdk';
import { formatTime, hourOf, minuteOf } from './settings';
import type { ClockState } from './types';

export function observe(state: ClockState): Observation {
  return {
    mode: 'clock',
    time: formatTime(state.minutes),
    hour: hourOf(state.minutes),
    minute: minuteOf(state.minutes),
    minutes: state.minutes,
    moves: state.moves,
    unrolled: state.unrolled,
    misconceptions: [],
  };
}
