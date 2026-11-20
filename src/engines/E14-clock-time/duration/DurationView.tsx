/** E14 duration 화면: 공용 틀 + 판 + 조작 칸. */
import { Btn } from '../Btn';
import { ModeFrame } from '../ModeFrame';
import { E14_MODE_STRINGS } from '../strings-modes.ko';
import styles from '../View.module.css';
import { DurationBoard } from './DurationBoard';
import type { DurationAction, DurationState } from './types';
import { useDurationUi } from './useDurationUi';

const S = E14_MODE_STRINGS;

export interface DurationViewProps {
  readonly state: DurationState;
  readonly dispatch: (action: DurationAction) => void;
  readonly targetSize: number;
  readonly readOnly?: boolean;
}

export function DurationView({ state, dispatch, targetSize, readOnly = false }: DurationViewProps) {
  const ui = useDurationUi(state, dispatch, readOnly);
  const fixed = state.startFixed;
  const controls = (
    <div className={styles.sideStack} data-testid="clock-controls">
      <p className={styles.instructions}>
        {fixed ? S.duration.instructionsFixed : S.duration.instructions}
      </p>
      <p className={styles.status} role="status" data-testid="clock-message">
        {ui.message ?? ''}
      </p>
      <div className={styles.row} role="group" aria-label={S.controlsLabel}>
        {fixed ? null : (
          <>
            <Btn
              label={S.duration.startBack}
              action="start-back"
              disabled={ui.locked}
              onClick={() => ui.moveMark('start', -1)}
            />
            <Btn
              label={S.duration.startForward}
              action="start-forward"
              disabled={ui.locked}
              onClick={() => ui.moveMark('start', 1)}
            />
          </>
        )}
        <Btn
          label={S.duration.endBack}
          action="end-back"
          disabled={ui.locked}
          onClick={() => ui.moveMark('end', -1)}
        />
        <Btn
          label={S.duration.endForward}
          action="end-forward"
          disabled={ui.locked}
          onClick={() => ui.moveMark('end', 1)}
        />
        <Btn
          label={S.reset}
          action="reset"
          disabled={ui.locked}
          onClick={() => ui.send({ type: 'reset' })}
        />
      </div>
    </div>
  );
  return (
    <ModeFrame
      mode="duration"
      error={state.error}
      targetSize={targetSize}
      controls={controls}
      renderBoard={(svgStyle, className) => (
        <DurationBoard state={state} ui={ui} svgStyle={svgStyle} className={className} />
      )}
    />
  );
}
