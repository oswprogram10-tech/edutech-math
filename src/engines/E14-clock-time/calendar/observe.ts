/** E14 calendar Observation. 가려진 날짜의 맞고 틀림은 `hiddenCorrect`로만 판정한다. */
import type { Observation } from '../../../core/engine-sdk';
import type { CalendarState } from './types';

export function hiddenCorrect(state: CalendarState): boolean {
  return state.hidden.length > 0 && state.hidden.every((day) => state.filled[String(day)] === day);
}

export function observeCalendar(state: CalendarState): Observation {
  return {
    mode: 'calendar',
    selected: [...state.selected],
    filled: { ...state.filled },
    hiddenCorrect: hiddenCorrect(state),
    arrows: state.segments.length,
    moves: state.moves,
    misconceptions: [],
  };
}
