/**
 * 힌트 ② plus-seven (calendar 일반). args `{ day }`: 그 칸에서 같은 열 아래로 끝까지 "+7" 화살표를
 * 점선으로 그린다. 칸 숫자는 새로 쓰지 않고, 가려진 칸은 "?" 그대로 둔다.
 * day가 없거나 그 달에 없으면 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../../types';
import { ArrowMark } from '../CalendarBoard';
import { colOf, dayAt, isInt, rowOf } from '../settings';
import type { CalendarConfig, CalendarState } from '../types';

const ORANGE = '#e8872e';

function dayOf(args: unknown): number | null {
  if (typeof args !== 'object' || args === null) return null;
  const value = (args as { day?: unknown }).day;
  return isInt(value, 1, 31) ? value : null;
}

export function PlusSevenOverlay({ state, args }: OverlayProps<CalendarConfig, CalendarState>) {
  const day = dayOf(args);
  if (state.error !== null || day === null || day > state.days) return null;
  const col = colOf(state, day);
  const start = rowOf(state, day);
  const rows: number[] = [];
  for (let row = start; dayAt(state, col, row + 1) !== null; row += 1) rows.push(row);
  return (
    <CanvasAlignedOverlay
      testId="overlay-plus-seven"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      {rows.map((row) => (
        <ArrowMark key={row} part="plus-seven" col={col} row={row} color={ORANGE} dashed />
      ))}
    </CanvasAlignedOverlay>
  );
}
