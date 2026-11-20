/**
 * E14 조작 칸(SVG 밖). 끌기를 못 쓰는 학생을 위해 모든 조작에 단추가 있다.
 * 시각을 글로 알려 주지 않는다(디지털 표시는 판 안에서 digitalReadout:'always'일 때만).
 */
import { Btn } from './Btn';
import { E14_STRINGS as S } from './strings.ko';
import type { ClockState } from './types';
import type { ClockUi } from './useClockUi';
import styles from './View.module.css';

export interface ControlsProps {
  readonly state: ClockState;
  readonly ui: ClockUi;
  readonly readOnly: boolean;
}

export function Controls({ state, ui, readOnly }: ControlsProps) {
  const locked = readOnly || state.readOnly;
  return (
    <div className={styles.sideStack} data-testid="clock-controls">
      <p className={styles.instructions}>{S.instructions}</p>
      <p className={styles.status} role="status" data-testid="clock-message">
        {ui.message ?? ''}
      </p>
      <div className={styles.row} role="group" aria-label={S.controlsLabel}>
        <Btn label={S.backward} action="backward" disabled={locked} onClick={() => ui.stepBy(-1)} />
        <Btn label={S.forward} action="forward" disabled={locked} onClick={() => ui.stepBy(1)} />
        {state.unroll ? (
          <Btn
            label={state.unrolled ? S.rewind : S.unroll}
            action="toggle-unroll"
            disabled={readOnly}
            pressed={state.unrolled}
            onClick={() => ui.send({ type: 'toggle-unroll' })}
          />
        ) : null}
        <Btn
          label={S.reset}
          action="reset"
          disabled={readOnly}
          onClick={() => ui.send({ type: 'reset' })}
        />
      </div>
    </div>
  );
}
