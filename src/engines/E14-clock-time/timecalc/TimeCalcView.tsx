/**
 * E14 time-calc 화면과 조작 칸. [1시간으로 묶기]·[60분으로 풀기]·[빼기](sub만)·[처음으로].
 * 단추는 Tab으로 고르고 Enter/Space로 누른다. 조건이 안 맞으면 이유를 글로 알린다.
 * 올가미 연출 중에는 단추를 끄지(disabled) 않는다(끄면 키보드 초점이 사라진다). 누름을 무시할 뿐이다.
 */
import { useRef } from 'react';
import { Btn } from '../Btn';
import { ModeFrame } from '../ModeFrame';
import { E14_MODE_STRINGS } from '../strings-modes.ko';
import styles from '../View.module.css';
import { boardHeight } from './layout';
import { TimeCalcBoard } from './TimeCalcBoard';
import type { TimeCalcAction, TimeCalcState } from './types';
import { useTimeCalcUi } from './useTimeCalcUi';

const S = E14_MODE_STRINGS.timeCalc;

export interface TimeCalcViewProps {
  readonly state: TimeCalcState;
  readonly dispatch: (action: TimeCalcAction) => void;
  readonly targetSize: number;
  readonly readOnly?: boolean;
}

export function TimeCalcView({ state, dispatch, targetSize, readOnly = false }: TimeCalcViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const ui = useTimeCalcUi(state, dispatch, readOnly);
  const names = S.units[state.units];
  const controls = (
    <div className={styles.sideStack} data-testid="clock-controls">
      <p className={styles.instructions}>{S.instructions}</p>
      <p className={styles.status} role="status" data-testid="clock-message">
        {ui.message ?? ''}
      </p>
      <div className={styles.row} role="group" aria-label={E14_MODE_STRINGS.controlsLabel}>
        <Btn
          label={names.bundle}
          action="bundle"
          primary
          disabled={readOnly}
          onClick={() => ui.send({ type: 'bundle' })}
        />
        <Btn
          label={names.unbundle}
          action="unbundle"
          disabled={readOnly}
          onClick={() => ui.send({ type: 'unbundle' })}
        />
        {state.op === 'sub' ? (
          <Btn
            label={S.takeAway}
            action="take-away"
            primary
            disabled={readOnly}
            onClick={() => ui.send({ type: 'take-away' })}
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
  return (
    <ModeFrame
      mode="time-calc"
      error={state.error}
      targetSize={targetSize}
      logicalHeight={boardHeight(state)}
      controls={controls}
      renderBoard={(svgStyle, className) => (
        <TimeCalcBoard
          svgRef={svgRef}
          state={state}
          lasso={ui.lasso}
          svgStyle={svgStyle}
          className={className}
        />
      )}
    />
  );
}
