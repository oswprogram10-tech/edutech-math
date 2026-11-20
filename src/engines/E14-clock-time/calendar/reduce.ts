/**
 * E14 calendar 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(꺼진 조작, 달 밖 날짜, 가려지지 않은 칸 fill, 다른 열 화살표)은 같은 객체를 돌려준다.
 */
import { dayAt, isInt, normalizeCalendar, rowCount } from './settings';
import type { CalendarAction, CalendarConfig, CalendarState } from './types';

export function createCalendarState(config: CalendarConfig): CalendarState {
  return normalizeCalendar(config);
}

export function segmentKey(col: number, row: number): string {
  return `${col}:${row}`;
}

function sortSegments(keys: readonly string[]): string[] {
  return [...keys].sort((a, b) => {
    const [ac = 0, ar = 0] = a.split(':').map(Number);
    const [bc = 0, br = 0] = b.split(':').map(Number);
    return ac - bc || ar - br;
  });
}

export function reduceCalendar(state: CalendarState, action: CalendarAction): CalendarState {
  if (state.error !== null) return state;
  switch (action.type) {
    case 'toggle': {
      const { day } = action;
      if (!state.canSelect || !isInt(day, 1, state.days)) return state;
      const selected = state.selected.includes(day)
        ? state.selected.filter((d) => d !== day)
        : [...state.selected, day].sort((a, b) => a - b);
      return { ...state, selected, moves: state.moves + 1 };
    }
    case 'fill': {
      const { day, value } = action;
      if (!state.canFill || !isInt(value, 1, 31) || !isInt(day, 1, state.days)) return state;
      if (!state.hidden.includes(day)) return state;
      if (state.filled[String(day)] === value) return state;
      return {
        ...state,
        filled: { ...state.filled, [String(day)]: value },
        moves: state.moves + 1,
      };
    }
    case 'draw-arrows': {
      const { col, fromRow, toRow } = action;
      if (!state.canArrow) return state;
      if (!isInt(col, 0, 6) || !isInt(fromRow, 0, 5) || !isInt(toRow, 0, 5)) return state;
      if (toRow <= fromRow || toRow >= rowCount(state)) return state;
      for (let row = fromRow; row <= toRow; row += 1) {
        if (dayAt(state, col, row) === null) return state;
      }
      const added: string[] = [];
      for (let row = fromRow; row < toRow; row += 1) {
        const key = segmentKey(col, row);
        if (!state.segments.includes(key)) added.push(key);
      }
      if (added.length === 0) return state;
      return {
        ...state,
        segments: sortSegments([...state.segments, ...added]),
        moves: state.moves + 1,
      };
    }
    case 'reset':
      return state.moves === 0
        ? state
        : { ...state, selected: [], filled: {}, segments: [], moves: 0 };
    default:
      return state;
  }
}
