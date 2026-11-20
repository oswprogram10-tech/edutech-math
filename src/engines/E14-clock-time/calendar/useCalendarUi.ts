/**
 * E14 calendar 조작 칸의 지역 상태(고른 가려진 칸, 키패드 입력 중인 수, 안내 글).
 * 가려진 칸의 날짜는 지역 상태에만 두고 DOM에는 쓰지 않는다. 거절된 조작은 이유를 글로 알린다.
 */
import { useState } from 'react';
import { E14_MODE_STRINGS } from '../strings-modes.ko';
import { reduceCalendar } from './reduce';
import type { CalendarAction, CalendarState } from './types';

const S = E14_MODE_STRINGS.calendar;
const MAX_DIGITS = 2;

export interface CalendarUi {
  readonly message: string | null;
  /** 수를 넣으려고 고른 가려진 칸(없으면 null). 화면에 값으로 쓰지 않는다. */
  readonly activeDay: number | null;
  readonly buffer: string;
  readonly locked: boolean;
  readonly send: (action: CalendarAction) => boolean;
  /** 칸을 눌렀을 때: 가려진 칸이면(수 넣기가 켜져 있을 때) 고르기, 아니면 날짜 고르기/풀기. */
  readonly tapDay: (day: number) => void;
  readonly pressDigit: (digit: number) => void;
  readonly clearBuffer: () => void;
  readonly put: () => void;
  readonly drawArrows: (col: number, fromRow: number, toRow: number) => void;
  readonly arrowShapeRejected: () => void;
}

function rejection(state: CalendarState, action: CalendarAction): string {
  switch (action.type) {
    case 'toggle':
      return state.canSelect ? S.rejected.same : S.rejected.cannotSelect;
    case 'fill':
      if (!state.canFill) return S.rejected.cannotFill;
      return state.hidden.includes(action.day) ? S.rejected.badValue : S.rejected.noCell;
    case 'draw-arrows':
      return state.canArrow ? S.rejected.arrowShape : S.rejected.cannotArrow;
    default:
      return S.rejected.same;
  }
}

export function useCalendarUi(
  state: CalendarState,
  dispatch: (action: CalendarAction) => void,
  readOnly: boolean,
): CalendarUi {
  const [message, setMessage] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [buffer, setBuffer] = useState('');

  const send = (action: CalendarAction): boolean => {
    if (readOnly) {
      setMessage(S.rejected.locked);
      return false;
    }
    if (reduceCalendar(state, action) === state) {
      setMessage(rejection(state, action));
      return false;
    }
    if (action.type === 'reset') {
      setActiveDay(null);
      setBuffer('');
    }
    setMessage(null);
    dispatch(action);
    return true;
  };

  const tapDay = (day: number) => {
    if (readOnly) return;
    if (state.canFill && state.hidden.includes(day)) {
      setActiveDay(day);
      setBuffer('');
      setMessage(null);
      return;
    }
    if (state.canSelect) send({ type: 'toggle', day });
  };

  const pressDigit = (digit: number) => {
    if (readOnly) return;
    if (activeDay === null) {
      setMessage(S.rejected.noCell);
      return;
    }
    setMessage(null);
    setBuffer((current) => (current.length >= MAX_DIGITS ? current : `${current}${digit}`));
  };

  const clearBuffer = () => {
    setBuffer('');
    setMessage(null);
  };

  const put = () => {
    if (readOnly) return;
    if (activeDay === null) {
      setMessage(S.rejected.noCell);
      return;
    }
    if (buffer === '') {
      setMessage(S.rejected.noEntry);
      return;
    }
    if (send({ type: 'fill', day: activeDay, value: Number(buffer) })) setBuffer('');
  };

  const drawArrows = (col: number, fromRow: number, toRow: number) => {
    send({ type: 'draw-arrows', col, fromRow, toRow });
  };

  const arrowShapeRejected = () => setMessage(S.rejected.arrowShape);

  return {
    message,
    activeDay,
    buffer,
    locked: readOnly,
    send,
    tapDay,
    pressDigit,
    clearBuffer,
    put,
    drawArrows,
    arrowShapeRejected,
  };
}
