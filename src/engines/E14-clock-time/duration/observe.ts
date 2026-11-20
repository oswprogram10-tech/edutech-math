/** E14 duration Observation. 걸린 시간(분)은 여기에만 있다(화면·DOM·aria에는 쓰지 않는다). */
import type { Observation } from '../../../core/engine-sdk';
import { formatDayTime } from './settings';
import type { DurationState } from './types';

export function observeDuration(state: DurationState): Observation {
  const { start, end } = state;
  return {
    mode: 'duration',
    start: start === null ? null : formatDayTime(start),
    end: end === null ? null : formatDayTime(end),
    elapsed: start !== null && end !== null ? end - start : null,
    moves: state.moves,
    misconceptions: [],
  };
}
