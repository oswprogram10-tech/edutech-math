/** E14 calendar 화면: 공용 틀 + 판 + 조작 칸(수 넣기 키패드). */
import { Btn } from '../Btn';
import { ModeFrame } from '../ModeFrame';
import { E14_MODE_STRINGS } from '../strings-modes.ko';
import styles from '../View.module.css';
import { CalendarBoard } from './CalendarBoard';
import type { CalendarAction, CalendarState } from './types';
import { useCalendarUi } from './useCalendarUi';

const S = E14_MODE_STRINGS;
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0] as const;

export interface CalendarViewProps {
  readonly state: CalendarState;
  readonly dispatch: (action: CalendarAction) => void;
  readonly targetSize: number;
  readonly readOnly?: boolean;
}

function instructionsOf(state: CalendarState): string {
  const parts: string[] = [S.calendar.instructionsLead];
  if (state.canSelect) parts.push(S.calendar.instructionsSelect);
  if (state.canFill) parts.push(S.calendar.instructionsFill);
  if (state.canArrow) parts.push(S.calendar.instructionsArrows);
  return parts.join(' ');
}

export function CalendarView({ state, dispatch, targetSize, readOnly = false }: CalendarViewProps) {
  const ui = useCalendarUi(state, dispatch, readOnly);
  const interactive = state.canSelect || state.canFill || state.canArrow;
  const controls = (
    <div className={styles.sideStack} data-testid="clock-controls">
      <p className={styles.instructions}>{instructionsOf(state)}</p>
      <p className={styles.status} role="status" data-testid="clock-message">
        {ui.message ?? ''}
      </p>
      {state.canFill ? (
        <div className={styles.group}>
          <p className={styles.made} data-testid="calendar-buffer">
            {S.calendar.bufferLabel}: {ui.buffer === '' ? S.calendar.bufferEmpty : ui.buffer}
          </p>
          <div className={styles.row} role="group" aria-label={S.calendar.bufferLabel}>
            {DIGITS.map((digit) => (
              <Btn
                key={digit}
                label={S.calendar.digit(digit)}
                action={`digit-${digit}`}
                disabled={ui.locked}
                onClick={() => ui.pressDigit(digit)}
              />
            ))}
            <Btn
              label={S.calendar.clear}
              action="clear"
              disabled={ui.locked}
              onClick={() => ui.clearBuffer()}
            />
            <Btn
              label={S.calendar.put}
              action="put"
              primary
              disabled={ui.locked}
              onClick={() => ui.put()}
            />
          </div>
        </div>
      ) : null}
      {interactive ? (
        <div className={styles.row} role="group" aria-label={S.controlsLabel}>
          <Btn
            label={S.reset}
            action="reset"
            disabled={ui.locked}
            onClick={() => ui.send({ type: 'reset' })}
          />
        </div>
      ) : null}
    </div>
  );
  return (
    <ModeFrame
      mode="calendar"
      error={state.error}
      targetSize={targetSize}
      controls={controls}
      renderBoard={(svgStyle, className) => (
        <CalendarBoard state={state} ui={ui} svgStyle={svgStyle} className={className} />
      )}
    />
  );
}
